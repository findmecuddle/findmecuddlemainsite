// Shared listing/hours-update logic used by both the cuddler's own dashboard (src/app/actions.ts)
// and the admin "edit on behalf of a cuddler" panel (src/app/admin/actions.ts) — kept in a plain
// (non "use server") module so it's NOT independently callable as a server action/RPC endpoint by
// a client; every caller is responsible for its own auth check (currentCuddler() vs requireAdmin())
// before ever reaching these functions. Do not add "use server" to this file.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { cuddlers, cuddlerHours, type Cuddler } from "./schema";
import { isVip } from "./stripe";
import { resolveLocationStrict } from "./geo";
import { normalizeWebsiteUrl } from "./url";
import { buildSocialLinksJson } from "./socialLinks";
import { checkGoLive } from "./activity";
import { WEEK_DAYS, HOUR_BLOCKS_PER_DAY, ENJOYS_PETS_OPTIONS, BODY_TYPE_OPTIONS, HAIR_COLOR_OPTIONS, EYE_COLOR_OPTIONS } from "./config";

export async function applyListingUpdate(
  id: string,
  existing: Cuddler,
  formData: FormData
): Promise<{ error: string } | { ok: string }> {
  const locationText = String(formData.get("location") || "").trim();
  const loc = resolveLocationStrict(locationText);
  if (!loc) return { error: "Enter a 5-digit zip code, or your city and state (e.g. Austin, TX)." };

  const [city, stateZip] = loc.label.split(",").map((s) => s.trim());
  const [state, zipMaybe] = (stateZip || "").split(/\s+/);

  // Second location is a Monthly VIP perk — optional, blank clears it, ignored entirely off-plan.
  const locationText2 = isVip(existing) ? String(formData.get("location2") || "").trim() : "";
  let loc2: ReturnType<typeof resolveLocationStrict> = null;
  if (locationText2) {
    loc2 = resolveLocationStrict(locationText2);
    if (!loc2) return { error: "Enter a 5-digit zip code, or your city and state (e.g. Austin, TX) for your second location." };
  }
  const [city2, stateZip2] = loc2 ? loc2.label.split(",").map((s) => s.trim()) : [null, null];
  const [state2, zipMaybe2] = loc2 ? (stateZip2 || "").split(/\s+/) : [null, null];

  // Hourly rate (in-person) + optional virtual session rate. Blank = "Contact Me" on the public
  // page — see hourlyRate/offersVirtual/virtualHourlyRate's comments in lib/schema.ts.
  const parseRate = (key: string): number | null => {
    const raw = formData.get(key);
    const n = Number(raw);
    return raw && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const hourlyRate = parseRate("hourlyRate");
  const offersVirtual = formData.get("offersVirtual") === "on";
  const virtualHourlyRate = offersVirtual ? parseRate("virtualHourlyRate") : null;

  // Where in-person sessions happen — at least one of Host / Mobile must be selected, same
  // "can't submit a listing with nowhere to actually meet" reasoning as the contact-method check
  // below. (offersVirtual is separate and doesn't count toward this.)
  const hosts = formData.get("hosts") === "on";
  const mobile = formData.get("mobile") === "on";
  if (!hosts && !mobile) {
    return { error: "Select at least one: I Can Host or I Am Mobile." };
  }

  // "Getting to know you" — every field optional free text, or one of a short pick-list (only the
  // exact listed value is accepted, same tamper-proofing pattern as gender below). See the matching
  // columns' comments in lib/schema.ts.
  const text = (key: string, max = 200) => String(formData.get(key) || "").trim().slice(0, max) || null;
  const pick = (key: string, options: string[]) => {
    const raw = String(formData.get(key) || "");
    return options.includes(raw) ? raw : null;
  };
  const favoriteFood = text("favoriteFood");
  const favoriteDessert = text("favoriteDessert");
  const favoriteAnimal = text("favoriteAnimal");
  const enjoysPets = pick("enjoysPets", ENJOYS_PETS_OPTIONS);
  const allergies = text("allergies");
  const favoriteMusic = text("favoriteMusic");
  const favoriteActivities = text("favoriteActivities", 300);
  const favoriteMovie = text("favoriteMovie");
  const favoriteShow = text("favoriteShow");
  const enjoysAboutCuddling = text("enjoysAboutCuddling", 500);
  const nextVacationDestination = text("nextVacationDestination");
  const funFact = text("funFact", 300);
  // No longer collected via the form (dropped per product decision) — carry forward whatever's
  // already stored instead of wiping it on every save. Column stays in schema.ts either way.
  const activeLifestyle = existing.activeLifestyle;
  const height = text("height", 20);
  const bodyType = pick("bodyType", BODY_TYPE_OPTIONS);
  const hairColor = pick("hairColor", HAIR_COLOR_OPTIONS);
  const eyeColor = pick("eyeColor", EYE_COLOR_OPTIONS);

  // Contact methods: at least one of Phone Call / Text / Email / Site Messages Only must be
  // selected. Site Messages Only is mutually exclusive with the other three — when it's on, force
  // the others off server-side regardless of what was submitted, since ListingForm.tsx hides them
  // from the form entirely in that case (see the messagesOnly comment in schema.ts).
  const messagesOnly = formData.get("messagesOnly") === "on";
  const acceptsCalls = !messagesOnly && formData.get("acceptsCalls") === "on";
  const acceptsTexts = !messagesOnly && formData.get("acceptsTexts") === "on";
  const acceptsEmail = !messagesOnly && formData.get("acceptsEmail") === "on";
  const phone = String(formData.get("phone") || "").trim() || null;
  const contactEmail = String(formData.get("contactEmail") || "").trim() || null;

  if (!messagesOnly && !acceptsCalls && !acceptsTexts && !acceptsEmail) {
    return { error: "Select at least one way for clients to contact you (Phone Call, Text, Email, or Site Messages Only)." };
  }
  if ((acceptsCalls || acceptsTexts) && !phone) {
    return { error: "Enter a phone number for Phone Call / Text." };
  }
  if (acceptsEmail && !contactEmail) {
    return { error: "Enter a contact email for Email." };
  }

  // Personal/business website link — manually reviewed before it's ever shown publicly (see the
  // websiteUrl comment in schema.ts). Re-submitting the exact same URL that's already
  // approved/pending/rejected doesn't reset the review; only an actual change to the link does —
  // otherwise just hitting "Save Changes" on the rest of the form would needlessly bump an
  // approved link back into the review queue.
  const { url: websiteUrl, error: websiteError } = normalizeWebsiteUrl(String(formData.get("websiteUrl") || ""));
  if (websiteError) return { error: websiteError };
  const websiteChanged = websiteUrl !== (existing.websiteUrl ?? null);
  const websiteStatus = websiteChanged ? (websiteUrl ? "pending" : "none") : existing.websiteStatus;
  const websiteNote = websiteChanged ? null : existing.websiteNote;

  // Social links (Instagram/TikTok/X) — unlike websiteUrl above, these aren't admin-reviewed, so
  // they just save and go live immediately (see the socialLinks comment in schema.ts).
  const socialLinks = buildSocialLinksJson(formData);

  await db
    .update(cuddlers)
    .set({
      name: String(formData.get("name") || existing.name).trim() || existing.name,
      // Optional, agency accounts don't submit this field (see ListingForm.tsx) — falls back to
      // whatever was already stored rather than blanking it if the field is simply absent.
      gender: (() => {
        const raw = String(formData.get("gender") || "");
        return raw === "male" || raw === "female" ? raw : existing.accountType === "agency" ? existing.gender : null;
      })(),
      headline: String(formData.get("headline") || "").trim() || null,
      bio: String(formData.get("bio") || "").trim() || null,
      // photoUrl/photoUrl2/photoUrl3 are set directly by /api/photos (see PhotoUploader), not this form.
      phone,
      contactEmail,
      acceptsCalls,
      acceptsTexts,
      acceptsEmail,
      messagesOnly,
      hourlyRate,
      offersVirtual,
      virtualHourlyRate,
      favoriteFood,
      favoriteDessert,
      favoriteAnimal,
      enjoysPets,
      allergies,
      favoriteMusic,
      favoriteActivities,
      favoriteMovie,
      favoriteShow,
      enjoysAboutCuddling,
      nextVacationDestination,
      funFact,
      activeLifestyle,
      height,
      bodyType,
      hairColor,
      eyeColor,
      hosts,
      mobile,
      socialMediaOptIn: formData.get("socialMediaOptIn") === "on",
      websiteUrl,
      websiteStatus,
      websiteNote,
      socialLinks,
      address: String(formData.get("address") || "").trim() || null,
      city,
      state: state || "",
      zip: zipMaybe || locationText.match(/\b\d{5}\b/)?.[0] || existing.zip,
      lat: loc.lat,
      lng: loc.lng,
      city2: loc2 ? city2 : null,
      state2: loc2 ? state2 || "" : null,
      zip2: loc2 ? zipMaybe2 || locationText2.match(/\b\d{5}\b/)?.[0] || null : null,
      lat2: loc2 ? loc2.lat : null,
      lng2: loc2 ? loc2.lng : null,
      // Publishing is now its own one-click toggle (see togglePublished in app/actions.ts and the
      // button in the dashboard's Status card), not a checkbox in this form — so this save must
      // never touch it, or every listing edit would silently un-publish the ad (there's no
      // "published" field submitted by this form anymore to read a real value from).
      published: existing.published,
    })
    .where(eq(cuddlers.id, id));
  await checkGoLive(id);
  revalidatePath(`/cuddlers/${existing.slug}`);
  return { ok: "Listing saved." };
}

// HoursForm.tsx submits each open/close time as three separate selects (`${key}_hour` 1-12,
// `${key}_min` "00"|"30", `${key}_ampm` "AM"|"PM") rather than a single field — combines them into
// the "HH:MM" 24-hour string the cuddlerHours table has always stored (same format the old native
// <input type="time"> used to submit directly). An empty/missing hour means this time isn't set.
function readTime(formData: FormData, key: string): string {
  const hour = String(formData.get(`${key}_hour`) || "").trim();
  if (!hour) return "";
  const min = String(formData.get(`${key}_min`) || "00").trim();
  const ampm = String(formData.get(`${key}_ampm`) || "AM").trim().toUpperCase();
  let h = parseInt(hour, 10);
  if (!Number.isFinite(h) || h < 1 || h > 12) return "";
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const minute = min === "30" ? "30" : "00";
  return `${String(h).padStart(2, "0")}:${minute}`;
}

export async function applyHoursUpdate(
  id: string,
  slug: string,
  formData: FormData
): Promise<{ error?: string; ok?: string }> {
  // One row per actual open block — a day with none of its HOUR_BLOCKS_PER_DAY blocks filled in
  // simply gets no rows at all (closed), see cuddlerHours' comment in lib/schema.ts.
  const rows: { cuddlerId: string; dayOfWeek: number; blockIndex: number; closed: false; openTime: string; closeTime: string }[] = [];
  for (const { day } of WEEK_DAYS) {
    for (let blockIndex = 0; blockIndex < HOUR_BLOCKS_PER_DAY; blockIndex++) {
      const open = readTime(formData, `day_${day}_block${blockIndex}_open`);
      const close = readTime(formData, `day_${day}_block${blockIndex}_close`);
      if (open && close) {
        rows.push({ cuddlerId: id, dayOfWeek: day, blockIndex, closed: false, openTime: open, closeTime: close });
      }
    }
  }

  await db.delete(cuddlerHours).where(eq(cuddlerHours.cuddlerId, id));
  if (rows.length > 0) await db.insert(cuddlerHours).values(rows);

  // Checkbox absent from the submitted form = unchecked, same convention as day_X_closed above.
  const gatekeepHours = formData.get("gatekeepHours") === "on";
  await db.update(cuddlers).set({ gatekeepHours }).where(eq(cuddlers.id, id));

  revalidatePath(`/cuddlers/${slug}`);
  return { ok: "Hours saved." };
}
