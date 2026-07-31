export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Find Me Cuddle";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// --- Legal (Privacy Policy / Terms of Service) ---
// Consolidated to one inbox (2026-07-25): everything, legal requests included, funnels to the same
// support address rather than a separate privacy@ inbox, since it's one person checking both.
export const LEGAL_CONTACT_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL || "support@findmecuddle.com";
// Not yet a formed LLC/corporation as of this draft — update once one exists.
export const LEGAL_ENTITY = SITE_NAME;
export const LEGAL_STATE = "California";

// --- Support ---
// Where the /contact form sends messages (see sendSupportEmail in lib/email.ts).
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@findmecuddle.com";
export const CONTACT_SUBJECT_OPTIONS: string[] = [
  "General Question",
  "Account Or Billing",
  "Report A Problem",
  "Partnership Or Press",
  "Other",
];
export const CONTACT_BODY_MAX_CHARS = 2000;

// --- Personal/business website link (admin-reviewed, see schema.ts comment on websiteUrl) ---
export const WEBSITE_URL_MAX_CHARS = 200;

// --- Social profile links (not admin-reviewed, see schema.ts comment on socialLinks) ---
export const SOCIAL_PLATFORMS: string[] = ["Instagram", "TikTok", "X"];
export const SOCIAL_LINKS_MAX = 4;
export const SOCIAL_URL_MAX_CHARS = 200;

// --- "Send My Info" inquiry form (see /api/inquiries) ---
export const INQUIRY_MESSAGE_MAX_CHARS = 500;
export const LOCATION_TYPE_OPTIONS: { value: "incall" | "outcall"; label: string }[] = [
  { value: "incall", label: "In-Studio (At Their Place)" },
  { value: "outcall", label: "Outcall (At My Place)" },
];
// Same labels as RATE_DURATIONS above, kept as a separate plain-string list since an inquiry's
// requested duration isn't tied to a specific priced column the way a listing's own rates are.
export const DURATION_OPTIONS: string[] = ["30 min", "60 min", "90 min", "2 hours+"];

// --- Flagging a client's phone number or email from the dashboard message list (see actions.ts's
// reportContact and flagSeverityFor) ---
// A short pick-list instead of a free-text box — keeps entries consistent and avoids cuddlers
// accidentally typing something identifying (a name, an address) into a field that gets stored.
// "Other" reveals a short free-text field capped at FLAG_REASON_MAX_CHARS (see reportContact).
export const REPORT_REASONS: string[] = [
  "No Show / Flaked",
  "Fake Money / Didn't Pay",
  "Scam",
  "Chargeback",
  "Extremely Aggressive / Rude",
  "Harassment",
  "Asked For Anything Illegal",
  "Threatening Behavior",
  "Other",
];
export const FLAG_REASON_MAX_CHARS = 300;
// Report-count thresholds for the yellow -> red severity escalation shown on a flagged contact —
// see flagSeverityFor() in actions.ts and MessagesCard.tsx.
export const FLAG_YELLOW_AT = 1;
export const FLAG_RED_AT = 2;

// --- AI-generated photo detection (see lib/aiDetection.ts + the "Flagged Photos" admin queue) ---
// A photo scoring at or above this (0-1 confidence from Sightengine's genai model) gets queued for
// admin review. The photo still goes live immediately either way — this never blocks an upload,
// only flags it. 0.85 is a deliberately high bar: false positives (a real photo wrongly flagged)
// are just an extra row in your review queue, but a low threshold would flood that queue with
// legitimate photos (professional headshots/studio lighting can look "too clean" to these models).
export const AI_PHOTO_FLAG_THRESHOLD = 0.85;

// A photo scoring at or above this (0-1 confidence from Sightengine's nudity-2.1 model, see
// lib/aiDetection.ts) for suggestive/revealing content also gets queued for the same review queue.
// Kept slightly lower than the AI threshold since false positives here are still just an extra row
// to glance at, and the cost of missing a genuinely inappropriate photo is higher than the cost of
// missing an AI-generated one.
export const AI_PHOTO_SUGGESTIVE_THRESHOLD = 0.7;

// --- "Ready to post" social queue (see admin/page.tsx + lib/socialCaption.ts) ---
// How many pending entries the admin "Ready To Post" queue shows at once.
export const SOCIAL_QUEUE_LIMIT = 30;

// --- Newsletter (new local cuddlers near you) ---
// How wide a net the digest script casts around each subscriber's location — see
// scripts/send-newsletter.ts. Wider than the default search radius since this is a low-frequency
// email, not a live search, so it's fine to cover more ground.
export const NEWSLETTER_RADIUS_MILES = 50;

// How long one boost activation lasts (and how soon after it can be triggered again) — set to a
// full day so a boost credit reads as "$1-2 for a day featured," matching the pricing model. Each
// activation spends 1 credit (see boostListing in actions.ts); credits come free with VIP
// (VIP_BOOST_GRANT below) or are purchased in packs via STRIPE_CREDIT_PACKS (see creditPacks()
// below) — price those packs at roughly $1-2 per credit to land on the $1-2/day boost pricing.
export const BOOST_COOLDOWN_HOURS = 24;
// How long a manual "I'm Open Now" activation lasts (see isManuallyOpen() in lib/hours.ts).
export const MANUAL_OPEN_NOW_HOURS = 6;
// Optional promo line shown with the "Featured" badge while a boost is active — e.g.
// "Today! 20% Off For Returning Clients!"
export const BOOST_MESSAGE_MAX_CHARS = 100;
// How long a listing shows a "New" badge on the public page and search cards, from signup date.
export const NEW_LISTING_DAYS = 30;

/** Vacation pause auto-expires after this many days — listing and billing both resume automatically. */
export const VACATION_PAUSE_DAYS = 7;
export const DEFAULT_RADIUS_MILES = 25;

// --- Pre-filled text message (tap "Send a text" on a listing) ---
// Blanks are intentional — the client fills them in before hitting send in their own texting app.
export const SMS_TEMPLATE =
  `Hi, my name is ____ and I saw your ad on ${SITE_NAME}. I'd love to schedule a ____ minute cuddle session!`;

// --- Photo uploads ---
export const STANDARD_MAX_PHOTOS = 3;
export const VIP_MAX_PHOTOS = 6; // Monthly VIP perk — see isVip()/photoLimit() in lib/stripe.ts
export const MAX_PHOTO_MB = 8;
// "HD" = 720p minimum on the shorter check dimension. Raise to 1920x1080 for a Full HD floor.
export const HD_MIN_WIDTH = 1280;
export const HD_MIN_HEIGHT = 720;
// Uploaded photos are re-encoded and capped at this size (still well above the HD floor).
export const PHOTO_MAX_DIMENSION = 2400;

// --- Weekly hours ---
// dayOfWeek follows JS Date#getDay() (0=Sun..6=Sat); display order starts on Monday.
export const WEEK_DAYS: { day: number; label: string }[] = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 0, label: "Sunday" },
];

// --- Rates ---
// Session durations shown on the create-ad page. Each duration has three possible states, all
// stored in the same nullable integer column (rate30/60/90/120Plus in schema.ts) — no separate
// column needed:
//   null              -> left blank, shown publicly as RATE_CONTACT_LABEL ("Contact Me")
//   RATE_NOT_OFFERED  -> cuddler explicitly checked "I don't offer this" — the row is hidden
//                        entirely from the public listing (see cuddlers/[slug]/page.tsx)
//   a real number      -> shown as "$N"
export const RATE_DURATIONS: { key: "rate30" | "rate60" | "rate90" | "rate120Plus"; label: string }[] = [
  { key: "rate30", label: "30 min" },
  { key: "rate60", label: "60 min" },
  { key: "rate90", label: "90 min" },
  { key: "rate120Plus", label: "2 hours+" },
];
export const RATE_CONTACT_LABEL = "Contact Me";
// Sentinel stored in a rate column to mean "I don't offer this duration at all" — distinct from
// null, which means "no price set yet, show Contact Me." Any code reading a rate column for
// display/min/max math must exclude this value (rate == null || rate === RATE_NOT_OFFERED).
export const RATE_NOT_OFFERED = -1;

// --- Gender (optional — see the `gender` comment on both cuddlers and agencyEmployees in
// lib/schema.ts). Shown on listings and usable as a search filter (see nearbySearch.ts). ---
export const GENDER_OPTIONS: { value: "male" | "female"; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

// --- Services ---
// Checklist on the create-ad page. Cuddlers can also add anything not listed via a free-text
// "other" field. These are the standard platonic, non-sexual comfort-touch session styles used by
// professional cuddle therapy practitioners (see the certification bodies referenced in
// VerificationForm.tsx) — every listing and Terms of Service is explicit that this is non-sexual.
export const CUDDLE_TYPES: string[] = [
  "Big Spoon / Little Spoon",
  "Face-To-Face Embrace",
  "Hand Holding & Conversation",
  "Head Scratches / Head In Lap",
  "Back Rubs (Non-Cuddle)",
  "Breathwork & Cuddling",
  "Comfort & Grief Support",
  "Platonic Snuggling",
  "Movie Cuddle Session",
  "Nap Session",
  "Group Cuddle",
  "Mobile Cuddle Session",
];

// --- Amenities & add-ons ---
// Checklist on the create-ad page, separate from session type (a service you offer vs. an
// extra your space/session includes). Same free-text "other" pattern as services.
export const AMENITIES: string[] = [
  "Weighted Blanket",
  "Fireplace",
  "Movie / TV Available",
  "Soft Music",
  "Aromatherapy",
  "Herbal Tea",
  "Cozy Couch Setup",
  "Pet-Friendly Space",
  "Free Parking",
  "Wheelchair Accessible",
];

// --- Payment methods accepted ---
export const PAYMENT_METHODS: string[] = ["Cash", "Venmo", "Zelle", "Cash App", "Apple Pay", "Google Pay"];

// --- Discounts & promotions ---
export const DISCOUNT_TYPES: string[] = [
  "First-Time Client Discount",
  "Military Discount",
  "Student Discount",
  "Senior Discount",
  "Referral Discount",
  "Package Deal",
];

// --- Identity verification (license + government ID, required before publish) ---
export const VERIFICATION_MAX_MB = 8;

// --- Reviews & reports ---
export const REVIEW_BODY_MAX_CHARS = 1000;
export const REPORT_BODY_MAX_CHARS = 500;
export const REPORT_MAX_PHOTOS = 3;

// --- "Top rated" by service type (clicking a service tag on a listing) ---
export const TOP_RATED_LIMIT = 10; // how many results to show

// How many cards a normal location search shows per page before a "Next" link appears (see
// /search) — keeps a big metro area from dumping hundreds of cards onto one screen. Doesn't apply
// to "Top rated" mode, which is already capped lower (TOP_RATED_LIMIT above).
export const SEARCH_RESULTS_PER_PAGE = 20;
// A cuddler needs at least one approved review to appear at all. Beyond that, ranking uses a
// weighted score (not a raw average) so one lucky 5-star review can't outrank someone with dozens
// of consistently strong reviews — the classic "IMDb weighted rating" approach:
//   score = (n / (n + CONFIDENCE_M)) * avgRating + (CONFIDENCE_M / (n + CONFIDENCE_M)) * PRIOR_RATING
export const RATING_CONFIDENCE_M = 3;
export const RATING_PRIOR = 4.0;

export const PLANS = [
  { key: "standard", label: "Standard", priceId: () => process.env.STRIPE_PRICE_STANDARD || "" },
  { key: "vip", label: "VIP", priceId: () => process.env.STRIPE_PRICE_VIP || "" },
  // Agency plans (accountType === "agency" only — see isAgencyAccount() in lib/stripe.ts). Reuse the exact
  // same /api/checkout + webhook + dashboard "Listing Plan" machinery as the solo plans above since
  // both just key off PLANS — no separate checkout path needed. See AGENCY_PLAN_KEYS below for the
  // filter that keeps these out of a solo cuddler's plan picker (and vice versa).
  { key: "small_agency", label: "Small Agency", priceId: () => process.env.STRIPE_PRICE_SMALL_AGENCY || "" },
  { key: "large_agency", label: "Large Agency", priceId: () => process.env.STRIPE_PRICE_LARGE_AGENCY || "" },
] as const;

export type PlanKey = (typeof PLANS)[number]["key"];

// Button/option copy for a plan key — separate from PLANS[].label above (which is used for
// shorter references like "Subscribed to Monthly") since a couple of these read better as full
// sentences on a button ("VIP - Monthly Listing"). Shared by the dashboard's Listing Plan card and
// the setup wizard's plan step (see dashboard/page.tsx and SetupWizard.tsx) so they never drift.
export const PLAN_BUTTON_LABELS: Record<string, string> = {
  standard: "Standard Listing",
  vip: "VIP Listing",
  small_agency: "Small Agency (1-3 People)",
  large_agency: "Large Agency (4-8 People)",
};

// --- Agency Ads (accountType === "agency") ---
// Two tiers by team size, not by feature set — every agency gets the same roster/photo/hours tooling,
// just capped at a different headcount. See agencyEmployeeLimit() in lib/stripe.ts.
export const AGENCY_PLAN_KEYS: PlanKey[] = ["small_agency", "large_agency"];
export const AGENCY_EMPLOYEE_LIMITS: Partial<Record<PlanKey, number>> = {
  small_agency: 3,
  large_agency: 8,
};

// --- VIP perks (VIP plan only) ---
export const VIP_PLAN_KEY: PlanKey = "vip";
export const VIP_BOOST_GRANT = 10; // credits added each paid VIP billing cycle
export const VIP_MAX_LOCATIONS = 2; // vs. 1 for Standard

// --- Instagram feed (homepage) ---
// No API key needed — uses Instagram's public oEmbed script. Paste post URLs here as you post them.
export const INSTAGRAM_HANDLE = "findmecuddle";
export const INSTAGRAM_POST_URLS: string[] = [
  // "https://www.instagram.com/p/XXXXXXXXXXX/",
];

// --- X (Twitter) follow button (homepage) ---
// Leave blank until an X account exists — the homepage only shows this button once it's set.
export const X_HANDLE = process.env.NEXT_PUBLIC_X_HANDLE || "";

/** Parses STRIPE_CREDIT_PACKS="price_abc:5,price_def:12" */
export function creditPacks(): { priceId: string; credits: number }[] {
  return (process.env.STRIPE_CREDIT_PACKS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [priceId, credits] = pair.split(":");
      return { priceId, credits: parseInt(credits, 10) || 0 };
    })
    .filter((p) => p.priceId && p.credits > 0);
}

// --- SEO city/region landing pages (/cuddlers-near/[area] (not built yet in this v1)) + homepage "Popular Cities" ---
// A curated list rather than one auto-generated from arbitrary URL text, on purpose — it keeps
// every indexed page tied to a real, deliberately-chosen market instead of letting Google index a
// thin/duplicate page for every possible city name someone could type into a URL. Add a new metro
// here once you're actively targeting it (see NEXT_STEPS.md).
//
// `query` is what gets passed to resolveLocation() in lib/geo.ts to find the anchor lat/lng — for
// an actual city this is just "City, ST". Counties aren't real cities the zip database can look
// up, so those use a representative anchor city (e.g. the county seat) with a wider `radius` to
// still cover the surrounding area. `label` is what's actually shown to people, so it can say
// "Orange County, CA" even though the underlying query resolves to Santa Ana.
export type TargetArea = { slug: string; label: string; query: string; radius?: number };

export const TARGET_AREAS: TargetArea[] = [
  { slug: "los-angeles-ca", label: "Los Angeles, CA", query: "Los Angeles, CA", radius: 30 },
  { slug: "orange-county-ca", label: "Orange County, CA", query: "Santa Ana, CA", radius: 30 },
  { slug: "ventura-county-ca", label: "Ventura County, CA", query: "Ventura, CA", radius: 30 },
  { slug: "san-diego-ca", label: "San Diego, CA", query: "San Diego, CA", radius: 25 },
  { slug: "san-francisco-ca", label: "San Francisco, CA", query: "San Francisco, CA", radius: 25 },
  { slug: "san-jose-ca", label: "San Jose, CA", query: "San Jose, CA", radius: 25 },
  { slug: "sacramento-ca", label: "Sacramento, CA", query: "Sacramento, CA" },
  { slug: "dallas-tx", label: "Dallas, TX", query: "Dallas, TX" },
  { slug: "houston-tx", label: "Houston, TX", query: "Houston, TX" },
  { slug: "austin-tx", label: "Austin, TX", query: "Austin, TX" },
  { slug: "new-york-ny", label: "New York, NY", query: "New York, NY", radius: 25 },
  { slug: "orlando-fl", label: "Orlando, FL", query: "Orlando, FL" },
  { slug: "miami-fl", label: "Miami, FL", query: "Miami, FL" },
  { slug: "tampa-fl", label: "Tampa, FL", query: "Tampa, FL" },
  { slug: "chicago-il", label: "Chicago, IL", query: "Chicago, IL" },
  { slug: "atlanta-ga", label: "Atlanta, GA", query: "Atlanta, GA" },
  { slug: "phoenix-az", label: "Phoenix, AZ", query: "Phoenix, AZ" },
  { slug: "seattle-wa", label: "Seattle, WA", query: "Seattle, WA" },
  { slug: "denver-co", label: "Denver, CO", query: "Denver, CO" },
  { slug: "boston-ma", label: "Boston, MA", query: "Boston, MA" },
  { slug: "las-vegas-nv", label: "Las Vegas, NV", query: "Las Vegas, NV" },
  { slug: "philadelphia-pa", label: "Philadelphia, PA", query: "Philadelphia, PA" },
  { slug: "washington-dc", label: "Washington, DC", query: "Washington, DC", radius: 25 },
];
