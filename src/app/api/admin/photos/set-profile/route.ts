import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cuddlers, adminAuditLog } from "@/lib/schema";
import { currentAdmin } from "@/lib/adminAuth";
import { deleteObject, keyFromPublicUrl } from "@/lib/storage";
import { VIP_MAX_PHOTOS } from "@/lib/config";

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

/** Admin-authenticated version of /api/photos/set-profile — same swap logic, but scoped to a
 *  cuddlerId in the request instead of the signed-in cuddler's own session. */
export async function POST(req: NextRequest) {
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

  const slot = Number(body.slot);
  if (!(slot in SLOT_COLUMNS) || slot === 1 || slot > VIP_MAX_PHOTOS) {
    return NextResponse.json({ error: "Invalid photo slot." }, { status: 400 });
  }

  const target = SLOT_COLUMNS[slot as Slot];
  const main = SLOT_COLUMNS[1];
  const row = me as unknown as Record<string, string | number | null>;
  const targetUrl = row[target.url];
  if (!targetUrl) return NextResponse.json({ error: "That slot doesn't have a photo." }, { status: 400 });

  if (me.cardPhotoUrl) {
    const key = keyFromPublicUrl(me.cardPhotoUrl);
    if (key) deleteObject(key).catch(() => {});
  }

  const updates: Record<string, string | number | null> = {
    [main.url]: targetUrl,
    [main.w]: row[target.w],
    [main.h]: row[target.h],
    [target.url]: row[main.url],
    [target.w]: row[main.w],
    [target.h]: row[main.h],
    cardPhotoUrl: null,
  };

  await db
    .update(cuddlers)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(updates as any)
    .where(eq(cuddlers.id, cuddlerId));

  await db.insert(adminAuditLog).values({
    adminId: admin.id,
    adminName: admin.name,
    action: "admin_set_profile_photo",
    targetType: "cuddler",
    targetId: cuddlerId,
    detail: `${me.name}: slot ${slot} to profile pic`,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/cuddlers/${me.slug}`);
  revalidatePath(`/admin/cuddlers/${cuddlerId}/edit`);
  revalidatePath("/");

  return NextResponse.json({
    slot1: { url: targetUrl, w: row[target.w], h: row[target.h] },
    swappedSlot: { slot, url: row[main.url], w: row[main.w], h: row[main.h] },
  });
}
