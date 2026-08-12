import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { createId } from "./id";

export const cuddlers = sqliteTable(
  "cuddlers",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    // Short, sequential, human-friendly ID shown on the dashboard as "Listing ID: FMM-000123" —
    // separate from the internal `id` above (which is a long random string, fine as a primary key
    // but not something you'd want to read out loud). Assigned once at signup, see actions.ts.
    memberNumber: integer("member_number").notNull().default(0),
    email: text("email").notNull().unique(),
    // Login credentials now live in Clerk, not here — passwordHash is legacy/unused going forward
    // (kept nullable rather than dropped so we don't need a risky column-drop migration on SQLite).
    // clerkUserId is the only thing that ties a Clerk account back to this row; see lib/auth.ts.
    passwordHash: text("password_hash"),
    clerkUserId: text("clerk_user_id").unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    // "solo" = an individual cuddler (the original model, every row before this column existed).
    // "agency" = a business account with a roster of team members (see agencyEmployees below) managed
    // from one owner login — chosen once at signup (see OnboardingForm.tsx) and never changed
    // after, since it drives which Stripe plans the dashboard offers (small_agency/large_agency vs.
    // standard/vip — see AGENCY_PLAN_KEYS in lib/config.ts) and which dashboard/public
    // page sections render (team roster vs. rates/services — see isAgencyAccount() in lib/stripe.ts).
    // NOTE: hidden from signup as of the v1 launch decision (see OnboardingForm.tsx) — no new
    // agency accounts can be created, but this column and all its backing code stay in place in
    // case it's turned back on later. See README "What's different" section.
    accountType: text("account_type").notNull().default("solo"), // solo | agency

    // Ad content
    headline: text("headline"),
    bio: text("bio"),
    // Optional — blank by default, never required. Shown on the public profile/listing card so
    // clients who have a comfort preference can see it at a glance, and usable as a search filter
    // (see nearbySearch.ts). See GENDER_OPTIONS in lib/config.ts.
    gender: text("gender"), // null | "male" | "female"
    photoUrl: text("photo_url"),
    photoW: integer("photo_w"),
    photoH: integer("photo_h"),
    // Optional manually-cropped square version of photoUrl, used only for the small "card" thumbnail
    // on ListingCard and the homepage Boosted/VIP/New grids (see admin/crop-photo). Lets an admin fix
    // an awkward auto-crop on the card without touching the full photo shown on the public profile
    // page — photoUrl above is never modified by cropping. Null until an admin crops it; falls back
    // to an automatic center-crop of photoUrl (CSS object-cover) until then.
    cardPhotoUrl: text("card_photo_url"),
    photoUrl2: text("photo_url_2"),
    photoW2: integer("photo_w_2"),
    photoH2: integer("photo_h_2"),
    photoUrl3: text("photo_url_3"),
    photoW3: integer("photo_w_3"),
    photoH3: integer("photo_h_3"),
    // Slots 4-6 are a Monthly VIP perk (see VIP_MAX_PHOTOS in lib/config.ts) — unused by other plans.
    photoUrl4: text("photo_url_4"),
    photoW4: integer("photo_w_4"),
    photoH4: integer("photo_h_4"),
    photoUrl5: text("photo_url_5"),
    photoW5: integer("photo_w_5"),
    photoH5: integer("photo_h_5"),
    photoUrl6: text("photo_url_6"),
    photoW6: integer("photo_w_6"),
    photoH6: integer("photo_h_6"),
    phone: text("phone"),
    contactEmail: text("contact_email"),
    // Photo content — no admin review step anymore (removed; every upload already passes through
    // HD validation/re-encoding/EXIF-stripping in /api/photos, which was the real safeguard).
    // Set straight to "approved" on upload, "none" once every photo slot is empty again. Kept as a
    // status column rather than a plain boolean so photosApproved() (lib/stripe.ts) — used to gate
    // whether a photo shows publicly — didn't need to change, and so old "pending"/"rejected" rows
    // from before this change don't silently start showing an unreviewed photo.
    photosStatus: text("photos_status").notNull().default("none"), // none | approved (legacy: pending | rejected)
    photosNote: text("photos_note"), // legacy: admin rejection note, unused going forward

    // Optional link to the cuddler's own personal or business website. Manually reviewed before
    // it's ever shown publicly — same reasoning as the license/photo checks above, we don't want to
    // implicitly vouch for an arbitrary third-party destination we haven't looked at. Resets to
    // "pending" whenever the URL changes (see updateListing in actions.ts), so a previously-approved
    // link can't be silently swapped for something else without another review. Rendered with
    // rel="nofollow noopener noreferrer" on the public page (see websiteApproved() in lib/stripe.ts),
    // and the Terms of Service disclaims responsibility for linked-site content — see the
    // "Third-party links" section in terms/page.tsx.
    websiteUrl: text("website_url"),
    websiteStatus: text("website_status").notNull().default("none"), // none | pending | approved | rejected
    websiteNote: text("website_note"), // admin note, e.g. rejection reason

    // Up to SOCIAL_LINKS_MAX (see lib/config.ts) social profile links — Instagram, TikTok, or X.
    // JSON-encoded array of { platform, url } (see lib/socialLinks.ts), one column rather than
    // numbered slot columns since it's always read/written as a whole unit, same reasoning as
    // agencyEmployees.hoursJson below. Deliberately NOT admin-reviewed like websiteUrl above — a
    // narrower, lower-risk set of known platforms (vs. an arbitrary personal website URL), so these
    // go live immediately when a cuddler adds or edits them.
    socialLinks: text("social_links"),

    // Which contact methods a cuddler has actually opted into showing on their public profile —
    // independent toggles even though Phone Call and Text share the same `phone` number. At least
    // one of the three (or messagesOnly below) must be on — enforced in applyListingUpdate.
    acceptsCalls: integer("accepts_calls", { mode: "boolean" }).notNull().default(false),
    acceptsTexts: integer("accepts_texts", { mode: "boolean" }).notNull().default(false),
    acceptsEmail: integer("accepts_email", { mode: "boolean" }).notNull().default(false),
    // A 4th, mutually-exclusive contact option: no phone/email shown publicly at all, just the
    // "Send My Info" form on the profile — every inquiry through it is already checked against
    // flaggedContacts (see MessagesCard.tsx), so this is a privacy-first option for cuddlers who'd
    // rather not expose a number/email but still want every first contact screened. When true,
    // applyListingUpdate forces acceptsCalls/acceptsTexts/acceptsEmail off regardless of what's
    // submitted, and the public page hides the phone/email buttons entirely.
    // Nullable rather than notNull(): this was added after real cuddlers already existed in
    // production, and a NOT NULL column with no default forces drizzle-kit to either abort or
    // truncate the whole table when added to a non-empty table. Nullable means SQLite just backfills
    // existing rows with NULL, which is a safe no-op migration — every read site already treats
    // null/undefined the same as false (see ListingForm.tsx's `!!t.messagesOnly` and the plain
    // truthiness check on the public page), so this has no behavioral difference from notNull.
    messagesOnly: integer("messages_only", { mode: "boolean" }).default(false),
    // "Gatekeeping" — on by default. When true and hours are set (see cuddlerHours above),
    // Call/Text buttons only render during those hours; outside them, visitors see Email/Send My
    // Info instead (see isOpenNow() in lib/hours.ts and the cuddlers/[slug] profile page). A
    // cuddler can turn this off from the Hours card on their dashboard if they want to be
    // reachable by call/text anytime regardless of their posted hours.
    gatekeepHours: integer("gatekeep_hours", { mode: "boolean" }).notNull().default(true),
    // Manual "I'm Open Now" override — a cuddler with no hours listed (or who's just stepping
    // outside their posted hours for a bit) can press a button on their dashboard to flip on the
    // Open Now badge/search filter for MANUAL_OPEN_NOW_HOURS (see lib/config.ts), same
    // "timestamp, never cleared, checked through a time-window helper" pattern as boostedAt —
    // see isManuallyOpen() in lib/hours.ts.
    openNowActivatedAt: integer("open_now_activated_at", { mode: "timestamp_ms" }),
    // Legacy: cuddle-type checklist, amenities, payment methods, discounts — removed from the
    // dashboard/public page as of the "getting to know you" redesign (2026-08-05). Left in place,
    // nullable and unused going forward, rather than dropped, to avoid a SQLite column-drop
    // migration — same pattern as passwordHash/idKey elsewhere in this table.
    services: text("services"), // comma-separated
    amenities: text("amenities"), // comma-separated
    paymentMethods: text("payment_methods"), // comma-separated
    discounts: text("discounts"), // comma-separated
    // Legacy: per-session rates by duration. Superseded by hourlyRate/virtualHourlyRate below —
    // left in place, unused going forward, same reasoning as the legacy fields just above.
    rate30: integer("rate_30"),
    rate60: integer("rate_60"),
    rate90: integer("rate_90"),
    rate120Plus: integer("rate_120_plus"),
    // A single flat hourly rate for an in-person cuddle session — replaces the old per-duration
    // rate table above. Null = "Contact Me" on the public page, same convention as before.
    hourlyRate: integer("hourly_rate"),
    // Whether this cuddler also offers virtual (video call) sessions, and if so, at what hourly
    // rate. virtualHourlyRate is only ever read/shown when offersVirtual is true — null there means
    // "Contact Me" for virtual sessions specifically, independent of the in-person rate above.
    offersVirtual: integer("offers_virtual", { mode: "boolean" }).notNull().default(false),
    virtualHourlyRate: integer("virtual_hourly_rate"),
    mobile: integer("mobile", { mode: "boolean" }).notNull().default(false),

    // --- "Getting to know you" — a personality/lifestyle profile shown on the public listing so
    // clients get a sense of who they'd actually be spending time with, not just session logistics.
    // Every field here is optional free text (or a short pick-list where noted) and only ever shown
    // on the public page when filled in — see the "Getting To Know Me" section in
    // cuddlers/[slug]/page.tsx and the corresponding form section in dashboard/ListingForm.tsx.
    favoriteFood: text("favorite_food"),
    favoriteAnimal: text("favorite_animal"),
    enjoysPets: text("enjoys_pets"), // "Yes" | "No" | "It Depends" | null — see ENJOYS_PETS_OPTIONS in lib/config.ts
    allergies: text("allergies"),
    favoriteMusic: text("favorite_music"), // artist or band
    favoriteActivities: text("favorite_activities"), // "favorite things to do"
    favoriteMovie: text("favorite_movie"),
    favoriteShow: text("favorite_show"),
    enjoysAboutCuddling: text("enjoys_about_cuddling"), // "what they enjoy about cuddling"
    activeLifestyle: text("active_lifestyle"), // see ACTIVE_LIFESTYLE_OPTIONS in lib/config.ts
    height: text("height"), // free text, e.g. 5'8" — formats vary too much for a clean dropdown
    bodyType: text("body_type"), // see BODY_TYPE_OPTIONS in lib/config.ts
    hairColor: text("hair_color"), // see HAIR_COLOR_OPTIONS in lib/config.ts
    eyeColor: text("eye_color"), // see EYE_COLOR_OPTIONS in lib/config.ts

    // Location (primary)
    address: text("address"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    zip: text("zip").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),

    // Location (second, optional)
    city2: text("city_2"),
    state2: text("state_2"),
    zip2: text("zip_2"),
    lat2: real("lat_2"),
    lng2: real("lng_2"),

    // Boosts
    credits: integer("credits").notNull().default(0),
    boostedAt: integer("boosted_at", { mode: "timestamp_ms" }),
    // Optional short promo line set when activating a boost (e.g. "Today! 20% Off For Returning
    // Clients!") — shown alongside the "Featured" badge while the boost is active. Capped at
    // BOOST_MESSAGE_MAX_CHARS in lib/config.ts. Not cleared automatically when the boost expires —
    // isBoosted()/the "Featured" badge gate whether it's actually shown, so a stale message just
    // sits unused until the next boost overwrites it.
    boostMessage: text("boost_message"),

    // Subscription
    stripeCustomerId: text("stripe_customer_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: text("plan"), // standard | vip | small_agency | large_agency
    subStatus: text("sub_status").notNull().default("none"), // none | active | past_due | canceled
    activeUntil: integer("active_until", { mode: "timestamp_ms" }),
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    // Set when a cuddler requests cancellation from their dashboard (see cancelSubscription() in
    // actions.ts) — schedules the Stripe subscription to end at the current period's close
    // (cancel_at_period_end) rather than cutting them off immediately, matching the refund policy
    // in terms/page.tsx ("stops future billing but does not refund the current billing period").
    // subStatus stays "active" and the listing stays live until the period actually ends (at which
    // point the customer.subscription.deleted webhook sets subStatus to "canceled"). Cleared either
    // by undoCancelSubscription() (they change their mind before the period ends) or automatically
    // on their next invoice.paid (a fresh resubscribe shouldn't carry over a stale flag).
    cancelRequestedAt: integer("cancel_requested_at", { mode: "timestamp_ms" }),

    // Vacation pause — cuddler-controlled, auto-expires after VACATION_PAUSE_DAYS (see
    // lib/config.ts) even if they never manually resume. While active, the listing is hidden from
    // search/public view (see isLive()/isPaused() in lib/stripe.ts) and, if they have an active
    // subscription, Stripe billing is paused too (pause_collection with resumes_at set to match).
    // Independent of `published` — a cuddler might toggle publish/unpublish separately. Never
    // cleared by the expiry itself, only by an explicit resumeListing() call — same pattern as
    // boostedAt, see isBoosted()'s comment in lib/stripe.ts.
    pausedAt: integer("paused_at", { mode: "timestamp_ms" }),

    // Admin suspension — an admin can immediately take a listing offline for a Terms of Service
    // violation (e.g. actioning a report), independent of subscription/verification/pause state.
    // Unlike vacation pause, this has no auto-expiry and isn't cuddler-controlled — only an
    // explicit unsuspendCuddler() call by an admin clears it (see admin/actions.ts). Billing is
    // left untouched (the subscription keeps running) since a suspension is a conduct/content
    // hold, not a cancellation decision. Gated via isSuspended()/isLive() in lib/stripe.ts — same
    // "never read the raw field directly" pattern as pausedAt/boostedAt above.
    suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
    suspensionNote: text("suspension_note"), // admin-entered reason, shown to the cuddler on their dashboard

    // Cuddle certification review — REMOVED as a go-live requirement (cuddle therapy isn't
    // state-licensed, so this was carryover from findmemassage's real license-verification gate
    // and never meant anything here). isLive()/isVerified() in lib/stripe.ts no longer read
    // verificationStatus at all. Columns are kept, frozen, rather than dropped — same
    // "no SQLite migration needed" call as photosStatus/photosNote in admin/actions.ts. Nothing
    // writes to these anymore; VerificationForm.tsx, /api/verification, and the admin cert-review
    // queue were all deleted.
    verificationStatus: text("verification_status").notNull().default("none"), // frozen, unused
    licenseKey: text("license_key"), // frozen, unused
    licenseNotRequired: integer("license_not_required", { mode: "boolean" }).notNull().default(false), // frozen, unused
    idKey: text("id_key"), // legacy: old manual government-ID upload, superseded by Stripe Identity below
    verificationNote: text("verification_note"), // frozen, unused
    verificationSubmittedAt: integer("verification_submitted_at", { mode: "timestamp_ms" }), // frozen, unused
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }), // frozen, unused

    // Identity verification (government ID + live selfie match) — automated via Stripe Identity,
    // no admin review needed. This is now the only verification gate in isLive()/isVerified()
    // (see lib/stripe.ts).
    identityStatus: text("identity_status").notNull().default("none"), // none | pending | verified | failed
    identitySessionId: text("identity_session_id"), // Stripe Identity VerificationSession id
    identityVerifiedAt: integer("identity_verified_at", { mode: "timestamp_ms" }),

    // Marketing consent — cuddler opts in to let us use their listing info/photos on our own
    // social media and marketing. Off by default; never assumed.
    socialMediaOptIn: integer("social_media_opt_in", { mode: "boolean" }).notNull().default(false),
    // Set by an admin from the "Ready To Post" queue on /admin once they've actually posted this
    // listing to social media themselves (see markSocialPosted() in admin/actions.ts) — never
    // cleared, so a listing only ever shows up in that queue once, the same "one-shot, tracked
    // with a timestamp" pattern as photoshootRequestedAt below. Nothing posts automatically; this
    // is purely a manual checklist so the same listing isn't suggested twice.
    socialPostedAt: integer("social_posted_at", { mode: "timestamp_ms" }),
    // Monthly VIP perk: a free photoshoot + short video for social media. Request is just a lead
    // for a real-world scheduling conversation, not an in-app booking system.
    photoshootRequestedAt: integer("photoshoot_requested_at", { mode: "timestamp_ms" }),
    photoshootContacted: integer("photoshoot_contacted", { mode: "boolean" }).notNull().default(false),

    // Legacy password reset columns — unused since login moved to Clerk (Clerk handles reset
    // itself now). Left in place rather than dropped to avoid a SQLite column-drop migration.
    resetTokenHash: text("reset_token_hash"),
    resetTokenExpiresAt: integer("reset_token_expires_at", { mode: "timestamp_ms" }),

    // Marketing email consent — separate from socialMediaOptIn (using their photos/listing on our
    // social channels) and from the required ToS/Privacy checkbox. Off by default, real opt-in
    // only; marketingOptInAt is kept as a timestamped record of consent.
    marketingOptIn: integer("marketing_opt_in", { mode: "boolean" }).notNull().default(false),
    marketingOptInAt: integer("marketing_opt_in_at", { mode: "timestamp_ms" }),

    // Set once, the first time this listing ever satisfies isLive() (published + active sub +
    // verified + not paused/suspended) — see checkGoLive() in lib/activity.ts. Purely a one-shot
    // flag so a "go_live" system event only gets logged the first time, not on every later read;
    // never cleared again even if the listing later goes offline and back on.
    wentLiveAt: integer("went_live_at", { mode: "timestamp_ms" }),

    // Set once, when a cuddler clicks "Finish Setup" on the last step of the guided setup wizard
    // (see SetupWizard.tsx + completeSetup() in actions.ts) — independent of wentLiveAt above,
    // since going fully live also depends on admin approval timing that's outside the cuddler's
    // control, and they shouldn't be stuck in the wizard waiting on that. dashboard/page.tsx shows
    // the wizard instead of the normal dashboard whenever both this AND wentLiveAt are still null —
    // that condition also makes every pre-existing account that's already gone live automatically
    // skip the wizard with no backfill needed, since wentLiveAt was already set for them.
    setupCompletedAt: integer("setup_completed_at", { mode: "timestamp_ms" }),

    // Set once, when a cuddler checks the "everything I'm publishing is true" attestation on the
    // wizard's Ad step (see SetupWizard.tsx + attestListing() in actions.ts). This used to be local
    // React state only (useState, never saved) — that broke as soon as anything on that step sends
    // the browser away and back (Subscribe posts to /api/checkout -> Stripe Checkout -> redirected
    // back to /dashboard; Identity verification does the same via Stripe Identity's hosted flow).
    // Either round trip fully remounts SetupWizard, which reset the local checkbox state to
    // unchecked, made the Ad step's isComplete flip back to false, and sent firstIncomplete all the
    // way back to step 0 -- exactly the "pushed me back to the start" bug this column fixes.
    listingAttestedAt: integer("listing_attested_at", { mode: "timestamp_ms" }),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    liveIdx: index("cuddlers_live_idx").on(t.published, t.subStatus),
    geoIdx: index("cuddlers_geo_idx").on(t.lat, t.lng),
    geoIdx2: index("cuddlers_geo_idx_2").on(t.lat2, t.lng2),
  })
);

// One row per open time block, up to HOUR_BLOCKS_PER_DAY (lib/config.ts) blocks per day — lets a
// cuddler post a gap in the middle of a day (e.g. 9-10am, then 11am-1pm) instead of one single
// open/close range. Only actual open blocks get a row; a day with zero rows is simply closed, so
// there's no separate "closed" flag to keep in sync — see applyHoursUpdate in lib/listingUpdate.ts.
export const cuddlerHours = sqliteTable(
  "cuddler_hours",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    cuddlerId: text("cuddler_id")
      .notNull()
      .references(() => cuddlers.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sun .. 6=Sat (JS Date#getDay convention)
    blockIndex: integer("block_index").notNull().default(0), // 0 .. HOUR_BLOCKS_PER_DAY-1
    // Legacy: every row used to represent a whole day (one row per day, closed=true meaning no
    // hours set). Now every row is an actual open block (closed is always false going forward) —
    // kept rather than dropped to avoid a SQLite column-drop migration.
    closed: integer("closed", { mode: "boolean" }).notNull().default(false),
    openTime: text("open_time").notNull(), // "HH:MM", 24h
    closeTime: text("close_time").notNull(), // "HH:MM", 24h
  },
  (t) => ({
    dayIdx: index("cuddler_hours_day_idx").on(t.cuddlerId, t.dayOfWeek),
  })
);

// A agency account's roster of team members (see accountType above) — one photo, one set of cuddle
// types, and one weekly hours grid per employee, all managed by the agency owner from their single
// dashboard login (no separate employee logins — see the "Employee logins" decision this feature
// was built around). Deliberately does NOT get its own public URL or search listing; employees
// only ever show up bundled together on their agency's own /cuddlers/[slug] page — see the "Our
// Team" section there. Every employee's cuddle types roll up into the parent cuddlers.services
// column (see syncAgencyServices in app/actions.ts) so the existing search type-filter keeps working
// unmodified — search matches the agency's own row, never an individual employee.
export const agencyEmployees = sqliteTable(
  "agency_employees",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    cuddlerId: text("cuddler_id")
      .notNull()
      .references(() => cuddlers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    photoUrl: text("photo_url"),
    photoW: integer("photo_w"),
    photoH: integer("photo_h"),
    // Optional, same as the solo cuddler field above — see GENDER_OPTIONS in lib/config.ts.
    gender: text("gender"), // null | "male" | "female"
    services: text("services"), // comma-separated — same CUDDLE_TYPES list as a solo cuddler
    // JSON-encoded weekly hours ({day, closed, openTime, closeTime}[], see lib/employeeHours.ts) —
    // a plain text column rather than a whole second hours table, since it's always read/written as
    // one complete unit (a single employee's full week) and never queried day-by-day the way the
    // agency's own cuddler_hours rows are.
    hoursJson: text("hours_json"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    cuddlerIdx: index("agency_employees_cuddler_idx").on(t.cuddlerId),
  })
);

export const creditEvents = sqliteTable(
  "credit_events",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    cuddlerId: text("cuddler_id")
      .notNull()
      .references(() => cuddlers.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(), // +N purchase, -1 boost
    reason: text("reason").notNull(), // "purchase:<sessionId>" | "boost" | "grant"
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    ledgerIdx: index("credit_events_ledger_idx").on(t.cuddlerId, t.createdAt),
  })
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    cuddlerId: text("cuddler_id")
      .notNull()
      .references(() => cuddlers.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    authorEmail: text("author_email"), // private — for follow-up only, never shown publicly
    rating: integer("rating").notNull(), // 1-5
    body: text("body").notNull(),
    sessionType: text("session_type"), // "studio" | "mobile" | null (reviewer didn't say)
    status: text("status").notNull().default("pending"), // pending | approved | denied
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    cuddlerIdx: index("reviews_cuddler_idx").on(t.cuddlerId, t.status),
  })
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    cuddlerId: text("cuddler_id")
      .notNull()
      .references(() => cuddlers.id, { onDelete: "cascade" }),
    reporterEmail: text("reporter_email"), // private, optional — for follow-up only
    body: text("body").notNull(), // capped at REPORT_BODY_MAX_CHARS server-side
    // Despite the "Url" name (kept as-is to avoid a schema migration), these store PRIVATE
    // storage keys, not public URLs — report evidence can contain sensitive material, so it's
    // uploaded via uploadPrivateObject and only ever served through the admin-authorized
    // /api/admin/report-evidence route (same pattern as the license photo), never a direct link.
    photoUrl1: text("photo_url_1"),
    photoUrl2: text("photo_url_2"),
    photoUrl3: text("photo_url_3"),
    status: text("status").notNull().default("pending"), // pending | actioned | dismissed
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    statusIdx: index("reports_status_idx").on(t.status),
  })
);

export const admins = sqliteTable(
  "admins",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    // "super" can add/remove other admins; "staff" can moderate but not manage the team.
    role: text("role").notNull().default("staff"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  }
);

export const adminAuditLog = sqliteTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    adminId: text("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    // Snapshot of the admin's name at the time of the action, so the log stays readable even if
    // that admin account is later removed.
    adminName: text("admin_name").notNull(),
    action: text("action").notNull(), // e.g. "approve_review", "reject_verification", "create_admin"
    targetType: text("target_type"), // "review" | "report" | "verification" | "photoshoot" | "admin"
    targetId: text("target_id"),
    detail: text("detail"), // human-readable extra context (cuddler name, rejection note, etc.)
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    logIdx: index("admin_audit_log_idx").on(t.createdAt),
  })
);

// System-triggered events (signup completed, listing went live) — distinct from admin_audit_log
// above, which only records actions an admin took from the moderation panel. Shown merged
// together with admin_audit_log on /admin/activity so there's one place to see everything that
// happened. See lib/activity.ts for how entries get written.
export const systemEvents = sqliteTable(
  "system_events",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    type: text("type").notNull(), // "signup" | "go_live" | "cancel_requested"
    cuddlerId: text("cuddler_id")
      .notNull()
      .references(() => cuddlers.id, { onDelete: "cascade" }),
    // Snapshot of the name at the time of the event, so the log stays readable even if the
    // cuddler later renames their listing or the account is deleted (row cascades away, but any
    // export/backup taken before that still reads fine).
    cuddlerName: text("cuddler_name").notNull(),
    detail: text("detail"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    logIdx: index("system_events_idx").on(t.createdAt),
  })
);

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    // Where they want to hear about new cuddlers — resolved once at signup, same geo lookup as
    // the search bar (see resolveLocation in lib/geo.ts).
    city: text("city").notNull(),
    state: text("state").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    // Required checkbox at signup — never assumed. consentAt is a timestamped record of it.
    consent: integer("consent", { mode: "boolean" }).notNull().default(false),
    consentAt: integer("consent_at", { mode: "timestamp_ms" }),
    // Random token embedded in the unsubscribe link in every digest email — lets someone
    // unsubscribe with one click, no login needed (see /api/newsletter/unsubscribe).
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    // Set after each digest send — the next digest only includes cuddlers who joined after this,
    // so the same new listing is never emailed twice. Null until the first digest goes out.
    lastNotifiedAt: integer("last_notified_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    geoIdx: index("newsletter_geo_idx").on(t.lat, t.lng),
  })
);

// "Send My Info" submissions (see /api/inquiries + components/SendInfoForm.tsx) — previously only
// emailed to the cuddler and never stored. Now persisted so a cuddler can see every request in
// one place on their dashboard (handy for after-hours messages, which is the main path into this
// form — see the gatekeepHours comment on cuddlers below), while still also emailing them
// immediately so nothing depends on someone remembering to check the dashboard.
export const inquiries = sqliteTable(
  "inquiries",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    cuddlerId: text("cuddler_id")
      .notNull()
      .references(() => cuddlers.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone"),
    clientEmail: text("client_email"),
    message: text("message"), // capped at INQUIRY_MESSAGE_MAX_CHARS server-side
    cuddleType: text("cuddle_type"), // one of CUDDLE_TYPES in lib/config.ts, or null
    // "incall" (at the cuddler's place) | "outcall" (at the client's place) | null (not specified)
    locationType: text("location_type"),
    // Requested appointment slot. If flexible is true, preferredDate/preferredTime are ignored
    // (client checked "Whenever You're Open" instead of picking an exact slot) — see
    // LOCATION_TYPE_OPTIONS/DURATION_OPTIONS in lib/config.ts and SendInfoForm.tsx.
    preferredDate: text("preferred_date"), // "YYYY-MM-DD" from a <input type="date">, or null
    preferredTime: text("preferred_time"), // "HH:MM" from a <input type="time">, or null
    duration: text("duration"), // one of DURATION_OPTIONS' labels, or null
    flexible: integer("flexible", { mode: "boolean" }).notNull().default(false),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    cuddlerIdx: index("inquiries_cuddler_idx").on(t.cuddlerId, t.createdAt),
  })
);

// Lets a cuddler flag a client's phone number OR email (e.g. after a no-show, scam, or
// harassment) so it shows as a warning to OTHER cuddlers too if that same contact messages
// them — a shared, platform-wide signal rather than private per-cuddler notes. Deliberately
// lightweight (no admin moderation gate, unlike reviews/reports above) since it only ever surfaces
// as a severity level (yellow/red) + count inside another cuddler's own private dashboard, never
// publicly, and never with the reporting cuddler's identity, the reason text, or the reported
// client's name attached — see flagSeverityFor() in actions.ts and the "Report A Customer" section
// of MessagesCard.tsx.
export const flaggedContacts = sqliteTable(
  "flagged_contacts",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    contactType: text("contact_type").notNull(), // "phone" | "email"
    // Normalized — digits-only for phone (see normalizePhone), lowercased/trimmed for email (see
    // normalizeEmail) — both in lib/contact.ts, so formatting differences don't cause misses.
    contactValue: text("contact_value").notNull(),
    reportedByCuddlerId: text("reported_by_cuddler_id")
      .notNull()
      .references(() => cuddlers.id, { onDelete: "cascade" }),
    // Kept for the reporting cuddler's own reference only — never shown to any other cuddler
    // (privacy: it could otherwise identify them or their client). Capped at FLAG_REASON_MAX_CHARS.
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    contactIdx: index("flagged_contacts_idx").on(t.contactType, t.contactValue),
  })
);

// A photo that our AI-generated-image detector flagged as suspicious (see lib/aiDetection.ts and
// the POST handlers in api/photos and api/employee-photo). Deliberately NOT a hard gate — the
// photo goes live immediately either way, since automated AI detectors have real false-positive
// rates and blocking a real cuddler's real photo on a bad guess is worse than a brief delay in
// catching a fake one. This table just queues it for a human (admin) to look at and decide,
// mirroring the pendingWebsiteReviews() pattern in admin/actions.ts. A row here is deleted once an
// admin resolves it (dismiss as a false positive, or remove the photo) — see admin/actions.ts.
export const flaggedPhotos = sqliteTable("flagged_photos", {
  id: text("id").primaryKey().$defaultFn(createId),
  cuddlerId: text("cuddler_id")
    .notNull()
    .references(() => cuddlers.id, { onDelete: "cascade" }),
  // Set only when the flagged photo belongs to a agency employee rather than the cuddler/agency
  // account itself — see agencyEmployees below. cuddlerId above is always the owning account either
  // way, so the admin queue can link back to one listing regardless of which photo it was.
  employeeId: text("employee_id").references(() => agencyEmployees.id, { onDelete: "cascade" }),
  // Which of the cuddler's own photo slots (1-6) this was — null when employeeId is set, since
  // an employee has just one photo (see agencyEmployees.photoUrl).
  slot: integer("slot"),
  photoUrl: text("photo_url").notNull(),
  // 0-1 confidence score from the detection API that this image is AI-generated.
  aiScore: real("ai_score").notNull(),
  // 0-1 confidence score that the image is suggestive/revealing (Sightengine's nudity-2.1 model —
  // see lib/aiDetection.ts). Nullable since older rows (before this check existed) won't have one.
  suggestiveScore: real("suggestive_score"),
  // Which check(s) triggered this flag — "ai_generated" | "suggestive" | "ai_generated, suggestive".
  // Nullable (rather than notNull+default) so adding this column to an already-populated table is a
  // safe, non-destructive migration — see the messagesOnly comment on the cuddlers table for why.
  // Old rows read as "ai_generated" in the admin UI, since that was the only check that existed then.
  flagReason: text("flag_reason"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Cuddler = typeof cuddlers.$inferSelect;
export type AgencyEmployee = typeof agencyEmployees.$inferSelect;
export type CreditEvent = typeof creditEvents.$inferSelect;
export type CuddlerHours = typeof cuddlerHours.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type SystemEvent = typeof systemEvents.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type FlaggedContact = typeof flaggedContacts.$inferSelect;
export type FlaggedPhoto = typeof flaggedPhotos.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
