import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cuddlers } from "@/lib/schema";
import { currentCuddler } from "@/lib/auth";
import { uploadPrivateObject, deletePrivateObject } from "@/lib/storage";
import { VERIFICATION_MAX_MB } from "@/lib/config";

// sharp needs the Node runtime, not edge.
export const runtime = "nodejs";

// The license document doesn't need to meet the HD bar ad photos do — legibility matters more
// than resolution, and we don't want to block someone whose phone camera is a few years old.
export async function POST(req: NextRequest) {
  const me = await currentCuddler();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  // Alternate path: cuddler attests their state doesn't require a cuddle therapy license,
  // instead of uploading a document. Still lands in the same pending queue for a human to check —
  // see the licenseNotRequired comment in schema.ts for why this isn't an automatic bypass.
  if (form.get("licenseNotRequired") === "true") {
    const previousKey = me.licenseKey;
    await db
      .update(cuddlers)
      .set({
        licenseKey: null,
        licenseNotRequired: true,
        verificationStatus: "pending",
        verificationNote: null,
        verificationSubmittedAt: new Date(),
        verifiedAt: null,
      })
      .where(eq(cuddlers.id, me.id));

    if (previousKey) deletePrivateObject(previousKey).catch(() => {});

    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true, status: "pending" });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image (JPEG, PNG, or WebP)." }, { status: 400 });
  }
  if (file.size > VERIFICATION_MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Image must be under ${VERIFICATION_MAX_MB}MB.` }, { status: 400 });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  // Re-encode: auto-orient, strip EXIF/GPS. No resize/HD floor — legibility over resolution.
  let outputBuffer: Buffer;
  try {
    outputBuffer = await sharp(inputBuffer).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Couldn't process that image. Try a different file." }, { status: 400 });
  }

  const previousKey = me.licenseKey;
  const key = `verification/${me.id}/license-${Date.now()}.jpg`;

  try {
    await uploadPrivateObject(key, outputBuffer, "image/jpeg");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload storage isn't configured." },
      { status: 500 }
    );
  }

  // A fresh document (whether first submission or a resubmission after rejection, or even a
  // swap on an already-approved account) always needs a human to look at it again.
  await db
    .update(cuddlers)
    .set({
      licenseKey: key,
      licenseNotRequired: false,
      verificationStatus: "pending",
      verificationNote: null,
      verificationSubmittedAt: new Date(),
      verifiedAt: null,
    })
    .where(eq(cuddlers.id, me.id));

  if (previousKey) deletePrivateObject(previousKey).catch(() => {});

  revalidatePath("/dashboard");

  return NextResponse.json({ ok: true, status: "pending" });
}
