import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cuddlers, flaggedPhotos } from "@/lib/schema";
import { currentCuddler } from "@/lib/auth";
import { uploadObject, deleteObject, keyFromPublicUrl } from "@/lib/storage";
import { photoLimit } from "@/lib/stripe";
import { VIP_MAX_PHOTOS, MAX_PHOTO_MB, HD_MIN_WIDTH, HD_MIN_HEIGHT, PHOTO_MAX_DIMENSION } from "@/lib/config";
import { rawFormatError } from "@/lib/photoValidation";

// sharp needs the Node runtime, not edge.
export const runtime = "nodejs";

const SLOT_COLUMNS = {
  1: { url: "photoUrl", w: "photoW", h: "photoH" },
  2: { url: "photoUrl2", w: "photoW2", h: "photoH2" },
  3: { url: "photoUrl3", w: "photoW3", h: "photoH3" },
  4: { url: "photoUrl4", w: "photoW4", h: "photoH4" },
  5: { url: "photoUrl5", w: "photoW5", h: "photoH5" },
  6: { url: "photoUrl6", w: "photoW6", h: "photoH6" },
} as const;

type Slot = keyof typeof SLOT_COLUMNS;

function parseSlot(raw: unknown): Slot | null {
  const n = Number(raw);
  return n >= 1 && n <= VIP_MAX_PHOTOS ? (n as Slot) : null;
}

export async function POST(req: NextRequest) {
  const me = await currentCuddler();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse photo upload form data:", err);
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const slot = parseSlot(form.get("slot"));
  const limit = photoLimit(me);
  if (!slot || slot > limit) {
    const msg =
      slot && slot > limit
        ? `Photos ${limit + 1}-${VIP_MAX_PHOTOS} are a Monthly VIP perk. Upgrade to add more.`
        : `Photo slot must be between 1 and ${VIP_MAX_PHOTOS}.`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  const rawError = rawFormatError(file.name);
  if (rawError) return NextResponse.json({ error: rawError }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image (JPEG, PNG, or WebP)." }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Image must be under ${MAX_PHOTO_MB}MB.` }, { status: 400 });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let meta: sharp.Metadata;
  try {
    meta = await sharp(inputBuffer).metadata();
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid image file." }, { status: 400 });
  }

  // Account for EXIF rotation: a 720x1280 portrait photo tagged "rotate 90" is
  // still HD once oriented, so compare the auto-rotated dimensions.
  const rotated = !!meta.orientation && meta.orientation >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;

  if (width < HD_MIN_WIDTH || height < HD_MIN_HEIGHT) {
    return NextResponse.json(
      {
        error: `Photo must be at least ${HD_MIN_WIDTH}×${HD_MIN_HEIGHT} (HD). Yours is ${width}×${height}.`,
      },
      { status: 400 }
    );
  }

  // Re-encode: auto-orient, strip EXIF/GPS, cap dimensions, normalize to JPEG.
  // fit:"inside" preserves the original aspect ratio (portrait or landscape) —
  // it only ever shrinks the longer side, never crops or forces a square.
  let outputBuffer: Buffer;
  try {
    outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width: PHOTO_MAX_DIMENSION, height: PHOTO_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    // Guard against pathological aspect ratios where capping the long side
    // pushes the short side below the HD floor — fall back to no resize.
    const outMeta = await sharp(outputBuffer).metadata();
    if ((outMeta.width ?? 0) < HD_MIN_WIDTH || (outMeta.height ?? 0) < HD_MIN_HEIGHT) {
      outputBuffer = await sharp(inputBuffer).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    }
  } catch {
    return NextResponse.json({ error: "Couldn't process that image. Try a different file." }, { status: 400 });
  }

  // Final dimensions of what actually gets stored — saved alongside the URL so the
  // gallery can render each photo at its true aspect ratio (portrait or landscape).
  const finalMeta = await sharp(outputBuffer).metadata();
  const finalWidth = finalMeta.width ?? width;
  const finalHeight = finalMeta.height ?? height;

  let url: string;
  try {
    const key = `cuddlers/${me.id}/photo-${slot}-${Date.now()}.jpg`;
    url = await uploadObject(key, outputBuffer, "image/jpeg");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload storage isn't configured." },
      { status: 500 }
    );
  }

  const cols = SLOT_COLUMNS[slot];
  const previousUrl = (me as unknown as Record<string, string | null>)[cols.url];

  // Photos go live immediately — no admin review step (removed; every upload already passes
  // through the same HD/re-encode/EXIF-strip pipeline above, which was the actual safeguard).
  await db
    .update(cuddlers)
    .set({
      [cols.url]: url,
      [cols.w]: finalWidth,
      [cols.h]: finalHeight,
      photosStatus: "approved",
      photosNote: null,
      // Replacing slot 1 (the profile pic) makes any existing card crop stale — it was cropped
      // from the photo that's no longer there. See cardPhotoUrl in schema.ts.
      ...(slot === 1 ? { cardPhotoUrl: null } : {}),
    })
    .where(eq(cuddlers.id, me.id));

  // Best-effort cleanup of the replaced photo; a failed delete shouldn't fail the upload.
  if (previousUrl) {
    const oldKey = keyFromPublicUrl(previousUrl);
    if (oldKey) deleteObject(oldKey).catch(() => {});
    // Also clear any stale flag pointing at the photo that just got replaced.
    db.delete(flaggedPhotos).where(eq(flaggedPhotos.photoUrl, previousUrl)).catch(() => {});
  }
  if (slot === 1 && me.cardPhotoUrl) {
    const oldCardKey = keyFromPublicUrl(me.cardPhotoUrl);
    if (oldCardKey) deleteObject(oldCardKey).catch(() => {});
  }

  // No automatic screening — photos go live immediately and get reviewed manually. An admin can
  // flag a photo themselves from /admin/cuddlers/[id]/edit if something looks off (see
  // manualFlagPhoto in admin/actions.ts); it lands in the same Flagged Photos queue on /admin.

  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);

  return NextResponse.json({ url, width: finalWidth, height: finalHeight, slot });
}

export async function DELETE(req: NextRequest) {
  const me = await currentCuddler();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { slot?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const slot = parseSlot(body.slot ?? null);
  if (!slot) return NextResponse.json({ error: `Photo slot must be between 1 and ${VIP_MAX_PHOTOS}.` }, { status: 400 });

  const cols = SLOT_COLUMNS[slot];
  const previousUrl = (me as unknown as Record<string, string | null>)[cols.url];

  // If this was the last remaining photo, there's nothing left to review — reset to "none" so the
  // dashboard doesn't show a stale pending/approved/rejected status for an empty gallery.
  const remaining = (Object.values(SLOT_COLUMNS) as (typeof SLOT_COLUMNS)[Slot][])
    .map((c) => c.url)
    .filter((urlCol) => urlCol !== cols.url)
    .some((urlCol) => (me as unknown as Record<string, string | null>)[urlCol]);

  await db
    .update(cuddlers)
    .set({
      [cols.url]: null,
      [cols.w]: null,
      [cols.h]: null,
      ...(remaining ? {} : { photosStatus: "none", photosNote: null }),
      // Removing slot 1 makes any existing card crop stale — see cardPhotoUrl in schema.ts.
      ...(slot === 1 ? { cardPhotoUrl: null } : {}),
    })
    .where(eq(cuddlers.id, me.id));

  if (previousUrl) {
    const oldKey = keyFromPublicUrl(previousUrl);
    if (oldKey) deleteObject(oldKey).catch(() => {});
    db.delete(flaggedPhotos).where(eq(flaggedPhotos.photoUrl, previousUrl)).catch(() => {});
  }
  if (slot === 1 && me.cardPhotoUrl) {
    const oldCardKey = keyFromPublicUrl(me.cardPhotoUrl);
    if (oldCardKey) deleteObject(oldCardKey).catch(() => {});
  }

  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);

  return NextResponse.json({ ok: true });
}
