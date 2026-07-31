import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers } from "@/lib/schema";
import { currentCuddler } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { SITE_URL } from "@/lib/config";

export const runtime = "nodejs";

// Kicks off an automated Stripe Identity check (live selfie + government ID scan). The actual
// pass/fail result comes back asynchronously via the identity.verification_session.* webhook
// events (see /api/stripe/webhook) — this route just starts a session and hands the frontend a
// client secret to open Stripe's hosted verification modal.
export async function POST() {
  const me = await currentCuddler();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (me.identityStatus === "verified") {
    return NextResponse.json({ error: "Your identity is already verified." }, { status: 400 });
  }

  try {
    const session = await stripe().identity.verificationSessions.create({
      type: "document",
      options: { document: { require_matching_selfie: true } },
      metadata: { cuddlerId: me.id },
      return_url: `${SITE_URL}/dashboard`,
    });

    await db
      .update(cuddlers)
      .set({ identitySessionId: session.id, identityStatus: "pending" })
      .where(eq(cuddlers.id, me.id));

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start identity verification." },
      { status: 500 }
    );
  }
}
