import { Suspense } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers, reviews, type Cuddler } from "@/lib/schema";
import { resolveLocation } from "@/lib/geo";
import Link from "next/link";
import { DEFAULT_RADIUS_MILES, CUDDLE_TYPES, TOP_RATED_LIMIT, SEARCH_RESULTS_PER_PAGE } from "@/lib/config";
import { isLive, isVip, isBoosted } from "@/lib/stripe";
import { findNearbyCuddlers, weightedScore, type NearbyResult } from "@/lib/nearbySearch";
import SearchBar from "@/components/SearchBar";
import ListingCard from "@/components/ListingCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find A Cuddle Professional Or Agency Near You",
  description: "Search independent, licensed cuddle professionals and agencies by zip code, city, or address.",
};

type Result = NearbyResult;

export default async function SearchPage(
  props: {
    searchParams: Promise<{ q?: string; radius?: string; types?: string; sort?: string; openNow?: string; page?: string; gender?: string; kind?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = searchParams.q ?? "";
  const radius = Math.min(parseInt(searchParams.radius ?? "", 10) || DEFAULT_RADIUS_MILES, 250);
  const origin = q ? resolveLocation(q) : null;
  // Only accept known cuddle types — ignores anything tampered with in the URL.
  const types = (searchParams.types ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => CUDDLE_TYPES.includes(t));
  // "Top rated" mode: reached by clicking a service tag on a listing. Ranks by review quality
  // instead of the boosted/VIP tiers — Featured/VIP/Verified badges still show on each card, they
  // just don't affect the order here the way they do on a normal search.
  const ratedSort = searchParams.sort === "rating";
  const openNow = searchParams.openNow === "1";
  const gender = searchParams.gender === "male" || searchParams.gender === "female" ? searchParams.gender : null;
  // "all" mixes cuddlers and agencies together like before; "solo"/"agency" narrows the main results to
  // just that type, with up to 5 of the OTHER type surfaced below in "You Might Also Like" instead
  // of being dropped entirely.
  const kind = searchParams.kind === "solo" || searchParams.kind === "agency" ? searchParams.kind : "all";
  const otherKind = kind === "solo" ? "agency" : "solo";
  const kindNoun = kind === "agency" ? "agency" : kind === "solo" ? "cuddle professional" : "cuddler";

  let results: Result[] = [];
  if (origin) results = await findNearbyCuddlers(origin, radius, types, ratedSort, openNow, gender);

  const primaryResults = kind === "all" ? results : results.filter((r) => r.t.accountType === kind);
  const crossResults = kind === "all" ? [] : results.filter((r) => r.t.accountType === otherKind).slice(0, 5);

  // Pagination — "Top rated" mode is already capped below SEARCH_RESULTS_PER_PAGE (TOP_RATED_LIMIT)
  // so it never needs paging. A normal location search can otherwise return hundreds of results in
  // a dense metro area, which is what this actually guards against.
  const totalPages = ratedSort ? 1 : Math.max(1, Math.ceil(primaryResults.length / SEARCH_RESULTS_PER_PAGE));
  const page = Math.min(Math.max(parseInt(searchParams.page ?? "", 10) || 1, 1), totalPages);
  const pagedResults = ratedSort
    ? primaryResults
    : primaryResults.slice((page - 1) * SEARCH_RESULTS_PER_PAGE, page * SEARCH_RESULTS_PER_PAGE);

  // Rebuilds the current search URL with just the page number changed — keeps every other filter
  // (location, radius, types, sort, openNow, kind) intact when moving between pages.
  function pageHref(target: number) {
    const qs = new URLSearchParams();
    qs.set("q", q);
    qs.set("radius", String(radius));
    if (types.length) qs.set("types", types.join(","));
    if (ratedSort) qs.set("sort", "rating");
    if (openNow) qs.set("openNow", "1");
    if (gender) qs.set("gender", gender);
    if (kind !== "all") qs.set("kind", kind);
    if (target > 1) qs.set("page", String(target));
    return `/search?${qs.toString()}`;
  }

  // No location entered yet (or it didn't resolve) — this is the state landed on from the
  // homepage's "Browse Cuddlers" link. Show a nationwide showcase instead of a dead end.
  const browse = !origin ? await browseTopCuddlers(kind) : null;

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
            {ratedSort ? (
              <>
                Top {results.length < TOP_RATED_LIMIT ? results.length : `${TOP_RATED_LIMIT}`}{" "}
                <span className="font-medium text-ink">{types.join(", ") || "rated"}</span> cuddlers near{" "}
                <span className="font-medium text-ink">{origin.label}</span>, by client reviews
              </>
            ) : (
              <>
                {primaryResults.length} {kindNoun}
                {primaryResults.length === 1 ? "" : "s"} within {radius} miles of{" "}
                <span className="font-medium text-ink">{origin.label}</span>
                {types.length > 0 && (
                  <>
                    {" "}offering <span className="font-medium text-ink">{types.join(", ")}</span>
                  </>
                )}
                {gender && (
                  <>
                    {" "}· <span className="font-medium text-ink">{gender}</span>
                  </>
                )}
                {openNow && <> · <span className="font-medium text-ink">open now</span></>}
              </>
            )}
          </p>
          {primaryResults.length === 0 ? (
            <div className="card mt-4 max-w-xl p-6">
              <h2 className="font-display text-lg font-semibold">No listings here yet</h2>
              <p className="mt-2 text-sm text-stone2">
                {ratedSort
                  ? "No one nearby has enough reviews for this yet — check back soon, or browse all listings for this service."
                  : `Try widening the radius${types.length > 0 ? ", removing a cuddle type filter," : ""}${openNow ? ", turning off Open Now," : ""}${kind !== "all" ? ", switching Cuddlers/Agencies above," : ""} or searching a nearby city.`}
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

          {/* Cross-promotion for the type the user filtered out — shown regardless of whether the
              primary list came up empty, since a "Agencies Only" search with zero agencies nearby is exactly
              when surfacing nearby cuddlers is most useful. Capped at 5, not paginated. */}
          {kind !== "all" && crossResults.length > 0 && (
            <div className="mt-10 border-t border-line pt-8">
              <h2 className="font-display text-lg font-semibold">
                You Might Also Like{kind === "solo" ? " These Agencies" : " These Cuddle Professionals"}
              </h2>
              <ul className="mt-4 grid gap-4">
                {crossResults.map((r) => (
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
            </div>
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
async function browseTopCuddlers(kind: "all" | "solo" | "agency"): Promise<{ vip: BrowseEntry[]; rated: BrowseEntry[] }> {
  const conditions = [eq(cuddlers.published, true), eq(cuddlers.subStatus, "active")];
  if (kind !== "all") conditions.push(eq(cuddlers.accountType, kind));
  const candidates = await db
    .select()
    .from(cuddlers)
    .where(and(...conditions));

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
