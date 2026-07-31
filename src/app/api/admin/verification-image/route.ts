import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers } from "@/lib/schema";
import { isAdmin } from "@/lib/adminAuth";
import { getPrivateObject } from "@/lib/storage";

export const runtime = "nodejs";

// Streams the license photo straight from the private bucket — never a public URL, never
// cached by a CDN, and gated on an active admin session. This is the only way this image
// is ever served. (Government ID review is now handled automatically by Stripe Identity,
// not stored or served here.)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const cuddlerId = req.nextUrl.searchParams.get("cuddlerId") || "";
  if (!cuddlerId) {
    return NextResponse.json({ error: "Missing cuddlerId." }, { status: 400 });
  }

  const rows = await db
    .select({ licenseKey: cuddlers.licenseKey })
    .from(cuddlers)
    .where(eq(cuddlers.id, cuddlerId))
    .limit(1);
  const key = rows[0]?.licenseKey;
  if (!key) return NextResponse.json({ error: "No document on file." }, { status: 404 });

  const obj = await getPrivateObject(key);
  if (!obj) return NextResponse.json({ error: "Document not found in storage." }, { status: 404 });

  return new NextResponse(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
