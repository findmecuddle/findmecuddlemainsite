import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers, reports } from "@/lib/schema";
import { uploadPrivateObject } from "@/lib/storage";
import { createId } from "@/lib/id";
import { REPORT_BODY_MAX_CHARS, REPORT_MAX_PHOTOS, MAX_PHOTO_MB, PHOTO_MAX_DIMENSION } from "@/lib/config";
import { verifyCaptcha } from "@/lib/captcha";

// sharp needs the Node runtime, not edge.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const cuddlerId = String(form.get("cuddlerId") || "").trim();
  const reporterEmail = String(form.get("reporterEmail") || "").trim();
  const body = String(form.get("body") || "").trim();

  if (!cuddlerId) return NextResponse.json({ error: "Missing listing." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Please describe the issue." }, { status: 400 });
  if (body.length > REPORT_BODY_MAX_CHARS) {
    return NextResponse.json({ error: `Keep it under ${REPORT_BODY_MAX_CHARS} characters.` }, { status: 400 });
  }

  const exists = await db.select({ id: cuddlers.id }).from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!exists.length) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  if (!(await verifyCaptcha(form.get("cf-turnstile-response")))) {
    return NextResponse.json({ error: "Captcha check failed, please try again." }, { status: 400 });
  }

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > REPORT_MAX_PHOTOS) {
    return NextResponse.json({ error: `Attach up to ${REPORT_MAX_PHOTOS} photos.` }, { status: 400 });
  }

  const reportId = createId();
  // Storage keys, not public URLs — evidence photos can contain sensitive material and are
  // uploaded to the private bucket. Only ever served via the admin-authorized
  // /api/admin/report-evidence route, never a direct link. See schema.ts comment on these columns.
  const photoKeys: (string | null)[] = [null, null, null];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Evidence files must be images." }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      return NextResponse.json({ error: `Each photo must be under ${MAX_PHOTO_MB}MB.` }, { status: 400 });
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    let outputBuffer: Buffer;
    try {
      // No HD requirement for evidence — screenshots and low-res photos are still useful.
      // Still strip EXIF/GPS for the reporter's own privacy, and cap dimensions.
      outputBuffer = await sharp(inputBuffer)
        .rotate()
        .resize({ width: PHOTO_MAX_DIMENSION, height: PHOTO_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    } catch {
      return NextResponse.json({ error: "Couldn't process one of the photos. Try a different file." }, { status: 400 });
    }

    try {
      const key = `reports/${reportId}/photo-${i + 1}.jpg`;
      await uploadPrivateObject(key, outputBuffer, "image/jpeg");
      photoKeys[i] = key;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Upload storage isn't configured." },
        { status: 500 }
      );
    }
  }

  await db.insert(reports).values({
    id: reportId,
    cuddlerId,
    reporterEmail: reporterEmail || null,
    body,
    photoUrl1: photoKeys[0],
    photoUrl2: photoKeys[1],
    photoUrl3: photoKeys[2],
    status: "pending",
  });

  return NextResponse.json({ ok: true });
}
