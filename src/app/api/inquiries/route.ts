import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers, inquiries } from "@/lib/schema";
import { sendInquiryEmail } from "@/lib/email";
import { verifyCaptcha } from "@/lib/captcha";
import { rateLimit } from "@/lib/rateLimit";
import { DURATION_OPTIONS, INQUIRY_MESSAGE_MAX_CHARS, SITE_NAME, SITE_URL } from "@/lib/config";

// "Send My Info" — a client leaves their name + phone and/or email (no account needed). It's
// emailed straight to the cuddler AND saved to the inquiries table so it shows up in their
// dashboard message list too (see MessagesCard.tsx) — handy for requests that come in while
// they're offline. Any follow-up still happens off-platform (call/text/email), same as before; see
// lib/email.ts's sendInquiryEmail comment for why this stays a lighter alternative to giving
// clients real accounts, something this app deliberately doesn't do anywhere else.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const cuddlerId = String(form.get("cuddlerId") || "").trim();
  const clientName = String(form.get("name") || "").trim();
  const clientPhone = String(form.get("phone") || "").trim() || null;
  const clientEmail = String(form.get("email") || "").trim() || null;
  const message = String(form.get("message") || "").trim().slice(0, INQUIRY_MESSAGE_MAX_CHARS) || null;
  const cuddleType = String(form.get("cuddleType") || "").trim() || null;
  const rawLocationType = String(form.get("locationType") || "");
  const locationType = rawLocationType === "incall" || rawLocationType === "outcall" ? rawLocationType : null;
  const rawDuration = String(form.get("duration") || "").trim();
  const duration = DURATION_OPTIONS.includes(rawDuration) ? rawDuration : null;
  const flexible = String(form.get("flexible") || "") === "on";
  // Ignore date/time entirely when they asked for "whenever you're open" — keeps the stored data
  // consistent with what's actually shown back to the cuddler (see MessagesCard.tsx).
  const preferredDate = !flexible ? String(form.get("preferredDate") || "").trim() || null : null;
  const preferredTime = !flexible ? String(form.get("preferredTime") || "").trim() || null : null;

  if (!cuddlerId) return NextResponse.json({ error: "Missing listing." }, { status: 400 });
  if (!clientName) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!clientPhone && !clientEmail) {
    return NextResponse.json({ error: "Enter a phone number or an email so they can reach you." }, { status: 400 });
  }
  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!rateLimit(`inquiry:${cuddlerId}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many requests for this listing. Try again later." }, { status: 429 });
  }
  if (!(await verifyCaptcha(form.get("cf-turnstile-response")))) {
    return NextResponse.json({ error: "Captcha check failed, please try again." }, { status: 400 });
  }

  const rows = await db
    .select({
      name: cuddlers.name,
      slug: cuddlers.slug,
      email: cuddlers.email,
      contactEmail: cuddlers.contactEmail,
    })
    .from(cuddlers)
    .where(eq(cuddlers.id, cuddlerId))
    .limit(1);
  const t = rows[0];
  if (!t) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  await db.insert(inquiries).values({
    cuddlerId,
    clientName,
    clientPhone,
    clientEmail,
    message,
    cuddleType,
    locationType,
    preferredDate,
    preferredTime,
    duration,
    flexible,
  });

  await sendInquiryEmail({
    to: t.contactEmail || t.email,
    clientName,
    clientPhone,
    clientEmail,
    message,
    cuddleType,
    locationType,
    preferredDate,
    preferredTime,
    duration,
    flexible,
    cuddlerName: t.name,
    listingUrl: `${SITE_URL}/cuddlers/${t.slug}`,
    siteName: SITE_NAME,
  });

  return NextResponse.json({ ok: true });
}
