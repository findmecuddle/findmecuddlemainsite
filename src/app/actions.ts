"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { cuddlers, creditEvents, cuddlerHours, agencyEmployees, inquiries, flaggedContacts, appointments } from "@/lib/schema";
import { currentCuddler, currentClerkUserId, clerkEmail } from "@/lib/auth";
import { resolveLocationStrict } from "@/lib/geo";
import { isVip, isAgencyAccount, agencyEmployeeLimit } from "@/lib/stripe";
import { logSignup, checkGoLive, logCancelRequested } from "@/lib/activity";
import { applyListingUpdate, applyHoursUpdate } from "@/lib/listingUpdate";
import { buildEmployeeHoursJson } from "@/lib/employeeHours";
import { normalizePhone, normalizeEmail } from "@/lib/phone";
import {
  BOOST_COOLDOWN_HOURS,
  BOOST_MESSAGE_MAX_CHARS,
  WEEK_DAYS,
  VACATION_PAUSE_DAYS,
  FLAG_REASON_MAX_CHARS,
  FLAG_YELLOW_AT,
  FLAG_RED_AT,
  DURATION_OPTIONS,
} from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { deleteObject, keyFromPublicUrl } from "@/lib/storage";
import { deleteCuddlerAccount } from "@/lib/deleteAccount";

// ---------- Auth ----------
// Login/signup credentials, sessions, and password reset are all handled by Clerk now (see
// /login, /signup, middleware.ts, lib/auth.ts). The one thing that still lives here is turning a
// brand-new Clerk account into an actual cuddler listing — see completeOnboarding() below.

export async function completeOnboarding(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const userId = await currentClerkUserId();
  if (!userId) redirect("/login");

  // Already has a listing (e.g. they hit back/refresh after finishing) — don't create a second one.
  const already = await currentCuddler();
  if (already) redirect("/dashboard");

  const name = String(formData.get("name") || "").trim();
  const locationText = String(formData.get("location") || "").trim();

  if (!name) return { error: "Name is required." };
  if (formData.get("agreeToTerms") !== "on") {
    return { error: "You must agree to the Terms of Service and Privacy Policy to create an account." };
  }
  if (formData.get("ageConfirm") !== "on") {
    return { error: "You must confirm you are 18 years of age or older to create an account." };
  }

  const loc = resolveLocationStrict(locationText);
  if (!loc) return { error: "Enter a 5-digit zip code, or your city and state (e.g. Austin, TX)." };

  const email = await clerkEmail(userId);
  if (!email) return { error: "Couldn't read your account email — try signing in again." };

  // Guards against the rare case of a leftover row from before this Clerk migration, or someone
  // signing up twice with the same email under two different Clerk accounts.
  const existing = await db.select({ id: cuddlers.id }).from(cuddlers).where(eq(cuddlers.email, email)).limit(1);
  if (existing.length) return { error: "An account with that email already exists." };

  const [city, stateZip] = loc.label.split(",").map((s) => s.trim());
  const [state, zipMaybe] = (stateZip || "").split(/\s+/);

  const marketingOptIn = formData.get("marketingOptIn") === "on";
  const referredBy = String(formData.get("referredBy") || "").trim() || null;
  // Chosen once here and never changed after — see accountType's comment in schema.ts. Anything
  // other than the literal "agency" value is treated as "solo", so a tampered/missing field can't
  // accidentally create a agency account.
  const accountType = formData.get("accountType") === "agency" ? "agency" : "solo";

  // Next sequential Listing ID (FMM-000123 on the dashboard). Not perfectly race-safe under
  // simultaneous signups, but fine at this scale — see memberNumber comment in schema.ts.
  const [{ maxNumber }] = await db
    .select({ maxNumber: sql<number>`COALESCE(MAX(${cuddlers.memberNumber}), 0)` })
    .from(cuddlers);

  const slug = await uniqueSlug(name);
  const [created] = await db
    .insert(cuddlers)
    .values({
      clerkUserId: userId,
      memberNumber: maxNumber + 1,
      email,
      name,
      slug,
      accountType,
      city,
      state: state || "",
      zip: zipMaybe || locationText.match(/\b\d{5}\b/)?.[0] || "",
      lat: loc.lat,
      lng: loc.lng,
      marketingOptIn,
      marketingOptInAt: marketingOptIn ? new Date() : null,
      referredBy,
    })
    .returning({ id: cuddlers.id });

  await logSignup(created.id, name);
  redirect("/dashboard");
}

// ---------- Change password (while logged in) ----------

export async function changePassword(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: string }> {
  const me = await currentCuddler();
  if (!me || !me.clerkUserId) return { error: "You're not signed in." };

  const currentPw = String(formData.get("currentPassword") || "");
  const newPw = String(formData.get("newPassword") || "");
  const confirmPw = String(formData.get("confirmNewPassword") || "");

  if (!newPw || !confirmPw) return { error: "All fields are required." };
  if (newPw.length < 8) return { error: "New password must be at least 8 characters." };
  if (newPw !== confirmPw) return { error: "New passwords don't match." };
  if (newPw === currentPw) return { error: "New password must be different from your current one." };

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(me.clerkUserId);

  // Google-only accounts have no password yet — nothing to verify, this call sets the first one.
  if (clerkUser.passwordEnabled) {
    if (!currentPw) return { error: "Enter your current password." };
    try {
      await clerk.users.verifyPassword({ userId: me.clerkUserId, password: currentPw });
    } catch {
      return { error: "Current password is incorrect." };
    }
  }

  await clerk.users.updateUser(me.clerkUserId, { password: newPw });
  return { ok: "Password updated." };
}

// ---------- Delete account ----------

// Fulfills the CCPA deletion right already promised in /privacy. See deleteCuddlerAccount() in
// lib/deleteAccount.ts for what actually gets cleaned up (billing, storage, Clerk login, DB row) —
// shared with the admin-side "Delete This Account" action in admin/actions.ts.
export async function deleteAccount(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const me = await currentCuddler();
  if (!me || !me.clerkUserId) return { error: "You're not signed in." };

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(me.clerkUserId);

  // Google-only accounts have no password — the DELETE confirmation text below is the only gate.
  if (clerkUser.passwordEnabled) {
    const password = String(formData.get("password") || "");
    try {
      await clerk.users.verifyPassword({ userId: me.clerkUserId, password });
    } catch {
      return { error: "Incorrect password." };
    }
  }
  if (formData.get("confirmText") !== "DELETE") {
    return { error: 'Type "DELETE" to confirm.' };
  }

  await deleteCuddlerAccount(me);
  redirect("/account-deleted");
}

// ---------- Vacation pause ----------
// Cuddler-controlled, auto-expires after VACATION_PAUSE_DAYS — hides the listing from
// search/public view and pauses Stripe billing (if subscribed) so they aren't charged while away.
// Both the listing and billing come back on their own once the window passes (Stripe via
// resumes_at below, the listing via isPaused()'s time check in lib/stripe.ts) — no manual action
// required, though resumeListing() below lets them end it early.

export async function pauseListing() {
  const me = await currentCuddler();
  if (!me) return;

  const resumesAt = Math.floor((Date.now() + VACATION_PAUSE_DAYS * 86_400_000) / 1000);

  if (me.stripeSubscriptionId) {
    try {
      await stripe().subscriptions.update(me.stripeSubscriptionId, {
        pause_collection: { behavior: "void", resumes_at: resumesAt },
      });
    } catch {
      // Billing pause failed (already canceled, Stripe unreachable, etc.) — still pause the
      // listing itself, which is the part the cuddler is actually asking for.
    }
  }

  await db.update(cuddlers).set({ pausedAt: new Date() }).where(eq(cuddlers.id, me.id));
  revalidatePath("/dashboard");
}

export async function resumeListing() {
  const me = await currentCuddler();
  if (!me) return;

  if (me.stripeSubscriptionId) {
    try {
      await stripe().subscriptions.update(me.stripeSubscriptionId, { pause_collection: null });
    } catch {
      // Nothing to resume, or Stripe unreachable — still resume the listing itself.
    }
  }

  await db.update(cuddlers).set({ pausedAt: null }).where(eq(cuddlers.id, me.id));
  await checkGoLive(me.id);
  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);
}

// ---------- Manual "I'm Open Now" ----------
// Lets a cuddler flip on the Open Now badge/search filter themselves for MANUAL_OPEN_NOW_HOURS
// (see lib/config.ts) — useful for anyone who hasn't posted hours at all, or who's just stepping
// outside their posted hours for a bit. See isManuallyOpen() in lib/hours.ts for how this gets
// read back; openNowActivatedAt itself is never cleared, only overwritten by the next press.

export async function activateOpenNow() {
  const me = await currentCuddler();
  if (!me) return;
  await db.update(cuddlers).set({ openNowActivatedAt: new Date() }).where(eq(cuddlers.id, me.id));
  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);
}

// ---------- Publish toggle ----------
// A one-click flip of cuddlers.published, separate from the big Edit Your Ad form (see
// ListingForm.tsx and the "published" comment in listingUpdate.ts) — publishing shouldn't require
// re-saving the whole listing, and re-saving the listing shouldn't accidentally publish/unpublish
// it either. checkGoLive logs the first real go-live the same way applyListingUpdate already does.
export async function togglePublished() {
  const me = await currentCuddler();
  if (!me) return;
  await db.update(cuddlers).set({ published: !me.published }).where(eq(cuddlers.id, me.id));
  await checkGoLive(me.id);
  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);
}

// ---------- Guided setup wizard ----------
// A brand-new cuddler sees a step-by-step setup flow instead of the full dashboard until they
// click "Finish Setup" on its last step (see SetupWizard.tsx) — deliberately not gated on actually
// being live yet (that also depends on admin approval timing outside their control). See the
// setupCompletedAt comment in schema.ts for how dashboard/page.tsx decides who sees the wizard.
export async function completeSetup() {
  const me = await currentCuddler();
  if (!me) return;
  if (!me.setupCompletedAt) {
    await db.update(cuddlers).set({ setupCompletedAt: new Date() }).where(eq(cuddlers.id, me.id));
  }
  revalidatePath("/dashboard");
}

// Persists the wizard's Ad-step attestation ("everything I'm publishing is true...") so it
// survives a full page remount — see the listingAttestedAt comment in schema.ts for why this can't
// just be local React state. Idempotent/one-shot like completeSetup() above: once attested, stays
// attested.
export async function attestListing() {
  const me = await currentCuddler();
  if (!me) return;
  if (!me.listingAttestedAt) {
    await db.update(cuddlers).set({ listingAttestedAt: new Date() }).where(eq(cuddlers.id, me.id));
  }
  revalidatePath("/dashboard");
}

// ---------- Cancel subscription ----------
// Distinct from deleteAccount() above — that ends billing immediately and erases everything.
// This schedules the subscription to end at the close of the current billing period (matching the
// refund policy in terms/page.tsx: cancel anytime, stops future billing, no refund for the current
// period), keeps the listing live until then, and captures why they're leaving. Reversible via
// undoCancelSubscription() below, right up until the period actually ends.

export async function cancelSubscription(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: string }> {
  const me = await currentCuddler();
  if (!me) redirect("/login");
  if (!me.stripeSubscriptionId || me.subStatus !== "active") {
    return { error: "You don't have an active subscription to cancel." };
  }
  if (me.cancelRequestedAt) return { ok: "Your cancellation is already scheduled." };

  const reason = String(formData.get("reason") || "").trim();
  const reasonDetail = String(formData.get("reasonDetail") || "").trim();
  if (!reason) return { error: "Please select a reason." };
  const fullReason = reasonDetail ? `${reason} — ${reasonDetail}` : reason;

  try {
    await stripe().subscriptions.update(me.stripeSubscriptionId, { cancel_at_period_end: true });
  } catch {
    return { error: "Couldn't reach Stripe to cancel your subscription — try again in a moment." };
  }

  await db.update(cuddlers).set({ cancelRequestedAt: new Date() }).where(eq(cuddlers.id, me.id));
  await logCancelRequested(me.id, me.name, fullReason);
  revalidatePath("/dashboard");

  return {
    ok: me.activeUntil
      ? `Your subscription will end on ${me.activeUntil.toLocaleDateString()}. You'll keep full access until then, and you won't be charged again.`
      : "Your subscription is set to cancel at the end of your current billing period.",
  };
}

export async function undoCancelSubscription() {
  const me = await currentCuddler();
  if (!me || !me.cancelRequestedAt) return;

  if (me.stripeSubscriptionId) {
    try {
      await stripe().subscriptions.update(me.stripeSubscriptionId, { cancel_at_period_end: false });
    } catch {
      // Stripe unreachable — leave cancelRequestedAt set rather than show "undone" when it isn't;
      // the cuddler can just try the button again.
      return;
    }
  }

  await db.update(cuddlers).set({ cancelRequestedAt: null }).where(eq(cuddlers.id, me.id));
  revalidatePath("/dashboard");
}

// Password reset now lives entirely inside Clerk's <SignIn> component on /login — nothing to do
// here anymore. /forgot-password and /reset-password are redirect stubs (see those page files).

async function uniqueSlug(name: string) {
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "cuddler";
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = await db.select({ id: cuddlers.id }).from(cuddlers).where(eq(cuddlers.slug, slug)).limit(1);
    if (!hit.length) return slug;
    slug = `${base}-${i}`;
  }
}

// ---------- Listing ----------
// The actual field-by-field validation/update logic lives in lib/listingUpdate.ts, shared with
// the admin "edit on behalf of a cuddler" panel (see admin/actions.ts) — this wrapper's only job
// is resolving + authorizing the *current* cuddler before handing off to it.

export async function updateListing(_prev: unknown, formData: FormData) {
  const me = await currentCuddler();
  if (!me) redirect("/login");
  const result = await applyListingUpdate(me.id, me, formData);
  if (!("error" in result)) revalidatePath("/dashboard");
  return result;
}

// ---------- Hours ----------

export async function updateHours(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: string }> {
  const me = await currentCuddler();
  if (!me) redirect("/login");
  const result = await applyHoursUpdate(me.id, me.slug, formData);
  revalidatePath("/dashboard");
  return result;
}

export async function getHours(cuddlerId: string) {
  const rows = await db
    .select()
    .from(cuddlerHours)
    .where(eq(cuddlerHours.cuddlerId, cuddlerId))
    .orderBy(asc(cuddlerHours.dayOfWeek), asc(cuddlerHours.blockIndex));
  const byDay = new Map<number, typeof rows>();
  for (const r of rows) {
    const list = byDay.get(r.dayOfWeek) ?? [];
    list.push(r);
    byDay.set(r.dayOfWeek, list);
  }
  // Always return one entry per day, in Monday-first display order, even if unsaved yet — each
  // with its list of open blocks (empty array = closed all day).
  return WEEK_DAYS.map(({ day, label }) => ({
    day,
    label,
    blocks: byDay.get(day) ?? [],
  }));
}

// ---------- Boost ----------

export async function boost(formData: FormData) {
  const me = await currentCuddler();
  if (!me) redirect("/login");

  const cooldownMs = BOOST_COOLDOWN_HOURS * 60 * 60 * 1000;
  if (me.boostedAt && Date.now() - me.boostedAt.getTime() < cooldownMs) {
    return { error: `You can boost once every ${BOOST_COOLDOWN_HOURS} hours.` };
  }
  if (me.credits < 1) return { error: "No boost credits left. Buy a pack below." };

  // Optional promo line (e.g. "Today! 20% Off For Returning Clients!") shown with the Featured
  // badge for the life of this boost. Blank clears any leftover message from a previous boost.
  const message = ((formData.get("message") as string) || "").trim().slice(0, BOOST_MESSAGE_MAX_CHARS);

  // Atomic: only decrements if a credit is still there and cooldown holds.
  const updated = await db
    .update(cuddlers)
    .set({ credits: sql`${cuddlers.credits} - 1`, boostedAt: new Date(), boostMessage: message || null })
    .where(and(eq(cuddlers.id, me.id), sql`${cuddlers.credits} >= 1`))
    .returning({ id: cuddlers.id });

  if (!updated.length) return { error: "No boost credits left. Buy a pack below." };

  await db.insert(creditEvents).values({ cuddlerId: me.id, delta: -1, reason: "boost" });

  revalidatePath("/dashboard");
  return { ok: "Boosted! Your ad is now at the top of nearby search results." };
}

// ---------- VIP photoshoot perk ----------

export async function requestPhotoshoot() {
  const me = await currentCuddler();
  if (!me) redirect("/login");
  if (!isVip(me)) return { error: "The photoshoot + video perk is a Monthly VIP benefit." };
  if (me.photoshootRequestedAt) return { error: "You've already requested this — we'll be in touch." };

  await db
    .update(cuddlers)
    .set({ photoshootRequestedAt: new Date(), photoshootContacted: false })
    .where(eq(cuddlers.id, me.id));

  revalidatePath("/dashboard");
  return { ok: "Request sent! We'll reach out to schedule your photoshoot and video." };
}

// ---------- Ledger (dashboard helper) ----------

export async function recentLedger(cuddlerId: string) {
  // Same "this file is a public server action surface" reasoning as listInquiries above — billing
  // history shouldn't be readable by anyone who can call this with someone else's id.
  const me = await currentCuddler();
  if (!me || me.id !== cuddlerId) return [];

  return db
    .select()
    .from(creditEvents)
    .where(eq(creditEvents.cuddlerId, cuddlerId))
    .orderBy(desc(creditEvents.createdAt))
    .limit(8);
}

// ---------- Agency team roster (accountType === "agency" only) ----------
// One owner login manages the whole roster — no separate employee logins (see the "Employee
// logins" decision this feature was built around). Each employee is just profile info (name,
// photo, cuddle types, hours) shown on the agency's own public page, not an individually verified
// or individually searchable listing — see the schema.ts comment on agencyEmployees.

export async function listEmployees(cuddlerId: string) {
  // Employee roster data is shown publicly on the agency's own profile page anyway, so this isn't
  // sensitive, but every export in a "use server" file is independently callable as a server
  // action regardless of which page renders a button for it — same reasoning as listInquiries and
  // recentLedger above, kept here too for consistency rather than as an exception to the pattern.
  const me = await currentCuddler();
  if (!me || me.id !== cuddlerId) return [];

  return db
    .select()
    .from(agencyEmployees)
    .where(eq(agencyEmployees.cuddlerId, cuddlerId))
    .orderBy(asc(agencyEmployees.sortOrder), asc(agencyEmployees.createdAt));
}

/** Recomputes the agency's own cuddlers.services column as the union of every employee's cuddle
 *  types, so the existing search type-filter (which reads a cuddler row's own services column,
 *  see findNearbyCuddlers in lib/nearbySearch.ts) keeps working completely unmodified — it never
 *  needs to know employees exist. Called after every add/edit/remove below. */
async function syncAgencyServices(cuddlerId: string) {
  const rows = await db
    .select({ services: agencyEmployees.services })
    .from(agencyEmployees)
    .where(eq(agencyEmployees.cuddlerId, cuddlerId));
  const all = new Set<string>();
  for (const r of rows) {
    (r.services ?? "").split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => all.add(s));
  }
  await db
    .update(cuddlers)
    .set({ services: all.size ? Array.from(all).join(", ") : null })
    .where(eq(cuddlers.id, cuddlerId));
}

/** Handles both add (no employeeId submitted) and edit (employeeId present) — one form, one
 *  action, same pattern as the rest of the dashboard. Employee count is capped by whichever agency
 *  plan is currently active (see agencyEmployeeLimit in lib/stripe.ts), checked only on add so an
 *  already-over-limit roster (e.g. after downgrading plans) can still be edited, just not grown. */
export async function saveEmployee(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: string }> {
  const me = await currentCuddler();
  if (!me) redirect("/login");
  if (!isAgencyAccount(me)) return { error: "Only agency accounts can manage a team." };

  const employeeId = String(formData.get("employeeId") || "").trim() || null;
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Enter a name." };

  const services = String(formData.get("servicesText") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .join(", ") || null;
  const hoursJson = buildEmployeeHoursJson(formData);
  const rawGender = String(formData.get("gender") || "");
  const gender = rawGender === "male" || rawGender === "female" ? rawGender : null;

  if (employeeId) {
    const [existing] = await db.select().from(agencyEmployees).where(eq(agencyEmployees.id, employeeId)).limit(1);
    if (!existing || existing.cuddlerId !== me.id) return { error: "Team member not found." };
    await db.update(agencyEmployees).set({ name, services, hoursJson, gender }).where(eq(agencyEmployees.id, employeeId));
  } else {
    const limit = agencyEmployeeLimit(me);
    if (limit === 0) return { error: "Subscribe to a Agency plan below to add team members." };
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(agencyEmployees)
      .where(eq(agencyEmployees.cuddlerId, me.id));
    if (count >= limit) return { error: `Your plan allows up to ${limit} team members. Upgrade to add more.` };
    await db.insert(agencyEmployees).values({ cuddlerId: me.id, name, services, hoursJson, gender });
  }

  await syncAgencyServices(me.id);
  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);
  return { ok: "Team member saved." };
}

export async function removeEmployee(formData: FormData) {
  const me = await currentCuddler();
  if (!me) return;
  const employeeId = String(formData.get("employeeId") || "");
  if (!employeeId) return;

  const [existing] = await db.select().from(agencyEmployees).where(eq(agencyEmployees.id, employeeId)).limit(1);
  if (!existing || existing.cuddlerId !== me.id) return;

  if (existing.photoUrl) {
    const key = keyFromPublicUrl(existing.photoUrl);
    if (key) deleteObject(key).catch(() => {});
  }
  await db.delete(agencyEmployees).where(eq(agencyEmployees.id, employeeId));
  await syncAgencyServices(me.id);
  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);
}

// ---------- Dashboard message list (see MessagesCard.tsx + /api/inquiries) ----------

export type FlagSeverity = "none" | "yellow" | "red";

/** 0 reports -> "none", 1 -> "yellow", 2+ -> "red" — see FLAG_YELLOW_AT/FLAG_RED_AT in
 *  lib/config.ts. Kept as one shared function so the dashboard message list and the standalone
 *  "Report A Customer" lookup always agree on what counts as which color. Deliberately NOT
 *  exported — every export from a "use server" file must be an async Server Action, and this is a
 *  plain sync helper. Keep this internal; if another file needs it, wrap it in an async function. */
function flagSeverity(count: number): FlagSeverity {
  if (count >= FLAG_RED_AT) return "red";
  if (count >= FLAG_YELLOW_AT) return "yellow";
  return "none";
}

/** Looks up report counts for a batch of (already-normalized) phone/email values in one query
 *  each, keyed as "phone:<value>" / "email:<value>" so a phone and an email that happen to share
 *  digits/text never collide. Used by both listInquiries and reportContact below.
 *
 *  Reports count toward the yellow/red severity permanently — no expiry window. Deliberate product
 *  decision (2026-07-25): a report should never quietly stop counting just because time passed, so
 *  a client who's been reported once stays flagged for as long as the report exists. Admin can
 *  still remove an individual report via the Flagged Contact Search tool on /admin if it's disputed
 *  or found to be invalid — see searchFlaggedContacts/adminDeleteFlaggedContact in admin/actions.ts. */
async function flagCountsFor(phones: string[], emails: string[]) {
  const counts = new Map<string, number>();
  if (phones.length > 0) {
    const rows = await db
      .select({ value: flaggedContacts.contactValue, count: sql<number>`COUNT(*)` })
      .from(flaggedContacts)
      .where(and(eq(flaggedContacts.contactType, "phone"), inArray(flaggedContacts.contactValue, phones)))
      .groupBy(flaggedContacts.contactValue);
    for (const r of rows) counts.set(`phone:${r.value}`, r.count);
  }
  if (emails.length > 0) {
    const rows = await db
      .select({ value: flaggedContacts.contactValue, count: sql<number>`COUNT(*)` })
      .from(flaggedContacts)
      .where(and(eq(flaggedContacts.contactType, "email"), inArray(flaggedContacts.contactValue, emails)))
      .groupBy(flaggedContacts.contactValue);
    for (const r of rows) counts.set(`email:${r.value}`, r.count);
  }
  return counts;
}

/** Every "Send My Info" request for this cuddler, newest first, with a flaggedCount attached to
 *  each one from the shared flagged_contacts table (see reportContact below) so the dashboard can
 *  show a client's number/email as yellow or red if any cuddler — not just this one — has
 *  flagged it before. Never exposes who filed a report or why (see flaggedContacts comment in
 *  lib/schema.ts) — just the count. */
/** A cuddler's own filed reports, newest first — so they can see what they've submitted and
 *  undo a mistaken one themselves (see deleteMyReport below). Correcting or reinstating anything
 *  beyond a straight delete still goes through support (see the flaggedContacts comment in
 *  lib/schema.ts) — this table never exposes who filed a report to anyone but the filer. */
export async function listMyReports() {
  const me = await currentCuddler();
  if (!me) return [];
  return db
    .select()
    .from(flaggedContacts)
    .where(eq(flaggedContacts.reportedByCuddlerId, me.id))
    .orderBy(desc(flaggedContacts.createdAt));
}

/** Lets a cuddler remove a report they filed by mistake — ownership-checked, so one cuddler
 *  can never delete another's report even by guessing an id. This only ever deletes a row that's
 *  already scoped to reportedByCuddlerId === me.id, one flaggedContacts row at a time. */
export async function deleteMyReport(formData: FormData) {
  const me = await currentCuddler();
  if (!me) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  await db
    .delete(flaggedContacts)
    .where(and(eq(flaggedContacts.id, id), eq(flaggedContacts.reportedByCuddlerId, me.id)));
  revalidatePath("/dashboard");
}

/** Removes one or many inquiries from the signed-in cuddler's own inbox — ownership-checked the
 *  same way markInquiryRead is, so one cuddler can never delete another's message even by
 *  guessing an id. This only clears the inbox entry; it has no effect on any report the cuddler
 *  separately filed against that contact via reportContact (a different table, flaggedContacts). */
export async function deleteInquiries(formData: FormData) {
  const me = await currentCuddler();
  if (!me) return;
  const ids = formData.getAll("id").map((v) => String(v)).filter(Boolean);
  if (ids.length === 0) return;

  const rows = await db.select().from(inquiries).where(inArray(inquiries.id, ids));
  const ownIds = rows.filter((r) => r.cuddlerId === me.id).map((r) => r.id);
  if (ownIds.length === 0) return;

  await db.delete(inquiries).where(inArray(inquiries.id, ownIds));
  revalidatePath("/dashboard");
}

export async function listInquiries(cuddlerId: string) {
  // Auth check even though every current caller already passes the signed-in cuddler's own id
  // (see dashboard/page.tsx) — this file is "use server", so every exported function here is
  // independently callable as a server action with arbitrary arguments, not just from the pages
  // that happen to render a button for it. Without this, anyone could call listInquiries() with
  // another cuddler's id and read their clients' names, phone numbers, and emails directly.
  const me = await currentCuddler();
  if (!me || me.id !== cuddlerId) return [];

  const rows = await db
    .select()
    .from(inquiries)
    .where(eq(inquiries.cuddlerId, cuddlerId))
    .orderBy(desc(inquiries.createdAt));

  const phones = Array.from(new Set(rows.map((r) => normalizePhone(r.clientPhone)).filter((p): p is string => !!p)));
  const emails = Array.from(new Set(rows.map((r) => normalizeEmail(r.clientEmail)).filter((e): e is string => !!e)));
  const counts = await flagCountsFor(phones, emails);

  return rows.map((r) => {
    const phoneCount = counts.get(`phone:${normalizePhone(r.clientPhone) ?? ""}`) ?? 0;
    const emailCount = counts.get(`email:${normalizeEmail(r.clientEmail) ?? ""}`) ?? 0;
    const flaggedCount = phoneCount + emailCount;
    return { ...r, flaggedCount, flagSeverity: flagSeverity(flaggedCount) };
  });
}

/** Accepts one or many inquiry ids under the "id" key (a single checked checkbox, several
 *  checked checkboxes, or every unread id at once for "Mark All As Read") — always re-checked
 *  against the signed-in cuddler's own inquiries so one cuddler can't mark another's message
 *  read by guessing an id. */
export async function markInquiryRead(formData: FormData) {
  const me = await currentCuddler();
  if (!me) return;
  const ids = formData.getAll("id").map((v) => String(v)).filter(Boolean);
  if (ids.length === 0) return;

  const rows = await db.select().from(inquiries).where(inArray(inquiries.id, ids));
  const ownIds = rows.filter((r) => r.cuddlerId === me.id).map((r) => r.id);
  if (ownIds.length === 0) return;

  await db.update(inquiries).set({ readAt: new Date() }).where(inArray(inquiries.id, ownIds));
  revalidatePath("/dashboard");
}

/** Marks a message "denied" — for a request the cuddler doesn't want to take, without deleting
 *  the message outright (unlike Delete, which removes it entirely). Shows up in the inbox's
 *  Denied tab instead of Pending. Same multi-id + ownership-check pattern as markInquiryRead. */
export async function denyInquiry(formData: FormData) {
  const me = await currentCuddler();
  if (!me) return;
  const ids = formData.getAll("id").map((v) => String(v)).filter(Boolean);
  if (ids.length === 0) return;

  const rows = await db.select().from(inquiries).where(inArray(inquiries.id, ids));
  const ownIds = rows.filter((r) => r.cuddlerId === me.id).map((r) => r.id);
  if (ownIds.length === 0) return;

  await db.update(inquiries).set({ status: "denied", readAt: new Date() }).where(inArray(inquiries.id, ownIds));
  revalidatePath("/dashboard");
}

/** Moves a message back to Pending — an undo for an accidental Deny (or Accept, though accepting
 *  also leaves a calendar entry behind that this does NOT remove — cancel that separately from
 *  the calendar if needed). */
export async function resetInquiryStatus(formData: FormData) {
  const me = await currentCuddler();
  if (!me) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
  if (!row || row.cuddlerId !== me.id) return;

  await db.update(inquiries).set({ status: "pending" }).where(eq(inquiries.id, id));
  revalidatePath("/dashboard");
}

// ---------- Appointment calendar (see /dashboard/calendar) ----------
// A purely organizational tool for the cuddler themselves — see the block comment on the
// `appointments` table in lib/schema.ts. Nothing here is client-facing.

export async function listAppointments(cuddlerId: string) {
  // Same reasoning as listInquiries above: re-check against the signed-in cuddler even though
  // every current caller already passes their own id, since this file's exports are all
  // independently callable server actions.
  const me = await currentCuddler();
  if (!me || me.id !== cuddlerId) return [];

  return db
    .select()
    .from(appointments)
    .where(eq(appointments.cuddlerId, cuddlerId))
    .orderBy(asc(appointments.date), asc(appointments.time));
}

/** Manual "Add Appointment" — for anything arranged off-platform (call, text, in-person) that a
 *  cuddler wants on their calendar, not just inquiries that came through the site. */
export async function createAppointment(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string } | void> {
  const me = await currentCuddler();
  if (!me) return { error: "Not signed in." };

  const clientName = String(formData.get("clientName") || "").trim();
  const date = String(formData.get("date") || "").trim();
  const time = String(formData.get("time") || "").trim() || null;
  const rawDuration = String(formData.get("duration") || "").trim();
  const duration = DURATION_OPTIONS.includes(rawDuration) ? rawDuration : null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!clientName) return { error: "Enter a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a valid date." };

  await db.insert(appointments).values({ cuddlerId: me.id, clientName, date, time, duration, notes });
  revalidatePath("/dashboard/calendar");
}

/** "Accept" on an inquiry — turns a message that included a proposed date/time into a calendar
 *  entry. Date/time are editable at accept-time (pre-filled from the inquiry where available) in
 *  case the actual agreed time differs from what was originally requested, or the inquiry was
 *  "Whenever You're Open" (flexible), which has nothing to pre-fill. */
export async function acceptInquiryAsAppointment(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string } | void> {
  const me = await currentCuddler();
  if (!me) return { error: "Not signed in." };

  const inquiryId = String(formData.get("inquiryId") || "");
  const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId)).limit(1);
  if (!inquiry || inquiry.cuddlerId !== me.id) return { error: "Message not found." };

  const date = String(formData.get("date") || "").trim();
  const time = String(formData.get("time") || "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a valid date." };

  await db.insert(appointments).values({
    cuddlerId: me.id,
    clientName: inquiry.clientName,
    date,
    time,
    duration: inquiry.duration,
    notes: inquiry.message,
    sourceInquiryId: inquiry.id,
  });
  await db.update(inquiries).set({ status: "accepted", readAt: inquiry.readAt ?? new Date() }).where(eq(inquiries.id, inquiry.id));
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
}

export async function deleteAppointment(formData: FormData) {
  const me = await currentCuddler();
  if (!me) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const [row] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!row || row.cuddlerId !== me.id) return;

  await db.delete(appointments).where(eq(appointments.id, id));
  revalidatePath("/dashboard/calendar");
}

/** Edits an existing calendar entry — clicking a day (see CalendarView.tsx) shows its
 *  appointments in a list below the grid with Edit/Delete on each; this powers Edit. */
export async function updateAppointment(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string } | void> {
  const me = await currentCuddler();
  if (!me) return { error: "Not signed in." };

  const id = String(formData.get("id") || "");
  const [row] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!row || row.cuddlerId !== me.id) return { error: "Appointment not found." };

  const clientName = String(formData.get("clientName") || "").trim();
  const date = String(formData.get("date") || "").trim();
  const time = String(formData.get("time") || "").trim() || null;
  const rawDuration = String(formData.get("duration") || "").trim();
  const duration = DURATION_OPTIONS.includes(rawDuration) ? rawDuration : null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!clientName) return { error: "Enter a name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a valid date." };

  await db.update(appointments).set({ clientName, date, time, duration, notes }).where(eq(appointments.id, id));
  revalidatePath("/dashboard/calendar");
}

/** Flags a client's phone number OR email as unreliable/spam/no-show/etc. — the standalone
 *  "Report A Customer" section on the dashboard (not tied to a specific inbound message, so a
 *  cuddler can flag someone they only heard from by phone call). Deliberately no admin approval
 *  step, and deliberately doesn't take a name (see the flaggedContacts comment in lib/schema.ts) —
 *  one flag per cuddler per contact, so a single bad actor can't inflate the count. */
export async function reportContact(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: string }> {
  const me = await currentCuddler();
  if (!me) return { error: "Not signed in." };

  const phone = normalizePhone(String(formData.get("phone") || ""));
  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!phone && !email) return { error: "Enter a phone number or an email to report." };

  const contactType: "phone" | "email" = phone ? "phone" : "email";
  const contactValue = phone ?? email!;
  // "reason" is one of the REPORT_REASONS pick-list options; picking "Other" reveals a short
  // free-text field ("reasonOther") whose value is stored instead, so there's always a concrete
  // reason on file even though the UI never lets a cuddler type an open-ended reason directly.
  const reasonChoice = String(formData.get("reason") || "").trim();
  const reason =
    (reasonChoice === "Other"
      ? String(formData.get("reasonOther") || "").trim()
      : reasonChoice
    ).slice(0, FLAG_REASON_MAX_CHARS) || null;

  const [already] = await db
    .select()
    .from(flaggedContacts)
    .where(
      and(
        eq(flaggedContacts.contactType, contactType),
        eq(flaggedContacts.contactValue, contactValue),
        eq(flaggedContacts.reportedByCuddlerId, me.id)
      )
    )
    .limit(1);
  if (already) return { error: "You've already reported this contact." };

  await db.insert(flaggedContacts).values({ contactType, contactValue, reportedByCuddlerId: me.id, reason });
  revalidatePath("/dashboard");
  return { ok: "Reported. This will show as a warning to other cuddlers if this contact messages them." };
}
