import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers, reviews } from "@/lib/schema";
import { REVIEW_BODY_MAX_CHARS } from "@/lib/config";
import { verifyCaptcha } from "@/lib/captcha";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const cuddlerId = String(form.get("cuddlerId") || "").trim();
  const authorName = String(form.get("authorName") || "").trim();
  const authorEmail = String(form.get("authorEmail") || "").trim();
  const ratingRaw = Number(form.get("rating"));
  const body = String(form.get("body") || "").trim();
  const sessionTypeRaw = String(form.get("sessionType") || "").trim();
  const sessionType = sessionTypeRaw === "studio" || sessionTypeRaw === "mobile" ? sessionTypeRaw : null;

  if (!cuddlerId) return NextResponse.json({ error: "Missing listing." }, { status: 400 });
  if (!authorName) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!Number.isInteger(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
    return NextResponse.json({ error: "Choose a rating from 1 to 5." }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: "Review text is required." }, { status: 400 });
  if (body.length > REVIEW_BODY_MAX_CHARS) {
    return NextResponse.json({ error: `Keep it under ${REVIEW_BODY_MAX_CHARS} characters.` }, { status: 400 });
  }

  const exists = await db.select({ id: cuddlers.id }).from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!exists.length) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  if (!(await verifyCaptcha(form.get("cf-turnstile-response")))) {
    return NextResponse.json({ error: "Captcha check failed, please try again." }, { status: 400 });
  }

  await db.insert(reviews).values({
    cuddlerId,
    authorName,
    authorEmail: authorEmail || null,
    rating: ratingRaw,
    body,
    sessionType,
    status: "pending",
  });

  return NextResponse.json({ ok: true });
}
