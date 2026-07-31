import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { agencyEmployees, flaggedPhotos } from "@/lib/schema";
import { currentCuddler } from "@/lib/auth";
import { uploadObject, deleteObject, keyFromPublicUrl } from "@/lib/storage";
import { MAX_PHOTO_MB, HD_MIN_WIDTH, HD_MIN_HEIGHT, PHOTO_MAX_DIMENSION } from "@/lib/config";

// sharp needs the Node runtime, not edge — same as /api/photos.
export const runtime = "nodejs";

/** One photo per agency employee (no slots — see agencyEmployees.photoUrl in lib/schema.ts). Confirms
 *  the employee actually belongs to whoever's signed in before touching anything. */
async function authorizedEmployee(employeeId: string) {
  const me = await currentCuddler();
  if (!me) return null;
  const [emp] = await db.select().from(agencyEmployees).where(eq(agencyEmployees.id, employeeId)).limit(1);
  if (!emp || emp.cuddlerId !== me.id) return null;
  return { me, emp };
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const employeeId = String(form.get("employeeId") || "");
  const authed = employeeId ? await authorizedEmployee(employeeId) : null;
  if (!authed) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const { me, emp } = authed;

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
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

  // Account for EXIF rotation, same as /api/photos.
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
    const key = `agency-employees/${emp.id}/photo-${Date.now()}.jpg`;
    url = await uploadObject(key, outputBuffer, "image/jpeg");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload storage isn't configured." },
      { status: 500 }
    );
  }

  const previousUrl = emp.photoUrl;
  await db
    .update(agencyEmployees)
    .set({ photoUrl: url, photoW: finalWidth, photoH: finalHeight })
    .where(eq(agencyEmployees.id, emp.id));

  if (previousUrl) {
    const oldKey = keyFromPublicUrl(previousUrl);
    if (oldKey) deleteObject(oldKey).catch(() => {});
    db.delete(flaggedPhotos).where(eq(flaggedPhotos.photoUrl, previousUrl)).catch(() => {});
  }

  // No automatic screening — same as /api/photos, see the comment there.

  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);

  return NextResponse.json({ url, width: finalWidth, height: finalHeight });
}

export async function DELETE(req: NextRequest) {
  let body: { employeeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const employeeId = String(body.employeeId || "");
  const authed = employeeId ? await authorizedEmployee(employeeId) : null;
  if (!authed) return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  const { me, emp } = authed;

  if (emp.photoUrl) {
    const key = keyFromPublicUrl(emp.photoUrl);
    if (key) deleteObject(key).catch(() => {});
    db.delete(flaggedPhotos).where(eq(flaggedPhotos.photoUrl, emp.photoUrl)).catch(() => {});
  }
  await db.update(agencyEmployees).set({ photoUrl: null, photoW: null, photoH: null }).where(eq(agencyEmployees.id, emp.id));

  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);

  return NextResponse.json({ ok: true });
}
