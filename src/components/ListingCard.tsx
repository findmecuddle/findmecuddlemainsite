import Link from "next/link";
import { Crown, Zap, Check } from "lucide-react";
import type { Cuddler } from "@/lib/schema";
import { isVip, isNewListing, isBoosted, isVerified, photosApproved } from "@/lib/stripe";

export default function ListingCard({
  cuddler: t,
  distance,
  city,
  state,
  avgRating,
  reviewCount,
  openNow,
}: {
  cuddler: Cuddler;
  /** Omitted on location-less browse lists (e.g. the homepage "Browse Cuddlers" page). */
  distance?: number;
  /** Whichever of the cuddler's locations matched this search — falls back to their primary location. */
  city?: string;
  state?: string;
  /** Only passed in "top rated" mode (sort=rating) — see search/page.tsx. */
  avgRating?: number;
  reviewCount?: number;
  /** Computed by findNearbyCuddlers — undefined wherever hours weren't fetched (e.g. the
   *  nationwide browse list), which we treat the same as "don't show the badge". */
  openNow?: boolean;
}) {
  const boosted = isBoosted(t);
  const vip = isVip(t);
  const isNew = isNewListing(t);
  const showPhoto = photosApproved(t) && !!t.photoUrl;
  // Manually-cropped card thumbnail if an admin has set one (see admin/crop-photo) — otherwise the
  // full photo, auto-cropped to this square by CSS object-cover below.
  const cardPhoto = t.cardPhotoUrl || t.photoUrl;
  const rateLabel = t.hourlyRate != null ? `$${t.hourlyRate}/hr` : null;

  // Boosted (gold) always wins — it's the temporary, paid-per-use spotlight.
  // VIP (spruce) is the persistent perk, shown only when a listing isn't currently boosted.
  const accent = boosted ? "border-l-[3px] border-l-gold" : vip ? "border-l-[3px] border-l-spruce" : "";

  return (
    <Link
      href={`/cuddlers/${t.slug}`}
      className={`card relative flex gap-4 p-4 transition-colors hover:border-spruce sm:p-5 ${accent}`}
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-spruce-tint sm:h-24 sm:w-24">
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardPhoto!} alt={t.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-2xl text-spruce">
            {t.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-lg font-semibold">{t.name}</h3>
          <span className="text-xs text-stone2">
            {city ?? t.city}, {state ?? t.state}
            {distance != null && <> · {distance.toFixed(1)} mi</>}
          </span>
          {t.accountType === "agency" ? (
            <span className="badge-pill border border-line bg-porcelain text-ink">Agency</span>
          ) : (
            t.gender && (
              <span className="badge-pill border border-line bg-porcelain text-ink">
                {t.gender === "female" ? "Female" : "Male"}
              </span>
            )
          )}
          {boosted && (
            <span className="badge-pill bg-gradient-to-r from-gold to-[#8a6a2c] text-white">
              <Zap className="h-3 w-3 shrink-0 fill-white" strokeWidth={2.5} />
              Featured
            </span>
          )}
          {!boosted && vip && (
            <span className="badge-pill bg-gradient-to-r from-spruce-deep to-spruce text-white">
              <Crown className="h-3 w-3 shrink-0 text-gold" strokeWidth={2.5} />
              VIP
            </span>
          )}
          {isVerified(t) && (
            <span className="badge-pill bg-blue-50 text-blue-700">
              <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
              Verified
            </span>
          )}
          {openNow && (
            <span className="badge-pill bg-emerald-50 text-emerald-700">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              Available Now
            </span>
          )}
          {isNew && (
            <span className="badge-pill bg-emerald-600 text-white">New</span>
          )}
          {reviewCount != null && reviewCount > 0 && (
            <span className="text-xs text-stone2">
              <span className="text-gold">★</span> {avgRating!.toFixed(1)} ({reviewCount})
            </span>
          )}
        </div>
        {boosted && t.boostMessage && (
          <p className="mt-1 flex items-center gap-1 truncate text-sm font-medium text-gold">
            <Zap className="h-3.5 w-3.5 shrink-0 fill-gold" strokeWidth={2.5} />
            {t.boostMessage}
          </p>
        )}
        {t.headline && (
          <p className="mt-1 truncate font-display text-[15px] italic text-ink/80">&ldquo;{t.headline}&rdquo;</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone2">
          {t.hosts && <span className="rounded-full border border-line bg-porcelain px-2.5 py-0.5">Hosts</span>}
          {t.mobile && <span className="rounded-full border border-line bg-porcelain px-2.5 py-0.5">Mobile</span>}
          {rateLabel && (
            <span className="ml-auto rounded-full bg-spruce-tint px-3 py-1.5 text-sm font-bold text-spruce">
              {rateLabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
