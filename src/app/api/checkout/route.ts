import { NextRequest, NextResponse } from "next/server";
import { currentCuddler } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers } from "@/lib/schema";
import { stripe } from "@/lib/stripe";
import { creditPacks, PLANS, AGENCY_PLAN_KEYS, SITE_URL } from "@/lib/config";
import { isAgencyAccount } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const me = await currentCuddler();
  if (!me) return NextResponse.redirect(new URL("/login", SITE_URL), 303);

  const form = await req.formData();
  const type = String(form.get("type") || "");

  // Reuse or create the Stripe customer
  let customerId = me.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: me.email,
      name: me.name,
      metadata: { cuddlerId: me.id },
    });
    customerId = customer.id;
    await db.update(cuddlers).set({ stripeCustomerId: customerId }).where(eq(cuddlers.id, me.id));
  }

  if (type === "plan") {
    const planKey = String(form.get("plan") || "");
    const plan = PLANS.find((p) => p.key === planKey);
    const priceId = plan?.priceId();
    if (!plan || !priceId) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    // Agency plans are only for agency accounts and vice versa — the dashboard already only shows the
    // matching set (see availablePlans in dashboard/page.tsx), this is just the server-side backstop.
    if (AGENCY_PLAN_KEYS.includes(plan.key) !== isAgencyAccount(me)) {
      return NextResponse.json({ error: "That plan isn't available for this account." }, { status: 400 });
    }

    // Already on an active paid subscription — switch its price in place instead of starting a
    // second, parallel subscription (which is what re-running Checkout below would do, doubling
    // their billing). Stripe prorates automatically: an upgrade is charged immediately for the
    // difference, a downgrade is credited toward the next invoice. Only a brand-new subscriber or
    // someone fully lapsed (subStatus not "active") goes through Checkout.
    if (me.stripeSubscriptionId && me.subStatus === "active") {
      const sub = await stripe().subscriptions.retrieve(me.stripeSubscriptionId);
      const item = sub.items.data[0];
      if (item && item.price.id !== priceId) {
        try {
          // payment_behavior: "pending_if_incomplete" is the critical piece here — WITHOUT it,
          // Stripe's default behavior is to apply the plan/price switch immediately and THEN
          // attempt to charge the prorated difference; if that charge fails (declined card,
          // insufficient funds, etc.) the switch still goes through but the subscription's real
          // status flips to "past_due", which takes an already-active, already-paying listing
          // offline over an unrelated failed upgrade charge. With pending_if_incomplete, a failed
          // charge leaves the subscription exactly as it was (still active, still on the old
          // plan/price) and just parks the attempted change in a `pending_update` — nothing about
          // their current listing changes. Confirmed via Stripe's docs on proration_behavior +
          // payment_behavior interaction and pending updates.
          const updated = await stripe().subscriptions.update(me.stripeSubscriptionId, {
            items: [{ id: item.id, price: priceId }],
            proration_behavior: "always_invoice",
            payment_behavior: "pending_if_incomplete",
            metadata: { cuddlerId: me.id, plan: plan.key },
          });
          // A non-null pending_update means the charge failed and the switch did NOT apply —
          // surface that as a failure even though the API call itself succeeded.
          if (updated.pending_update) {
            return NextResponse.redirect(`${SITE_URL}/dashboard?checkout=plan_failed`, 303);
          }
        } catch {
          return NextResponse.redirect(`${SITE_URL}/dashboard?checkout=plan_failed`, 303);
        }
      }
      return NextResponse.redirect(`${SITE_URL}/dashboard?checkout=success`, 303);
    }

    const session = await stripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { cuddlerId: me.id, plan: plan.key } },
      metadata: { cuddlerId: me.id, kind: "plan", plan: plan.key },
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/dashboard?checkout=success`,
      cancel_url: `${SITE_URL}/dashboard?checkout=canceled`,
    });
    return NextResponse.redirect(session.url!, 303);
  }

  if (type === "credits") {
    const priceId = String(form.get("priceId") || "");
    const pack = creditPacks().find((p) => p.priceId === priceId);
    if (!pack) return NextResponse.json({ error: "Unknown credit pack" }, { status: 400 });

    const session = await stripe().checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: pack.priceId, quantity: 1 }],
      metadata: { cuddlerId: me.id, kind: "credits", credits: String(pack.credits) },
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/dashboard?checkout=success`,
      cancel_url: `${SITE_URL}/dashboard?checkout=canceled`,
    });
    return NextResponse.redirect(session.url!, 303);
  }

  return NextResponse.json({ error: "Unknown checkout type" }, { status: 400 });
}
