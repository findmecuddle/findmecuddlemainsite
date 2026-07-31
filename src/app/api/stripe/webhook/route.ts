import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers, creditEvents } from "@/lib/schema";
import { stripe } from "@/lib/stripe";
import { checkGoLive } from "@/lib/activity";
import { VIP_PLAN_KEY, VIP_BOOST_GRANT } from "@/lib/config";

/**
 * The subscription ID on an Invoice moved from the flat `invoice.subscription` field to
 * `invoice.parent.subscription_details.subscription` as of Stripe API version 2025-03-31.basil.
 * Our webhook endpoint is configured to send events in a newer API version, so `invoice.subscription`
 * is always null there — this checks the new location first and falls back to the old one so it
 * works regardless of which API version is actually delivering the event. (stripe-node's bundled
 * types predate the `parent` field, hence the cast.)
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const withParent = invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } | null } | null;
  };
  const fromParent = withParent.parent?.subscription_details?.subscription;
  if (fromParent) return typeof fromParent === "string" ? fromParent : fromParent.id;
  return (invoice.subscription as string | null) ?? null;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    // Boost credit purchases (one-time payments)
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.kind === "credits" && session.payment_status === "paid") {
        const cuddlerId = session.metadata.cuddlerId;
        const credits = parseInt(session.metadata.credits || "0", 10);
        if (cuddlerId && credits > 0) {
          // Idempotency: skip if this session was already recorded
          const reason = `purchase:${session.id}`;
          const existing = await db
            .select({ id: creditEvents.id })
            .from(creditEvents)
            .where(and(eq(creditEvents.cuddlerId, cuddlerId), eq(creditEvents.reason, reason)))
            .limit(1);
          if (!existing.length) {
            await db
              .update(cuddlers)
              .set({ credits: sql`${cuddlers.credits} + ${credits}` })
              .where(eq(cuddlers.id, cuddlerId));
            await db.insert(creditEvents).values({ cuddlerId, delta: credits, reason });
          }
        }
      }
      break;
    }

    // Subscription paid (first payment and every renewal)
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoiceSubscriptionId(invoice);
      if (subId) {
        const sub = await stripe().subscriptions.retrieve(subId);
        const cuddlerId = sub.metadata?.cuddlerId;
        if (cuddlerId) {
          await db
            .update(cuddlers)
            .set({
              stripeSubscriptionId: sub.id,
              plan: sub.metadata?.plan ?? null,
              subStatus: "active",
              activeUntil: new Date(sub.current_period_end * 1000),
              // An invoice only gets paid on a subscription that isn't scheduled to cancel (Stripe
              // doesn't renew a cancel_at_period_end subscription) — so this event always means any
              // earlier cancellation request (see cancelSubscription() in actions.ts) no longer
              // applies, whether it was undone or this is a brand-new resubscribe.
              cancelRequestedAt: null,
            })
            .where(eq(cuddlers.id, cuddlerId));

          // Monthly VIP perk: 10 free boost credits every paid billing cycle (idempotent per invoice).
          if (sub.metadata?.plan === VIP_PLAN_KEY) {
            const reason = `grant:${invoice.id}`;
            const already = await db
              .select({ id: creditEvents.id })
              .from(creditEvents)
              .where(and(eq(creditEvents.cuddlerId, cuddlerId), eq(creditEvents.reason, reason)))
              .limit(1);
            if (!already.length) {
              await db
                .update(cuddlers)
                .set({ credits: sql`${cuddlers.credits} + ${VIP_BOOST_GRANT}` })
                .where(eq(cuddlers.id, cuddlerId));
              await db.insert(creditEvents).values({ cuddlerId, delta: VIP_BOOST_GRANT, reason });
            }
          }

          await checkGoLive(cuddlerId);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoiceSubscriptionId(invoice);
      if (subId) {
        const sub = await stripe().subscriptions.retrieve(subId);
        const cuddlerId = sub.metadata?.cuddlerId;
        if (cuddlerId) {
          // Guard: only act if this subscription is still the one on file. Stripe doesn't
          // guarantee webhook delivery order, so a delayed event for a subscription that's since
          // been superseded (cancel-then-resubscribe, or any flow that ends up creating a new
          // subscription object) must not stomp on a newer, currently-active one. See the matching
          // guard on customer.subscription.deleted below — same failure mode, same fix.
          const [current] = await db
            .select({ stripeSubscriptionId: cuddlers.stripeSubscriptionId })
            .from(cuddlers)
            .where(eq(cuddlers.id, cuddlerId))
            .limit(1);
          if (current?.stripeSubscriptionId === subId) {
            await db.update(cuddlers).set({ subStatus: "past_due" }).where(eq(cuddlers.id, cuddlerId));
          }
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const cuddlerId = sub.metadata?.cuddlerId;
      if (cuddlerId) {
        // Guard: only clear the subscription if this deleted subscription is still the one on
        // file. Without this check, a delayed "deleted" webhook for an old subscription that's
        // already been replaced by a newer one incorrectly wipes out the CURRENT subscription's
        // tracking — the dashboard then shows "no plan" and /api/checkout falls back to creating a
        // brand-new full-price Checkout Session instead of a prorated in-place update, even though
        // Stripe itself still has a live, paid subscription running. This is the bug behind
        // "upgrading showed the full price" and "cancelling the checkout took away my subscription".
        const [current] = await db
          .select({ stripeSubscriptionId: cuddlers.stripeSubscriptionId })
          .from(cuddlers)
          .where(eq(cuddlers.id, cuddlerId))
          .limit(1);
        if (current?.stripeSubscriptionId === sub.id) {
          await db
            .update(cuddlers)
            .set({ subStatus: "canceled", stripeSubscriptionId: null })
            .where(eq(cuddlers.id, cuddlerId));
        }
      }
      break;
    }

    // Automated Stripe Identity check (government ID + live selfie) passed.
    case "identity.verification_session.verified": {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const cuddlerId = session.metadata?.cuddlerId;
      if (cuddlerId) {
        await db
          .update(cuddlers)
          .set({ identityStatus: "verified", identityVerifiedAt: new Date() })
          .where(eq(cuddlers.id, cuddlerId));
        await checkGoLive(cuddlerId);
      }
      break;
    }

    // Stripe Identity couldn't verify the submission (bad photo, mismatch, etc.) — cuddler
    // needs to retake it. Covers both "requires_input" (failed) and "canceled" (they backed out).
    case "identity.verification_session.requires_input":
    case "identity.verification_session.canceled": {
      const session = event.data.object as Stripe.Identity.VerificationSession;
      const cuddlerId = session.metadata?.cuddlerId;
      if (cuddlerId) {
        await db
          .update(cuddlers)
          .set({ identityStatus: "failed" })
          .where(eq(cuddlers.id, cuddlerId));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
