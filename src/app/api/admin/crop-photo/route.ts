import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cuddlers, flaggedPhotos } from "@/lib/schema";
import { currentAdmin } from "@/lib/adminAuth";
import { uploadObject, deleteObject, keyFromPublicUrl } from "@/lib/storage";

// sharp needs the Node runtime, not edge — same as /api/photos.
export const runtime = "nodejs";

type Body = {
  cuddlerId?: string;
  flagId?: string;
  // Crop rectangle as 0-1 fractions of the original image, from the admin crop UI.
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Crops the cuddler's main profile photo (slot 1 only — see the comment on cardPhotoUrl in
 * schema.ts) and saves the result as cardPhotoUrl, used just for the small card thumbnail on
 * ListingCard and the homepage grids. The original photoUrl is never touched, so the full photo
 * still shows on the public profile page. Always crops from the current photoUrl (the true
 * original), never from a previous cardPhotoUrl, so re-cropping doesn't compound quality loss or
 * get stuck with a bad earlier framing choice.
 */
export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { left, top, width, height, cuddlerId } = body;
  const fractionsValid = [left, top, width, height].every(
    (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1
  );
  if (!fractionsValid || width <= 0.01 || height <= 0.01 || left + width > 1.001 || top + height > 1.001) {
    return NextResponse.json({ error: "Invalid crop area." }, { status: 400 });
  }
  if (!cuddlerId) return NextResponse.json({ error: "Missing cuddlerId." }, { status: 400 });

  const [t] = await db.select().from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!t) return NextResponse.json({ error: "Cuddler not found." }, { status: 404 });
  if (!t.photoUrl) return NextResponse.json({ error: "This listing doesn't have a profile photo." }, { status: 404 });

  // Fetch the ORIGINAL photo — the public bucket serves it over plain HTTP, no special credentials
  // needed (see lib/storage.ts). Cropping always starts from here, never from a previous crop.
  let inputBuffer: Buffer;
  try {
    const res = await fetch(t.photoUrl);
    if (!res.ok) throw new Error("fetch failed");
    inputBuffer = Buffer.from(await res.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Couldn't load the current photo." }, { status: 500 });
  }

  let outputBuffer: Buffer;
  try {
    const meta = await sharp(inputBuffer).rotate().metadata();
    const srcW = meta.width ?? 0;
    const srcH = meta.height ?? 0;
    if (!srcW || !srcH) throw new Error("no dimensions");

    const extractLeft = Math.round(left * srcW);
    const extractTop = Math.round(top * srcH);
    const extractWidth = Math.max(1, Math.min(srcW - extractLeft, Math.round(width * srcW)));
    const extractHeight = Math.max(1, Math.min(srcH - extractTop, Math.round(height * srcH)));

    outputBuffer = await sharp(inputBuffer)
      .rotate() // normalize EXIF orientation first, same as the upload pipeline, so the crop box lines up with what the admin saw on screen
      .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Couldn't crop that image." }, { status: 500 });
  }

  let newUrl: string;
  try {
    const key = `cuddlers/${cuddlerId}/card-crop-${Date.now()}.jpg`;
    newUrl = await uploadObject(key, outputBuffer, "image/jpeg");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload storage isn't configured." },
      { status: 500 }
    );
  }

  // Clean up the previous card crop, if any — never the original photoUrl.
  if (t.cardPhotoUrl) {
    const oldKey = keyFromPublicUrl(t.cardPhotoUrl);
    if (oldKey) deleteObject(oldKey).catch(() => {});
  }

  await db.update(cuddlers).set({ cardPhotoUrl: newUrl }).where(eq(cuddlers.id, cuddlerId));

  // A crop is a fix — if this came from the Flagged Photos queue, resolve that flag too.
  if (body.flagId) await db.delete(flaggedPhotos).where(eq(flaggedPhotos.id, body.flagId));

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath(`/cuddlers/${t.slug}`);

  return NextResponse.json({ url: newUrl });
}
