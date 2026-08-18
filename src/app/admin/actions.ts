"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  reviews,
  reports,
  cuddlers,
  admins,
  adminAuditLog,
  systemEvents,
  flaggedContacts,
  flaggedPhotos,
  agencyEmployees,
  newsletterSubscribers,
  type Admin,
} from "@/lib/schema";
import { deleteObject, keyFromPublicUrl } from "@/lib/storage";
import {
  createAdminSession,
  destroyAdminSession,
  currentAdmin,
  verifyAdminCredentials,
  hashAdminPassword,
} from "@/lib/adminAuth";
import { verifyCaptcha } from "@/lib/captcha";
import { rateLimit } from "@/lib/rateLimit";
import { isLive, isPaused, isSuspended, isVerified, photosApproved } from "@/lib/stripe";
import { checkGoLive } from "@/lib/activity";
import { applyListingUpdate, applyHoursUpdate } from "@/lib/listingUpdate";
import { deleteCuddlerAccount } from "@/lib/deleteAccount";
import { buildSocialCaption } from "@/lib/socialCaption";
import { SITE_URL, SOCIAL_QUEUE_LIMIT } from "@/lib/config";

export async function adminLogin(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  // Tighter than cuddler login (5 vs 8 per window) — admin accounts guard moderation and
  // billing-adjacent actions, so a lower threshold is worth the extra friction for real admins.
  if (!rateLimit(`admin-login:${email}`, 5, 15 * 60_000)) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  if (!(await verifyCaptcha(formData.get("cf-turnstile-response")))) {
    return { error: "Captcha check failed — please try again." };
  }

  const admin = await verifyAdminCredentials(email, password);
  if (!admin) return { error: "Incorrect email or password." };
  await createAdminSession(admin.id);
  redirect("/admin");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Every mutating admin action logs here — who, what, when, and on what. */
async function logAction(
  admin: Admin,
  action: string,
  opts: { targetType?: string; targetId?: string; detail?: string } = {}
) {
  await db.insert(adminAuditLog).values({
    adminId: admin.id,
    adminName: admin.name,
    action,
    targetType: opts.targetType ?? null,
    targetId: opts.targetId ?? null,
    detail: opts.detail ?? null,
  });
}

// ---------- Queues ----------

export async function pendingReviews() {
  await requireAdmin();
  return db
    .select({
      id: reviews.id,
      cuddlerId: reviews.cuddlerId,
      cuddlerName: cuddlers.name,
      cuddlerSlug: cuddlers.slug,
      authorName: reviews.authorName,
      authorEmail: reviews.authorEmail,
      rating: reviews.rating,
      body: reviews.body,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(cuddlers, eq(reviews.cuddlerId, cuddlers.id))
    .where(eq(reviews.status, "pending"))
    .orderBy(desc(reviews.createdAt));
}

export async function pendingReports() {
  await requireAdmin();
  return db
    .select({
      id: reports.id,
      cuddlerId: reports.cuddlerId,
      cuddlerName: cuddlers.name,
      cuddlerSlug: cuddlers.slug,
      reporterEmail: reports.reporterEmail,
      body: reports.body,
      photoUrl1: reports.photoUrl1,
      photoUrl2: reports.photoUrl2,
      photoUrl3: reports.photoUrl3,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(cuddlers, eq(reports.cuddlerId, cuddlers.id))
    .where(eq(reports.status, "pending"))
    .orderBy(desc(reports.createdAt));
}

// ---------- Review moderation ----------

export async function approveReview(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  if (!id) return;
  await db.update(reviews).set({ status: "approved" }).where(eq(reviews.id, id));
  await logAction(admin, "approve_review", { targetType: "review", targetId: id, detail: slug || undefined });
  revalidatePath("/admin");
  if (slug) revalidatePath(`/cuddlers/${slug}`);
}

export async function denyReview(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.update(reviews).set({ status: "denied" }).where(eq(reviews.id, id));
  await logAction(admin, "deny_review", { targetType: "review", targetId: id });
  revalidatePath("/admin");
}

/** Every review currently live on a cuddler's public profile (approved only) — used on the
 *  admin edit-cuddler page so an admin can pull down a specific review after the fact (fake,
 *  abusive, or otherwise problematic review that already made it through moderation). */
export async function cuddlerReviews(cuddlerId: string) {
  await requireAdmin();
  return db
    .select()
    .from(reviews)
    .where(and(eq(reviews.cuddlerId, cuddlerId), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.createdAt));
}

/** Permanently removes a review from a profile — unlike denyReview (which only blocks a review
 *  before it's ever gone public), this is for a review that's already live and needs to come
 *  down. Deletes rather than just re-flagging the status, since a pulled review shouldn't ever
 *  resurface anywhere it's read from. */
export async function adminDeleteReview(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const cuddlerId = String(formData.get("cuddlerId") || "");
  const slug = String(formData.get("slug") || "");
  if (!id) return;
  await db.delete(reviews).where(eq(reviews.id, id));
  await logAction(admin, "delete_review", { targetType: "review", targetId: id, detail: slug || undefined });
  if (cuddlerId) revalidatePath(`/admin/cuddlers/${cuddlerId}/edit`);
  if (slug) revalidatePath(`/cuddlers/${slug}`);
}

/** Every review ever submitted, any status, newest first — for general cleanup beyond just the
 *  pending queue above (a review that already got approved can still need to come down later, e.g.
 *  after a report or a complaint). Paired with adminDeleteReview above. */
export async function allReviews(limit = 300) {
  await requireAdmin();
  return db
    .select({
      id: reviews.id,
      cuddlerId: reviews.cuddlerId,
      cuddlerName: cuddlers.name,
      cuddlerSlug: cuddlers.slug,
      authorName: reviews.authorName,
      authorEmail: reviews.authorEmail,
      rating: reviews.rating,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(cuddlers, eq(reviews.cuddlerId, cuddlers.id))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

// ---------- Flagged customer contacts (search by phone/email) ----------
// A cuddler only ever sees the aggregate severity/count for a client contact on their own
// messages (see listInquiries/reportContact in app/actions.ts) — never who reported it or why.
// An admin can see the full picture here for moderation: investigating a bad-faith or duplicate
// report, or looking up a contact before it comes up in a support request.

export async function searchFlaggedContacts(query: string) {
  await requireAdmin();
  const q = query.trim();
  if (!q) return [];
  const digits = q.replace(/\D/g, "");

  const conditions = [];
  if (digits.length >= 3) {
    conditions.push(and(eq(flaggedContacts.contactType, "phone"), like(flaggedContacts.contactValue, `%${digits}%`)));
  }
  if (q.includes("@") || /[a-z]/i.test(q)) {
    conditions.push(and(eq(flaggedContacts.contactType, "email"), like(flaggedContacts.contactValue, `%${q.toLowerCase()}%`)));
  }
  if (conditions.length === 0) return [];

  return db
    .select({
      id: flaggedContacts.id,
      contactType: flaggedContacts.contactType,
      contactValue: flaggedContacts.contactValue,
      reason: flaggedContacts.reason,
      createdAt: flaggedContacts.createdAt,
      reportedByName: cuddlers.name,
      reportedBySlug: cuddlers.slug,
    })
    .from(flaggedContacts)
    .innerJoin(cuddlers, eq(flaggedContacts.reportedByCuddlerId, cuddlers.id))
    .where(or(...conditions))
    .orderBy(desc(flaggedContacts.createdAt))
    .limit(100);
}

export async function adminDeleteFlaggedContact(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.delete(flaggedContacts).where(eq(flaggedContacts.id, id));
  await logAction(admin, "delete_flagged_contact", { targetType: "flagged_contact", targetId: id });
  revalidatePath("/admin");
}

// ---------- Report moderation ----------

export async function actionReport(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.update(reports).set({ status: "actioned" }).where(eq(reports.id, id));
  await logAction(admin, "action_report", { targetType: "report", targetId: id });
  revalidatePath("/admin");
}

export async function dismissReport(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.update(reports).set({ status: "dismissed" }).where(eq(reports.id, id));
  await logAction(admin, "dismiss_report", { targetType: "report", targetId: id });
  revalidatePath("/admin");
}

// Cuddle certification review (pendingVerifications/approveVerification/rejectVerification) was
// removed the same way — cuddle therapy isn't state-licensed, so this was carryover from
// findmemassage's real license-verification gate and never meant anything here. Identity
// verification (below) is still automatic via Stripe, unaffected. See the schema.ts comment on
// verificationStatus — those columns are kept, frozen, unused.

// Photo content review was removed — every upload already passes through HD validation,
// EXIF-stripping, and re-encoding (see /api/photos/route.ts) and now goes live immediately,
// so there's no separate admin queue for it anymore. photosStatus/photosNote stay in the schema
// (now effectively just "none" | "approved") since dropping columns needs a SQLite migration.

// ---------- Website link review ----------
// A cuddler can add a link to their own personal/business website, but we don't show it publicly
// until an admin has actually looked at where it goes — same reasoning as the photo content review
// above. See the websiteUrl comment in schema.ts and the "Third-party links" section in
// terms/page.tsx for why we don't just let any link through unreviewed.

export async function pendingWebsiteReviews() {
  await requireAdmin();
  return db
    .select({
      id: cuddlers.id,
      name: cuddlers.name,
      slug: cuddlers.slug,
      email: cuddlers.email,
      websiteUrl: cuddlers.websiteUrl,
    })
    .from(cuddlers)
    .where(eq(cuddlers.websiteStatus, "pending"));
}

export async function approveWebsite(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  if (!id) return;
  await db
    .update(cuddlers)
    .set({ websiteStatus: "approved", websiteNote: null })
    .where(eq(cuddlers.id, id));
  await logAction(admin, "approve_website", { targetType: "website", targetId: id, detail: slug || undefined });
  revalidatePath("/admin");
  if (slug) revalidatePath(`/cuddlers/${slug}`);
}

export async function rejectWebsite(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const slug = String(formData.get("slug") || "");
  const note = String(formData.get("note") || "").trim();
  if (!id) return;
  await db
    .update(cuddlers)
    .set({ websiteStatus: "rejected", websiteNote: note || "Link didn't pass review." })
    .where(eq(cuddlers.id, id));
  await logAction(admin, "reject_website", { targetType: "website", targetId: id, detail: note || undefined });
  revalidatePath("/admin");
  if (slug) revalidatePath(`/cuddlers/${slug}`);
}

// ---------- Flagged photos (manual review queue) ----------
// See flaggedPhotos in schema.ts. There's no automatic scanning — an admin flags a photo themselves
// (manualFlagPhoto below, from the read-only photo grid on /admin/cuddlers/[id]/edit) if
// something looks off while looking at a listing. The photo is never auto-removed; it's live on the
// site the whole time this row exists. From here an admin either dismisses the flag (false alarm —
// photo stays), crops it (trims the photo and clears the flag), or removes it entirely (clears it
// from the listing/employee and deletes the flag).

export async function pendingFlaggedPhotos() {
  await requireAdmin();
  return db
    .select({
      id: flaggedPhotos.id,
      photoUrl: flaggedPhotos.photoUrl,
      aiScore: flaggedPhotos.aiScore,
      suggestiveScore: flaggedPhotos.suggestiveScore,
      flagReason: flaggedPhotos.flagReason,
      slot: flaggedPhotos.slot,
      createdAt: flaggedPhotos.createdAt,
      cuddlerId: cuddlers.id,
      cuddlerName: cuddlers.name,
      cuddlerSlug: cuddlers.slug,
      employeeId: flaggedPhotos.employeeId,
      employeeName: agencyEmployees.name,
    })
    .from(flaggedPhotos)
    .innerJoin(cuddlers, eq(flaggedPhotos.cuddlerId, cuddlers.id))
    .leftJoin(agencyEmployees, eq(flaggedPhotos.employeeId, agencyEmployees.id))
    // Worst-first, using whichever of the two scores is higher for a given row — a suggestive-only
    // flag (low aiScore) should still surface near the top if its suggestiveScore is severe.
    .orderBy(desc(sql`max(${flaggedPhotos.aiScore}, coalesce(${flaggedPhotos.suggestiveScore}, 0))`));
}

/** Photo slot -> column-name mapping, same as SLOT_COLUMNS in api/photos/route.ts (duplicated
 *  rather than shared across a route-boundary import). */
const PHOTO_SLOT_COLUMNS = {
  1: { url: "photoUrl", w: "photoW", h: "photoH" },
  2: { url: "photoUrl2", w: "photoW2", h: "photoH2" },
  3: { url: "photoUrl3", w: "photoW3", h: "photoH3" },
  4: { url: "photoUrl4", w: "photoW4", h: "photoH4" },
  5: { url: "photoUrl5", w: "photoW5", h: "photoH5" },
  6: { url: "photoUrl6", w: "photoW6", h: "photoH6" },
} as const;

export async function dismissFlaggedPhoto(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.delete(flaggedPhotos).where(eq(flaggedPhotos.id, id));
  await logAction(admin, "dismiss_flagged_photo", { targetType: "flagged_photo", targetId: id });
  revalidatePath("/admin");
}

export async function removeFlaggedPhoto(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const [flag] = await db.select().from(flaggedPhotos).where(eq(flaggedPhotos.id, id)).limit(1);
  if (!flag) return;

  if (flag.employeeId) {
    await db
      .update(agencyEmployees)
      .set({ photoUrl: null, photoW: null, photoH: null })
      .where(eq(agencyEmployees.id, flag.employeeId));
  } else if (flag.slot && flag.slot in PHOTO_SLOT_COLUMNS) {
    const cols = PHOTO_SLOT_COLUMNS[flag.slot as keyof typeof PHOTO_SLOT_COLUMNS];
    await db
      .update(cuddlers)
      .set({ [cols.url]: null, [cols.w]: null, [cols.h]: null })
      .where(eq(cuddlers.id, flag.cuddlerId));
  }

  const key = keyFromPublicUrl(flag.photoUrl);
  if (key) deleteObject(key).catch(() => {});

  await db.delete(flaggedPhotos).where(eq(flaggedPhotos.id, id));
  await logAction(admin, "remove_flagged_photo", { targetType: "flagged_photo", targetId: id });

  const [t] = await db.select({ slug: cuddlers.slug }).from(cuddlers).where(eq(cuddlers.id, flag.cuddlerId)).limit(1);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  if (t) revalidatePath(`/cuddlers/${t.slug}`);
}

/** Lets an admin flag a photo by hand from the read-only photo grid on
 *  /admin/cuddlers/[id]/edit (see ListingForm.tsx) — e.g. a bad crop, an awkward or
 *  inappropriate photo, anything worth a second look. Re-reads the current photo URL from the DB
 *  rather than trusting the submitted photoUrl, so this can only ever flag a photo actually on that
 *  listing/employee right now. Lands in the same Flagged Photos queue as everything else. */
export async function manualFlagPhoto(formData: FormData) {
  const admin = await requireAdmin();
  const cuddlerId = String(formData.get("cuddlerId") || "");
  const employeeId = String(formData.get("employeeId") || "");
  const slotRaw = formData.get("slot");
  const note = String(formData.get("note") || "").trim().slice(0, 300);
  if (!cuddlerId) return;

  let photoUrl: string | null = null;
  let slot: number | null = null;

  if (employeeId) {
    const [emp] = await db.select().from(agencyEmployees).where(eq(agencyEmployees.id, employeeId)).limit(1);
    if (!emp || emp.cuddlerId !== cuddlerId) return;
    photoUrl = emp.photoUrl;
  } else {
    const n = Number(slotRaw);
    if (!(n in PHOTO_SLOT_COLUMNS)) return;
    slot = n;
    const [t] = await db.select().from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
    if (!t) return;
    photoUrl = (t as unknown as Record<string, string | null>)[PHOTO_SLOT_COLUMNS[n as keyof typeof PHOTO_SLOT_COLUMNS].url];
  }
  if (!photoUrl) return;

  // Don't stack duplicate flags on the same photo.
  const [existing] = await db.select().from(flaggedPhotos).where(eq(flaggedPhotos.photoUrl, photoUrl)).limit(1);
  if (existing) return;

  await db.insert(flaggedPhotos).values({
    cuddlerId,
    employeeId: employeeId || null,
    slot,
    photoUrl,
    aiScore: 0,
    suggestiveScore: null,
    flagReason: note ? `manual: ${note}` : "manual",
  });
  await logAction(admin, "manual_flag_photo", { targetType: "flagged_photo", targetId: cuddlerId, detail: note || undefined });
  revalidatePath("/admin");
}

/** Reverts a manual card-photo crop (see /admin/crop-photo + cardPhotoUrl in schema.ts) — clears
 *  cardPhotoUrl so the homepage/search card thumbnail falls back to an automatic center-crop of the
 *  full photo again. The full photoUrl on the public profile page was never touched by the crop in
 *  the first place, so there's nothing to restore there. */
export async function undoCardCrop(formData: FormData) {
  const admin = await requireAdmin();
  const cuddlerId = String(formData.get("cuddlerId") || "");
  if (!cuddlerId) return;

  const [t] = await db.select().from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!t || !t.cardPhotoUrl) return;

  const key = keyFromPublicUrl(t.cardPhotoUrl);
  if (key) deleteObject(key).catch(() => {});

  await db.update(cuddlers).set({ cardPhotoUrl: null }).where(eq(cuddlers.id, cuddlerId));
  await logAction(admin, "undo_card_crop", { targetType: "cuddler", targetId: cuddlerId, detail: t.name });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath(`/cuddlers/${t.slug}`);
}

// ---------- "Ready To Post" social queue ----------
// A manual checklist, not an auto-posting bot — X's free API tier is gone and Facebook requires
// App Review + Business Verification (a real registered business, which this site doesn't have
// yet) just to post to a Page. This sidesteps both: an admin gets a pre-written caption + the
// cuddler's approved photo and posts it themselves, then marks it done so it never repeats.

export async function pendingSocialPosts() {
  await requireAdmin();
  const candidates = await db
    .select()
    .from(cuddlers)
    .where(
      and(
        eq(cuddlers.published, true),
        eq(cuddlers.subStatus, "active"),
        eq(cuddlers.socialMediaOptIn, true),
        isNull(cuddlers.socialPostedAt)
      )
    );

  return candidates
    .filter((t) => isLive(t) && photosApproved(t) && !!t.photoUrl)
    .slice(0, SOCIAL_QUEUE_LIMIT)
    .map((t) => {
      const listingUrl = `${SITE_URL}/cuddlers/${t.slug}`;
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        city: t.city,
        state: t.state,
        photoUrl: t.photoUrl!,
        listingUrl,
        caption: buildSocialCaption({
          name: t.name,
          city: t.city,
          state: t.state,
          headline: t.headline,
          bio: t.bio,
          services: t.services,
          listingUrl,
        }),
      };
    });
}

export async function markSocialPosted(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.update(cuddlers).set({ socialPostedAt: new Date() }).where(eq(cuddlers.id, id));
  await logAction(admin, "mark_social_posted", { targetType: "social", targetId: id });
  revalidatePath("/admin");
}

// ---------- Account suspension ----------
// Independent of the report/review moderation above — lets an admin immediately take a listing
// offline for a Terms of Service violation, whether or not it started from a specific report.
// Billing is left untouched on purpose (see the schema.ts comment on `suspendedAt`); this is a
// visibility hold, not a cancellation. See isSuspended()/isLive() in lib/stripe.ts.

export async function searchCuddlers(query: string) {
  await requireAdmin();
  const q = query.trim();
  if (!q) return [];
  return db
    .select({
      id: cuddlers.id,
      name: cuddlers.name,
      slug: cuddlers.slug,
      email: cuddlers.email,
      subStatus: cuddlers.subStatus,
      published: cuddlers.published,
      suspendedAt: cuddlers.suspendedAt,
      suspensionNote: cuddlers.suspensionNote,
    })
    .from(cuddlers)
    .where(
      or(
        like(cuddlers.name, `%${q}%`),
        like(cuddlers.email, `%${q}%`),
        like(cuddlers.slug, `%${q}%`)
      )
    )
    .orderBy(desc(cuddlers.createdAt))
    .limit(20);
}

export async function suspendedCuddlers() {
  await requireAdmin();
  return db
    .select({
      id: cuddlers.id,
      name: cuddlers.name,
      slug: cuddlers.slug,
      email: cuddlers.email,
      subStatus: cuddlers.subStatus,
      published: cuddlers.published,
      suspendedAt: cuddlers.suspendedAt,
      suspensionNote: cuddlers.suspensionNote,
    })
    .from(cuddlers)
    .where(isNotNull(cuddlers.suspendedAt))
    .orderBy(desc(cuddlers.suspendedAt));
}

export async function suspendCuddler(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const note = String(formData.get("note") || "").trim();
  if (!id) return;
  await db
    .update(cuddlers)
    .set({
      suspendedAt: new Date(),
      suspensionNote: note || "Suspended for a Terms of Service violation. Contact support for details.",
    })
    .where(eq(cuddlers.id, id));
  const rows = await db.select({ slug: cuddlers.slug }).from(cuddlers).where(eq(cuddlers.id, id)).limit(1);
  await logAction(admin, "suspend_cuddler", { targetType: "cuddler", targetId: id, detail: note || undefined });
  revalidatePath("/admin/cuddlers");
  revalidatePath("/admin");
  if (rows[0]?.slug) revalidatePath(`/cuddlers/${rows[0].slug}`);
}

export async function unsuspendCuddler(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.update(cuddlers).set({ suspendedAt: null, suspensionNote: null }).where(eq(cuddlers.id, id));
  const rows = await db.select({ slug: cuddlers.slug }).from(cuddlers).where(eq(cuddlers.id, id)).limit(1);
  await logAction(admin, "unsuspend_cuddler", { targetType: "cuddler", targetId: id });
  await checkGoLive(id);
  revalidatePath("/admin/cuddlers");
  revalidatePath("/admin");
  if (rows[0]?.slug) revalidatePath(`/cuddlers/${rows[0].slug}`);
}

// ---------- All accounts overview ("who's active") ----------
// Distinct from searchCuddlers() above (name/email/slug lookup for moderation) — this is the
// full roster with enough status fields to see at a glance who's live, who's stuck mid-signup,
// and who needs help finishing setup. See /admin/cuddlers.

export async function allCuddlers() {
  await requireAdmin();
  const rows = await db
    .select({
      id: cuddlers.id,
      name: cuddlers.name,
      slug: cuddlers.slug,
      email: cuddlers.email,
      published: cuddlers.published,
      subStatus: cuddlers.subStatus,
      activeUntil: cuddlers.activeUntil,
      identityStatus: cuddlers.identityStatus,
      pausedAt: cuddlers.pausedAt,
      suspendedAt: cuddlers.suspendedAt,
      wentLiveAt: cuddlers.wentLiveAt,
      createdAt: cuddlers.createdAt,
      referredBy: cuddlers.referredBy,
    })
    .from(cuddlers)
    .orderBy(desc(cuddlers.createdAt));

  return rows.map((t) => ({
    ...t,
    live: isLive(t),
    paused: isPaused(t),
    suspended: isSuspended(t),
    verified: isVerified(t),
  }));
}

// ---------- Edit on behalf of a cuddler ----------
// Lets an admin fill in / fix a cuddler's own listing fields and hours directly from the admin
// panel — for walking someone through setup over the phone, fixing a typo they can't figure out
// how to change, etc. Deliberately does NOT touch login credentials (Clerk owns those, and an
// admin having a cuddler's password/email-change ability would be a much bigger security
// surface than editing listing content) and does NOT upload photos on their behalf (that requires
// the actual photo file, which only the cuddler has — see PhotoUploader). Every save here is
// audit-logged same as any other admin action.

export async function adminGetCuddler(id: string) {
  await requireAdmin();
  const [t] = await db.select().from(cuddlers).where(eq(cuddlers.id, id)).limit(1);
  return t ?? null;
}

// Lets an admin remove an account directly — e.g. a cuddler emails support asking to be deleted
// rather than using the self-service "Delete My Account" on their own dashboard (see deleteAccount()
// in app/actions.ts). Same cleanup either way (billing, storage, Clerk login, DB row): see
// deleteCuddlerAccount() in lib/deleteAccount.ts. No password check (admin auth already gates this),
// but still requires typing DELETE, and it's logged to the audit trail with whatever reason the
// admin gave, same as suspendCuddler() above.
export async function adminDeleteCuddler(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string } | void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing cuddler id." };
  if (formData.get("confirmText") !== "DELETE") {
    return { error: 'Type "DELETE" to confirm.' };
  }

  const [t] = await db.select().from(cuddlers).where(eq(cuddlers.id, id)).limit(1);
  if (!t) return { error: "Cuddler not found." };

  const reason = String(formData.get("reason") || "").trim();
  await deleteCuddlerAccount(t);
  await logAction(admin, "admin_delete_cuddler", { targetType: "cuddler", targetId: id, detail: reason || t.email });
  revalidatePath("/admin/cuddlers");
  redirect("/admin/cuddlers");
}

export async function adminUpdateListing(cuddlerId: string, _prev: unknown, formData: FormData) {
  const admin = await requireAdmin();
  const [existing] = await db.select().from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!existing) return { error: "Cuddler not found." };

  const result = await applyListingUpdate(cuddlerId, existing, formData);
  if (!("error" in result)) {
    await logAction(admin, "admin_edit_listing", { targetType: "cuddler", targetId: cuddlerId, detail: existing.name });
    revalidatePath(`/admin/cuddlers/${cuddlerId}/edit`);
    revalidatePath("/admin/cuddlers");
  }
  return result;
}

export async function adminUpdateHours(cuddlerId: string, _prev: unknown, formData: FormData) {
  const admin = await requireAdmin();
  const [existing] = await db
    .select({ slug: cuddlers.slug, name: cuddlers.name })
    .from(cuddlers)
    .where(eq(cuddlers.id, cuddlerId))
    .limit(1);
  if (!existing) return { error: "Cuddler not found." };

  const result = await applyHoursUpdate(cuddlerId, existing.slug, formData);
  await logAction(admin, "admin_edit_hours", { targetType: "cuddler", targetId: cuddlerId, detail: existing.name });
  revalidatePath(`/admin/cuddlers/${cuddlerId}/edit`);
  return result;
}

// Quick inline edit for the "Referred By" field on the admin edit page — lets an admin fix a
// misspelled or inconsistent referrer name after the fact so the /admin/referrals summary groups
// it correctly (that page groups by exact string match, case-insensitive).
export async function adminUpdateReferredBy(cuddlerId: string, formData: FormData) {
  const admin = await requireAdmin();
  const [existing] = await db
    .select({ name: cuddlers.name })
    .from(cuddlers)
    .where(eq(cuddlers.id, cuddlerId))
    .limit(1);
  if (!existing) return;

  const referredBy = String(formData.get("referredBy") || "").trim() || null;
  await db.update(cuddlers).set({ referredBy }).where(eq(cuddlers.id, cuddlerId));
  await logAction(admin, "admin_edit_referred_by", {
    targetType: "cuddler",
    targetId: cuddlerId,
    detail: `${existing.name}: ${referredBy ?? "(cleared)"}`,
  });
  revalidatePath(`/admin/cuddlers/${cuddlerId}/edit`);
  revalidatePath("/admin/cuddlers");
  revalidatePath("/admin/referrals");
}

// ---------- Manual Stripe Identity override ----------
// Identity verification (government ID + live selfie) is normally fully automated via the Stripe
// Identity webhook — but sometimes it legitimately gets stuck (a document type Stripe's checker
// won't accept, a technical hiccup, someone who needs a bit of hand-holding to finish it) and a
// listing shouldn't stay stuck forever over it. This lets an admin manually mark it verified —
// isLive() still separately requires the license review above, this only covers the automated ID
// check — or reset it back to "none" so the cuddler gets a clean retry. Both audit-logged.

export async function adminOverrideIdentity(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db
    .update(cuddlers)
    .set({ identityStatus: "verified", identityVerifiedAt: new Date() })
    .where(eq(cuddlers.id, id));
  const rows = await db.select({ slug: cuddlers.slug, name: cuddlers.name }).from(cuddlers).where(eq(cuddlers.id, id)).limit(1);
  await logAction(admin, "override_identity_verified", { targetType: "cuddler", targetId: id, detail: rows[0]?.name });
  await checkGoLive(id);
  revalidatePath(`/admin/cuddlers/${id}/edit`);
  revalidatePath("/admin/cuddlers");
  if (rows[0]?.slug) revalidatePath(`/cuddlers/${rows[0].slug}`);
}

export async function adminResetIdentity(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db
    .update(cuddlers)
    .set({ identityStatus: "none", identityVerifiedAt: null, identitySessionId: null })
    .where(eq(cuddlers.id, id));
  const rows = await db.select({ name: cuddlers.name }).from(cuddlers).where(eq(cuddlers.id, id)).limit(1);
  await logAction(admin, "reset_identity_verification", { targetType: "cuddler", targetId: id, detail: rows[0]?.name });
  revalidatePath(`/admin/cuddlers/${id}/edit`);
  revalidatePath("/admin/cuddlers");
}

// ---------- VIP photoshoot requests ----------

export async function pendingPhotoshootRequests() {
  await requireAdmin();
  return db
    .select({
      id: cuddlers.id,
      name: cuddlers.name,
      slug: cuddlers.slug,
      email: cuddlers.email,
      contactEmail: cuddlers.contactEmail,
      phone: cuddlers.phone,
      photoshootRequestedAt: cuddlers.photoshootRequestedAt,
    })
    .from(cuddlers)
    .where(and(isNotNull(cuddlers.photoshootRequestedAt), eq(cuddlers.photoshootContacted, false)))
    .orderBy(desc(cuddlers.photoshootRequestedAt));
}

export async function markPhotoshootContacted(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.update(cuddlers).set({ photoshootContacted: true }).where(eq(cuddlers.id, id));
  await logAction(admin, "mark_photoshoot_contacted", { targetType: "photoshoot", targetId: id });
  revalidatePath("/admin");
}

// ---------- Team management (super admins only) ----------

export async function listAdmins() {
  await requireAdmin();
  return db
    .select({ id: admins.id, name: admins.name, email: admins.email, role: admins.role, createdAt: admins.createdAt })
    .from(admins)
    .orderBy(desc(admins.createdAt));
}

export async function createAdminAccount(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: string }> {
  const me = await requireAdmin();
  if (me.role !== "super") return { error: "Only a super admin can add team members." };

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!name || !email || !password) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, email)).limit(1);
  if (existing.length) return { error: "An admin with that email already exists." };

  const passwordHash = await hashAdminPassword(password);
  await db.insert(admins).values({ name, email, passwordHash, role: "staff" });
  await logAction(me, "create_admin", { targetType: "admin", detail: `${name} (${email})` });

  revalidatePath("/admin/team");
  return { ok: `${name} can now log in at /admin/login.` };
}

export async function removeAdmin(formData: FormData) {
  const me = await requireAdmin();
  if (me.role !== "super") return;
  const id = String(formData.get("id") || "");
  if (!id || id === me.id) return; // can't remove yourself

  const rows = await db.select({ name: admins.name, email: admins.email }).from(admins).where(eq(admins.id, id)).limit(1);
  if (!rows.length) return;
  await db.delete(admins).where(eq(admins.id, id));
  await logAction(me, "remove_admin", { targetType: "admin", targetId: id, detail: `${rows[0].name} (${rows[0].email})` });
  revalidatePath("/admin/team");
}

// ---------- Activity log ----------

export async function recentActivity(limit = 100) {
  await requireAdmin();
  return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit);
}

// System-triggered events (signup completed, listing went live) — separate table from
// admin_audit_log above since these aren't admin actions. See lib/activity.ts for how entries get
// written, and the /admin/activity page for where the two logs get merged for display.
export async function recentSystemEvents(limit = 100) {
  await requireAdmin();
  return db.select().from(systemEvents).orderBy(desc(systemEvents.createdAt)).limit(limit);
}

// ---------- Referral payouts ----------
// Grouped view of the free-text "Referred By" field collected at signup (see completeOnboarding in
// app/actions.ts) and editable per-account above — lets an admin tally up, at the end of the month,
// how many paying cuddlers each referrer brought in without having to scroll the full account list.
// Groups case-insensitively/trimmed so "Jane" and "jane " land in the same bucket; the display name
// shown is whichever spelling was entered first alphabetically, purely for a stable, readable label.

export async function referralSummary() {
  await requireAdmin();
  const rows = await db
    .select({
      id: cuddlers.id,
      name: cuddlers.name,
      slug: cuddlers.slug,
      subStatus: cuddlers.subStatus,
      referredBy: cuddlers.referredBy,
      createdAt: cuddlers.createdAt,
    })
    .from(cuddlers)
    .where(isNotNull(cuddlers.referredBy))
    .orderBy(desc(cuddlers.createdAt));

  const groups = new Map<
    string,
    { label: string; referred: typeof rows; payingCount: number }
  >();

  for (const r of rows) {
    const key = (r.referredBy ?? "").trim().toLowerCase();
    if (!key) continue;
    const existing = groups.get(key);
    const paying = r.subStatus === "active";
    if (existing) {
      existing.referred.push(r);
      if (paying) existing.payingCount++;
      if (r.referredBy!.trim() < existing.label) existing.label = r.referredBy!.trim();
    } else {
      groups.set(key, { label: r.referredBy!.trim(), referred: [r], payingCount: paying ? 1 : 0 });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.referred.length - a.referred.length);
}

// ---------- Newsletter subscribers ----------

export async function allNewsletterSubscribers() {
  await requireAdmin();
  return db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.consentAt));
}
