import { NextResponse } from "next/server";
import { currentCuddler } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { SITE_URL } from "@/lib/config";

export async function POST() {
  const me = await currentCuddler();
  if (!me?.stripeCustomerId) return NextResponse.redirect(new URL("/dashboard", SITE_URL), 303);

  const session = await stripe().billingPortal.sessions.create({
    customer: me.stripeCustomerId,
    return_url: `${SITE_URL}/dashboard`,
  });
  return NextResponse.redirect(session.url, 303);
}
