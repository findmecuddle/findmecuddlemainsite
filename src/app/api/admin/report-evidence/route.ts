import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports } from "@/lib/schema";
import { isAdmin } from "@/lib/adminAuth";
import { getPrivateObject } from "@/lib/storage";

export const runtime = "nodejs";

const COLUMNS = {
  "1": reports.photoUrl1,
  "2": reports.photoUrl2,
  "3": reports.photoUrl3,
} as const;

// Streams report evidence photos straight from the private bucket — never a public URL, never
// cached by a CDN, gated on an active admin session. Evidence can contain sensitive material
// (faces, locations, alleged misconduct), so it must never be reachable by a plain link.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const reportId = req.nextUrl.searchParams.get("reportId") || "";
  const index = req.nextUrl.searchParams.get("index") || "";
  const column = COLUMNS[index as keyof typeof COLUMNS];
  if (!reportId || !column) {
    return NextResponse.json({ error: "Missing or invalid reportId/index." }, { status: 400 });
  }

  const rows = await db.select({ key: column }).from(reports).where(eq(reports.id, reportId)).limit(1);
  const key = rows[0]?.key;
  if (!key) return NextResponse.json({ error: "No photo on file." }, { status: 404 });

  const obj = await getPrivateObject(key);
  if (!obj) return NextResponse.json({ error: "Photo not found in storage." }, { status: 404 });

  return new NextResponse(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
