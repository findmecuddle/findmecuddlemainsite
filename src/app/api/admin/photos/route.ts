import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cuddlers, flaggedPhotos, adminAuditLog } from "@/lib/schema";
import { currentAdmin } from "@/lib/adminAuth";
import { uploadObject, deleteObject, keyFromPublicUrl } from "@/lib/storage";
import { photoLimit } from "@/lib/stripe";
import { VIP_MAX_PHOTOS, MAX_PHOTO_MB, HD_MIN_WIDTH, HD_MIN_HEIGHT, PHOTO_MAX_DIMENSION } from "@/lib/config";
import { rawFormatError } from "@/lib/photoValidation";

// sharp needs the Node runtime, not edge.
export const runtime = "nodejs";

// Same pipeline and slot mapping as /api/photos/route.ts, but admin-authenticated and scoped to a
// cuddlerId passed in the request instead of the signed-in cuddler's own session — this is
// what powers the same Change/Remove/Set As Profile Pic editor on /admin/cuddlers/[id]/edit.
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

async function logAdminAction(admin: { id: string; name: string }, action: string, cuddlerId: string, detail?: string) {
  await db.insert(adminAuditLog).values({
    adminId: admin.id,
    adminName: admin.name,
    action,
    targetType: "cuddler",
    targetId: cuddlerId,
    detail,
  });
}

export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse admin photo upload form data:", err);
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const cuddlerId = String(form.get("cuddlerId") || "");
  if (!cuddlerId) return NextResponse.json({ error: "Missing cuddlerId." }, { status: 400 });
  const [me] = await db.select().from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!me) return NextResponse.json({ error: "Cuddler not found." }, { status: 404 });

  const slot = parseSlot(form.get("slot"));
  const limit = photoLimit(me);
  if (!slot || slot > limit) {
    const msg =
      slot && slot > limit
        ? `Photos ${limit + 1}-${VIP_MAX_PHOTOS} are a Monthly VIP perk for this account's current plan.`
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

  const rotated = !!meta.orientation && meta.orientation >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;

  if (width < HD_MIN_WIDTH || height < HD_MIN_HEIGHT) {
    return NextResponse.json(
      { error: `Photo must be at least ${HD_MIN_WIDTH}×${HD_MIN_HEIGHT} (HD). Yours is ${width}×${height}.` },
      { status: 400 }
    );
  }

  let outputBuffer: Buffer;
  try {
    outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width: PHOTO_MAX_DIMENSION, height: PHOTO_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    const outMeta = await sharp(outputBuffer).metadata();
    if ((outMeta.width ?? 0) < HD_MIN_WIDTH || (outMeta.height ?? 0) < HD_MIN_HEIGHT) {
      outputBuffer = await sharp(inputBuffer).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    }
  } catch {
    return NextResponse.json({ error: "Couldn't process that image. Try a different file." }, { status: 400 });
  }

  const finalMeta = await sharp(outputBuffer).metadata();
  const finalWidth = finalMeta.width ?? width;
  const finalHeight = finalMeta.height ?? height;

  let url: string;
  try {
    const key = `cuddlers/${cuddlerId}/photo-${slot}-${Date.now()}.jpg`;
    url = await uploadObject(key, outputBuffer, "image/jpeg");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Admin photo upload to object storage failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload storage isn't configured." },
      { status: 500 }
    );
  }

  const cols = SLOT_COLUMNS[slot];
  const previousUrl = (me as unknown as Record<string, string | null>)[cols.url];

  await db
    .update(cuddlers)
    .set({
      [cols.url]: url,
      [cols.w]: finalWidth,
      [cols.h]: finalHeight,
      photosStatus: "approved",
      photosNote: null,
      ...(slot === 1 ? { cardPhotoUrl: null } : {}),
    })
    .where(eq(cuddlers.id, cuddlerId));

  if (previousUrl) {
    const oldKey = keyFromPublicUrl(previousUrl);
    if (oldKey) deleteObject(oldKey).catch(() => {});
    db.delete(flaggedPhotos).where(eq(flaggedPhotos.photoUrl, previousUrl)).catch(() => {});
  }
  if (slot === 1 && me.cardPhotoUrl) {
    const oldCardKey = keyFromPublicUrl(me.cardPhotoUrl);
    if (oldCardKey) deleteObject(oldCardKey).catch(() => {});
  }

  await logAdminAction(admin, "admin_upload_photo", cuddlerId, `${me.name}: slot ${slot}`);

  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);
  revalidatePath(`/admin/cuddlers/${cuddlerId}/edit`);
  revalidatePath("/");

  return NextResponse.json({ url, width: finalWidth, height: finalHeight, slot });
}

export async function DELETE(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { cuddlerId?: string; slot?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const cuddlerId = String(body.cuddlerId || "");
  if (!cuddlerId) return NextResponse.json({ error: "Missing cuddlerId." }, { status: 400 });
  const [me] = await db.select().from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!me) return NextResponse.json({ error: "Cuddler not found." }, { status: 404 });

  const slot = parseSlot(body.slot ?? null);
  if (!slot) return NextResponse.json({ error: `Photo slot must be between 1 and ${VIP_MAX_PHOTOS}.` }, { status: 400 });

  const cols = SLOT_COLUMNS[slot];
  const previousUrl = (me as unknown as Record<string, string | null>)[cols.url];

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
      ...(slot === 1 ? { cardPhotoUrl: null } : {}),
    })
    .where(eq(cuddlers.id, cuddlerId));

  if (previousUrl) {
    const oldKey = keyFromPublicUrl(previousUrl);
    if (oldKey) deleteObject(oldKey).catch(() => {});
    db.delete(flaggedPhotos).where(eq(flaggedPhotos.photoUrl, previousUrl)).catch(() => {});
  }
  if (slot === 1 && me.cardPhotoUrl) {
    const oldCardKey = keyFromPublicUrl(me.cardPhotoUrl);
    if (oldCardKey) deleteObject(oldCardKey).catch(() => {});
  }

  await logAdminAction(admin, "admin_remove_photo", cuddlerId, `${me.name}: slot ${slot}`);

  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);
  revalidatePath(`/admin/cuddlers/${cuddlerId}/edit`);
  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
