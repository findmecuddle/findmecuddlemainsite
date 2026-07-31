import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/schema";
import { resolveLocation } from "@/lib/geo";
import { verifyCaptcha } from "@/lib/captcha";
import { createId } from "@/lib/id";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const locationText = String(form.get("location") || "").trim();
  const consent = form.get("consent") === "on";

  if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "Please check the consent box to subscribe." }, { status: 400 });
  }
  const loc = resolveLocation(locationText);
  if (!loc) {
    return NextResponse.json({ error: "Enter a 5-digit zip code or a city, e.g. Austin, TX." }, { status: 400 });
  }

  if (!(await verifyCaptcha(form.get("cf-turnstile-response")))) {
    return NextResponse.json({ error: "Captcha check failed, please try again." }, { status: 400 });
  }

  const [city, stateZip] = loc.label.split(",").map((s) => s.trim());
  const [state] = (stateZip || "").split(/\s+/);
  const now = new Date();

  const existing = await db
    .select({ id: newsletterSubscribers.id, unsubscribeToken: newsletterSubscribers.unsubscribeToken })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .limit(1);

  if (existing.length) {
    // Already subscribed — treat a resubmission as an update (new location, re-confirmed consent).
    await db
      .update(newsletterSubscribers)
      .set({ name, city, state, lat: loc.lat, lng: loc.lng, consent: true, consentAt: now })
      .where(eq(newsletterSubscribers.email, email));
  } else {
    await db.insert(newsletterSubscribers).values({
      name,
      email,
      city,
      state: state || "",
      lat: loc.lat,
      lng: loc.lng,
      consent: true,
      consentAt: now,
      unsubscribeToken: createId(),
    });
  }

  return NextResponse.json({ ok: true });
}
