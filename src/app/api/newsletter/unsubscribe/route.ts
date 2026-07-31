import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/schema";
import { SITE_URL } from "@/lib/config";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (token) {
    await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.unsubscribeToken, token));
  }
  return NextResponse.redirect(`${SITE_URL}/newsletter/unsubscribed`, 303);
}
