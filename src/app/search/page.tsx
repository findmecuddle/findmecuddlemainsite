import { Suspense } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers, reviews, type Cuddler } from "@/lib/schema";
import { resolveLocation } from "@/lib/geo";
import Link from "next/link";
import { DEFAULT_RADIUS_MILES, TOP_RATED_LIMIT, SEARCH_RESULTS_PER_PAGE } from "@/lib/config";
import { isLive, isVip, isBoosted } from "@/lib/stripe";
import { findNearbyCuddlers, weightedScore, type NearbyResult } from "@/lib/nearbySearch";
import SearchBar from "@/components/SearchBar";
import ListingCard from "@/components/ListingCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find A Cuddle Professional Near You",
  description: "Search independent, certified cuddle professionals by zip code, city, or address.",
};

type Result = NearbyResult;

export default async function SearchPage(
  props: {
    searchParams: Promise<{ q?: string; radius?: string; page?: string; gender?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const radius = Math.min(parseInt(searchParams.radius ?? "", 10) || DEFAULT_RADIUS_MILES, 250);
  const origin = q ? resolveLocation(q) : null;
  const gender = searchParams.gender === "male" || searchParams.gender === "female" ? searchParams.gender : null;

  let results: Result[] = [];
  if (origin) results = await findNearbyCuddlers(origin, radius, [], false, false, gender);

  const primaryResults = results;

  // A normal location search can otherwise return hundreds of results in a dense metro area —
  // this is what actually guards against that.
  const totalPages = Math.max(1, Math.ceil(primaryResults.length / SEARCH_RESULTS_PER_PAGE));
  const page = Math.min(Math.max(parseInt(searchParams.page ?? "", 10) || 1, 1), totalPages);
  const pagedResults = primaryResults.slice((page - 1) * SEARCH_RESULTS_PER_PAGE, page * SEARCH_RESULTS_PER_PAGE);

  // Rebuilds the current search URL with just the page number changed — keeps every other filter
  // (location, radius, gender) intact when moving between pages.
  function pageHref(target: number) {
    const qs = new URLSearchParams();
    qs.set("q", q);
    qs.set("radius", String(radius));
    if (gender) qs.set("gender", gender);
    if (target > 1) qs.set("page", String(target));
    return `/search?${qs.toString()}`;
  }

  // No location entered yet (or it didn't resolve) — this is the state landed on from the
  // homepage's "Browse Cuddlers" link. Show a nationwide showcase instead of a dead end.
  const browse = !origin ? await browseTopCuddlers() : null;

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="max-w-2xl">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>

      {!q && <p className="mt-10 text-stone2">Enter a zip code, city, or address to find cuddlers near you.</p>}

      {q && !origin && (
        <div className="card mt-10 max-w-xl p-6">
          <h2 className="font-display text-lg font-semibold">We couldn’t place “{q}”</h2>
          <p className="mt-2 text-sm text-stone2">
            Try a 5-digit zip code or a city with its state — for example <strong>78704</strong> or{" "}
            <strong>Austin, TX</strong>.
          </p>
        </div>
      )}

      {browse && (browse.vip.length > 0 || browse.rated.length > 0) && (
        <div className="mt-10 grid gap-10">
          {browse.vip.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold">VIP Cuddlers</h2>
              <p className="mt-1 text-sm text-stone2">Our Monthly VIP members, from across the country.</p>
              <ul className="mt-4 grid gap-4">
                {browse.vip.map((r) => (
                  <li key={r.t.id}>
                    <ListingCard cuddler={r.t} avgRating={r.avgRating} reviewCount={r.reviewCount} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {browse.rated.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold">Highest Rated</h2>
              <p className="mt-1 text-sm text-stone2">Top-reviewed cuddlers, nationwide.</p>
              <ul className="mt-4 grid gap-4">
                {browse.rated.map((r) => (
                  <li key={r.t.id}>
                    <ListingCard cuddler={r.t} avgRating={r.avgRating} reviewCount={r.reviewCount} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {origin && (
        <>
          <p className="mt-8 text-sm text-stone2">
            {primaryResults.length} cuddler{primaryResults.length === 1 ? "" : "s"} within {radius} miles of{" "}
            <span className="font-medium text-ink">{origin.label}</span>
            {gender && (
              <>
                {" "}· <span className="font-medium text-ink">{gender}</span>
              </>
            )}
          </p>
          {primaryResults.length === 0 ? (
            <div className="card mt-4 max-w-xl p-6">
              <h2 className="font-display text-lg font-semibold">No listings here yet</h2>
              <p className="mt-2 text-sm text-stone2">
                Try widening the radius or searching a nearby city.
              </p>
            </div>
          ) : (
            <>
              <ul className="mt-4 grid gap-4">
                {pagedResults.map((r) => (
                  <li key={r.t.id}>
                    <ListingCard
                      cuddler={r.t}
                      distance={r.distance}
                      city={r.matchedCity}
                      state={r.matchedState}
                      avgRating={r.avgRating}
                      reviewCount={r.reviewCount}
                      openNow={r.openNow}
                    />
                  </li>
                ))}
              </ul>
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  {page > 1 ? (
                    <Link href={pageHref(page - 1)} className="btn-ghost">Previous</Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-sm text-stone2">Page {page} of {totalPages}</span>
                  {page < totalPages ? (
                    <Link href={pageHref(page + 1)} className="btn-ghost">Next</Link>
                  ) : (
                    <span />
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

type BrowseEntry = { t: Cuddler; avgRating: number; reviewCount: number };

/**
 * Nationwide showcase for when no location has been entered yet — reached by clicking
 * "Browse Cuddlers" on the homepage. No distance/radius applies here, so this pulls from
 * every live listing rather than a geo bounding box.
 */
async function browseTopCuddlers(): Promise<{ vip: BrowseEntry[]; rated: BrowseEntry[] }> {
  const candidates = await db
    .select()
    .from(cuddlers)
    .where(and(eq(cuddlers.published, true), eq(cuddlers.subStatus, "active")));

  const live = candidates.filter(isLive);
  if (live.length === 0) return { vip: [], rated: [] };

  const ids = live.map((t) => t.id);
  const approved = await db
    .select({ cuddlerId: reviews.cuddlerId, rating: reviews.rating })
    .from(reviews)
    .where(and(inArray(reviews.cuddlerId, ids), eq(reviews.status, "approved")));

  const byCuddler = new Map<string, number[]>();
  for (const r of approved) {
    const list = byCuddler.get(r.cuddlerId) ?? [];
    list.push(r.rating);
    byCuddler.set(r.cuddlerId, list);
  }

  const withRatings: BrowseEntry[] = live.map((t) => {
    const ratings = byCuddler.get(t.id) ?? [];
    const reviewCount = ratings.length;
    const avgRating = reviewCount > 0 ? ratings.reduce((s, n) => s + n, 0) / reviewCount : 0;
    return { t, avgRating, reviewCount };
  });

  // VIP section: boosted first (still a paid perk worth surfacing), then by rating quality,
  // then newest-verified as a stable tiebreak for listings with no reviews yet.
  const vip = withRatings
    .filter((r) => isVip(r.t))
    .sort((a, b) => {
      const aBoosted = isBoosted(a.t);
      const bBoosted = isBoosted(b.t);
      if (aBoosted !== bBoosted) return aBoosted ? -1 : 1;
      const scoreDiff = weightedScore(b) - weightedScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.t.verifiedAt?.getTime() ?? 0) - (a.t.verifiedAt?.getTime() ?? 0);
    })
    .slice(0, TOP_RATED_LIMIT);

  // Highest Rated: needs at least one approved review, same weighted formula as the
  // per-service "top rated" page.
  const rated = withRatings
    .filter((r) => r.reviewCount > 0)
    .sort((a, b) => weightedScore(b) - weightedScore(a))
    .slice(0, TOP_RATED_LIMIT);

  return { vip, rated };
}
