import Stripe from "stripe";
import { VIP_PLAN_KEY, STANDARD_MAX_PHOTOS, VIP_MAX_PHOTOS, VIP_MAX_LOCATIONS, NEW_LISTING_DAYS, BOOST_COOLDOWN_HOURS, VACATION_PAUSE_DAYS, AGENCY_EMPLOYEE_LIMITS } from "./config";

// Lazy init so builds don't require a key.
let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  }
  return _stripe;
}

/**
 * A listing is visible in search when published + subscription active + not expired
 * + an admin has approved the cuddle license AND Stripe Identity has verified the
 * cuddler's government ID against a live selfie + they aren't currently on a vacation pause.
 */
export function isLive(t: {
  published: boolean;
  subStatus: string;
  activeUntil: Date | null;
  verificationStatus: string;
  identityStatus: string;
  pausedAt: Date | null;
  suspendedAt: Date | null;
}) {
  return (
    t.published &&
    t.subStatus === "active" &&
    (!t.activeUntil || t.activeUntil.getTime() > Date.now()) &&
    t.verificationStatus === "approved" &&
    t.identityStatus === "verified" &&
    !isPaused(t) &&
    !isSuspended(t)
  );
}

/**
 * True whenever an admin has suspended the account for a Terms of Service violation — no
 * auto-expiry, cleared only by an explicit unsuspendCuddler() call. See the schema.ts comment
 * on `suspendedAt` for the full pattern (same as isPaused()/isBoosted() below).
 */
export function isSuspended(t: { suspendedAt: Date | null }) {
  return !!t.suspendedAt;
}

/**
 * True only while a vacation pause is actively in effect (within VACATION_PAUSE_DAYS of when it
 * was set) — this is the single source of truth for pause-gating, same pattern as isBoosted()
 * below. `pausedAt` is never cleared by an expiry, only by an explicit resumeListing() call (see
 * actions.ts), so anything reading it directly instead of through this helper will incorrectly
 * treat an expired pause as still active. The listing (and, via Stripe's resumes_at, billing)
 * both come back automatically once this window passes, even if the cuddler never manually hits
 * "Resume."
 */
export function isPaused(t: { pausedAt: Date | null }) {
  return !!t.pausedAt && Date.now() - t.pausedAt.getTime() < VACATION_PAUSE_DAYS * 86_400_000;
}

/**
 * True once BOTH the license has been admin-approved AND Stripe Identity has verified the
 * cuddler's government ID + selfie — shown as a "Verified" badge.
 */
export function isVerified(t: { verificationStatus: string; identityStatus: string }) {
  return t.verificationStatus === "approved" && t.identityStatus === "verified";
}

/** Monthly VIP perks (extra photos, second location, free boosts) are gated on an active VIP subscription. */
export function isVip(t: { plan: string | null; subStatus: string }) {
  return t.plan === VIP_PLAN_KEY && t.subStatus === "active";
}

/** A business account with a team roster (see agencyEmployees in schema.ts) rather than a single
 *  cuddler's own rates/services — chosen once at signup, see accountType's comment in schema.ts. */
export function isAgencyAccount(t: { accountType: string }) {
  return t.accountType === "agency";
}

/** How many team members a agency account can currently add — 0 until they've actually subscribed to
 *  one of the two agency plans (small_agency/large_agency), same "gated on the live plan, not just intent"
 *  pattern as photoLimit()/locationLimit() below. */
export function agencyEmployeeLimit(t: { plan: string | null; subStatus: string }) {
  if (t.subStatus !== "active" || !t.plan) return 0;
  return AGENCY_EMPLOYEE_LIMITS[t.plan as keyof typeof AGENCY_EMPLOYEE_LIMITS] ?? 0;
}

export function photoLimit(t: { plan: string | null; subStatus: string }) {
  return isVip(t) ? VIP_MAX_PHOTOS : STANDARD_MAX_PHOTOS;
}

export function locationLimit(t: { plan: string | null; subStatus: string }) {
  return isVip(t) ? VIP_MAX_LOCATIONS : 1;
}

/** Shows a "New" badge on the public page and search cards for the first NEW_LISTING_DAYS after signup. */
export function isNewListing(t: { createdAt: Date }) {
  return Date.now() - t.createdAt.getTime() < NEW_LISTING_DAYS * 86_400_000;
}

/**
 * True only while a boost is actively in effect (within BOOST_COOLDOWN_HOURS of the last boost) —
 * this is the single source of truth for the "Featured" badge and boosted-tier search ranking.
 * A cuddler's `boostedAt` timestamp is never cleared after use (see boostListing in actions.ts),
 * so anything reading it directly instead of through this helper will incorrectly treat old,
 * expired boosts as still active.
 */
export function isBoosted(t: { boostedAt: Date | null }) {
  return !!t.boostedAt && Date.now() - t.boostedAt.getTime() < BOOST_COOLDOWN_HOURS * 3600_000;
}

/**
 * True once an admin has approved a cuddler's current photo set for content (full-face shot,
 * no AI-generated images, a workspace/agency photo — see the guidance text on the dashboard).
 * Separate from identity verification (license/ID) — a listing can be "live" while its photos are
 * still pending review; public pages just fall back to the initial-letter placeholder until then.
 */
export function photosApproved(t: { photosStatus: string }) {
  return t.photosStatus === "approved";
}

/**
 * True once an admin has approved the cuddler's personal/business website link — same "manual
 * review before it's ever shown publicly" pattern as photosApproved() above. Also requires the URL
 * itself still be present, since a rejected/cleared link could otherwise leave a stale "approved"
 * status with nothing to point at.
 */
export function websiteApproved(t: { websiteStatus: string; websiteUrl: string | null }) {
  return t.websiteStatus === "approved" && !!t.websiteUrl;
}
