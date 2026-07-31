import { and, between, eq, inArray, like, or } from "drizzle-orm";
import { db } from "./db";
import { cuddlers, cuddlerHours, reviews, agencyEmployees, type Cuddler } from "./schema";
import { milesBetween } from "./geo";
import { TOP_RATED_LIMIT, RATING_CONFIDENCE_M, RATING_PRIOR } from "./config";
import { isLive, isVip, isBoosted } from "./stripe";
import { isOpenNow, isManuallyOpen } from "./hours";

export type NearbyResult = {
  t: Cuddler;
  distance: number;
  matchedCity: string;
  matchedState: string;
  avgRating?: number;
  reviewCount?: number;
  /** Whether they're inside one of their configured open windows right now, in their own state's
   *  local time. Always computed (so ListingCard can show the badge everywhere), but only used to
   *  filter results when openNowOnly is passed. */
  openNow?: boolean;
};

/** IMDb-style weighted rating so a single 5-star review can't outrank dozens of consistent 4.8s. */
export function weightedScore(r: { avgRating?: number; reviewCount?: number }): number {
  const n = r.reviewCount ?? 0;
  const avg = r.avgRating ?? 0;
  return (n / (n + RATING_CONFIDENCE_M)) * avg + (RATING_CONFIDENCE_M / (n + RATING_CONFIDENCE_M)) * RATING_PRIOR;
}

/**
 * Core "who's live and nearby" query — shared by the interactive /search page and the
 * auto-generated SEO city landing pages (/cuddlers-near/[city] (not built yet in this v1)). Keeping this in one place
 * means both surfaces always agree on which listings show up for a given location, in the same
 * order, instead of drifting apart the next time boost/VIP/rating logic changes.
 */
export async function findNearbyCuddlers(
  origin: { lat: number; lng: number },
  radius: number,
  types: string[] = [],
  ratedSort = false,
  openNowOnly = false,
  // Optional — matches a solo cuddler's own gender field, or a agency account with at least one
  // team member of that gender (see the `gender` comment on both cuddlers and agencyEmployees in
  // lib/schema.ts). Display-only field otherwise; this is the one place it's actually filtered on.
  gender: "male" | "female" | null = null
): Promise<NearbyResult[]> {
  // Coarse bounding box in SQL, exact haversine + sort in JS. Matches either the
  // cuddler's primary or second location — whichever OR clause hits.
  const latDelta = radius / 69;
  const lngDelta = radius / (Math.cos((origin.lat * Math.PI) / 180) * 69);

  const candidates = await db
    .select()
    .from(cuddlers)
    .where(
      and(
        eq(cuddlers.published, true),
        eq(cuddlers.subStatus, "active"),
        or(
          and(
            between(cuddlers.lat, origin.lat - latDelta, origin.lat + latDelta),
            between(cuddlers.lng, origin.lng - lngDelta, origin.lng + lngDelta)
          ),
          and(
            between(cuddlers.lat2, origin.lat - latDelta, origin.lat + latDelta),
            between(cuddlers.lng2, origin.lng - lngDelta, origin.lng + lngDelta)
          )
        ),
        // "services" is a comma-separated free-text list — a plain substring match per selected
        // type is safe here since none of the fixed CUDDLE_TYPES values are substrings of each
        // other. Matches if the cuddler offers ANY of the selected types.
        types.length > 0 ? or(...types.map((type) => like(cuddlers.services, `%${type}%`))) : undefined
      )
    );

  const inRange: NearbyResult[] = candidates
    .filter(isLive)
    .map((t) => {
      // Consider whichever locations the cuddler has set; use the nearest one within radius.
      // A second location only counts for an active Monthly VIP subscription.
      const options = [{ lat: t.lat, lng: t.lng, city: t.city, state: t.state }];
      if (isVip(t) && t.lat2 != null && t.lng2 != null) {
        options.push({ lat: t.lat2, lng: t.lng2, city: t.city2 ?? t.city, state: t.state2 ?? t.state });
      }
      const best = options
        .map((o) => ({ ...o, distance: milesBetween(origin, o) }))
        .sort((a, b) => a.distance - b.distance)[0];
      return { t, distance: best.distance, matchedCity: best.city, matchedState: best.state };
    })
    .filter((r) => r.distance <= radius);

  let genderFiltered = inRange;
  if (gender) {
    // Solo accounts match on their own field directly. Agency accounts match if ANY team member is
    // that gender — requires a lookup against agencyEmployees since the agency's own row has no single
    // gender of its own.
    const agencyIds = inRange.filter((r) => r.t.accountType === "agency").map((r) => r.t.id);
    const matchingAgencyIds =
      agencyIds.length > 0
        ? new Set(
            (
              await db
                .select({ cuddlerId: agencyEmployees.cuddlerId })
                .from(agencyEmployees)
                .where(and(inArray(agencyEmployees.cuddlerId, agencyIds), eq(agencyEmployees.gender, gender)))
            ).map((r) => r.cuddlerId)
          )
        : new Set<string>();
    genderFiltered = inRange.filter((r) =>
      r.t.accountType === "agency" ? matchingAgencyIds.has(r.t.id) : r.t.gender === gender
    );
  }

  // Attach "open right now" (in the cuddler's own state's local time) to every result — cheap
  // enough to always compute so ListingCard can show the badge anywhere, not just when someone
  // filters by it. See lib/hours.ts for the timezone-by-state approximation this relies on.
  if (genderFiltered.length > 0) {
    const ids = genderFiltered.map((r) => r.t.id);
    const hourRows = await db
      .select()
      .from(cuddlerHours)
      .where(inArray(cuddlerHours.cuddlerId, ids));
    const hoursByCuddler = new Map<string, typeof hourRows>();
    for (const row of hourRows) {
      const list = hoursByCuddler.get(row.cuddlerId) ?? [];
      list.push(row);
      hoursByCuddler.set(row.cuddlerId, list);
    }
    for (const r of genderFiltered) {
      // A cuddler with no hours listed at all doesn't count as "open now" on their own — but a
      // manual "I'm Open Now" activation (see isManuallyOpen in lib/hours.ts) always overrides,
      // whether or not hours are set, since it's an explicit "yes, right now" signal.
      r.openNow = isManuallyOpen(r.t) || isOpenNow(hoursByCuddler.get(r.t.id) ?? [], r.matchedState);
    }
  }

  const filtered = openNowOnly ? genderFiltered.filter((r) => r.openNow) : genderFiltered;

  if (!ratedSort) {
    return filtered.sort((a, b) => {
      // Tier 1: actively boosted (most recent boost on top).
      const aBoosted = isBoosted(a.t);
      const bBoosted = isBoosted(b.t);
      if (aBoosted !== bBoosted) return aBoosted ? -1 : 1;
      if (aBoosted && bBoosted) {
        const ab = a.t.boostedAt!.getTime();
        const bb = b.t.boostedAt!.getTime();
        if (ab !== bb) return bb - ab;
        return a.distance - b.distance;
      }
      // Tier 2 (neither boosted): Monthly VIP outranks non-VIP, then by distance.
      const aVip = isVip(a.t);
      const bVip = isVip(b.t);
      if (aVip !== bVip) return aVip ? -1 : 1;
      return a.distance - b.distance;
    });
  }

  // --- Rated mode: rank by review quality, not boost/VIP tier. Featured/VIP/Verified badges
  // still render on each card (see ListingCard) — they just don't decide the order here.
  if (filtered.length === 0) return [];
  const ratedIds = filtered.map((r) => r.t.id);
  const approved = await db
    .select({ cuddlerId: reviews.cuddlerId, rating: reviews.rating })
    .from(reviews)
    .where(and(inArray(reviews.cuddlerId, ratedIds), eq(reviews.status, "approved")));

  const byCuddler = new Map<string, number[]>();
  for (const r of approved) {
    const list = byCuddler.get(r.cuddlerId) ?? [];
    list.push(r.rating);
    byCuddler.set(r.cuddlerId, list);
  }

  return filtered
    .map((r) => {
      const ratings = byCuddler.get(r.t.id) ?? [];
      const reviewCount = ratings.length;
      const avgRating = reviewCount > 0 ? ratings.reduce((s, n) => s + n, 0) / reviewCount : 0;
      return { ...r, avgRating, reviewCount };
    })
    // A cuddler needs at least one approved review to appear on a "top rated" list at all.
    .filter((r) => r.reviewCount! > 0)
    .sort((a, b) => weightedScore(b) - weightedScore(a))
    .slice(0, TOP_RATED_LIMIT);
}

export type { Cuddler };
