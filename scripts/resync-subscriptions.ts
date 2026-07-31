import "dotenv/config"; // tsx doesn't auto-load .env the way `next dev`/`next build` do.
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { cuddlers } from "../src/lib/schema";
import { stripe } from "../src/lib/stripe";

// Run with: npx tsx scripts/resync-subscriptions.ts            (dry run — reports only, changes nothing)
//           npx tsx scripts/resync-subscriptions.ts --apply    (actually writes the fixes)
//
// Why this exists: the customer.subscription.deleted and invoice.payment_failed webhook handlers
// used to update subStatus/stripeSubscriptionId for a cuddler without checking whether the
// event's subscription ID was still the one actually on file. Stripe doesn't guarantee webhook
// delivery order, so a delayed "deleted" event for an old, already-superseded subscription (e.g.
// from an earlier cancel-then-resubscribe, or any flow that created a second subscription instead
// of updating one in place) could silently overwrite a currently-active subscription's tracking —
// making the dashboard show "no plan" and /api/checkout fall back to a full-price Checkout Session
// instead of a prorated update, even though Stripe itself still had a live, paid subscription
// running. That race is now guarded against going forward (see route.ts), but this script repairs
// any cuddler whose DB row already drifted from Stripe's actual state before that fix shipped.
//
// For every cuddler with a Stripe customer, this asks Stripe directly "what's your real
// subscription situation" and compares it against our DB. It only ever REPORTS a mismatch unless
// you pass --apply, in which case it corrects stripeSubscriptionId/subStatus/plan/activeUntil to
// match whatever Stripe says is actually true. It never cancels, creates, or modifies anything on
// the Stripe side — this only ever pulls from Stripe and writes to our own database.

const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = await db
    .select({
      id: cuddlers.id,
      name: cuddlers.name,
      email: cuddlers.email,
      stripeCustomerId: cuddlers.stripeCustomerId,
      stripeSubscriptionId: cuddlers.stripeSubscriptionId,
      subStatus: cuddlers.subStatus,
      plan: cuddlers.plan,
    })
    .from(cuddlers);

  const withBilling = rows.filter((r) => r.stripeCustomerId);
  console.log(`Checking ${withBilling.length} cuddler(s) with a Stripe customer on file...\n`);

  let mismatches = 0;

  for (const r of withBilling) {
    const subs = await stripe().subscriptions.list({
      customer: r.stripeCustomerId!,
      status: "all",
      limit: 10,
    });

    // Stripe's source of truth for "what's actually live right now" — prefer an active/trialing
    // subscription; fall back to past_due (still technically live, just payment-troubled); a
    // customer can only have one non-canceled subscription in this app's flow (the in-place-update
    // path in /api/checkout guarantees that), so picking the first match here is safe.
    const live = subs.data.find((s) => s.status === "active" || s.status === "trialing");
    const pastDue = subs.data.find((s) => s.status === "past_due");
    const truth = live ?? pastDue ?? null;

    const trueSubId = truth?.id ?? null;
    const trueStatus = truth ? (truth.status === "past_due" ? "past_due" : "active") : "canceled";
    const truePlan = truth?.metadata?.plan ?? r.plan;

    const driftedId = r.stripeSubscriptionId !== trueSubId;
    const driftedStatus = r.subStatus !== trueStatus && !(r.subStatus === "none" && trueStatus === "canceled");

    if (driftedId || driftedStatus) {
      mismatches++;
      console.log(`MISMATCH — ${r.name} <${r.email}>`);
      console.log(`  DB:     subStatus=${r.subStatus}  stripeSubscriptionId=${r.stripeSubscriptionId ?? "null"}`);
      console.log(`  Stripe: subStatus=${trueStatus}  stripeSubscriptionId=${trueSubId ?? "null"}  plan=${truePlan ?? "null"}`);

      if (APPLY) {
        await db
          .update(cuddlers)
          .set({
            stripeSubscriptionId: trueSubId,
            subStatus: trueStatus,
            plan: truePlan,
            activeUntil: truth ? new Date(truth.current_period_end * 1000) : null,
          })
          .where(eq(cuddlers.id, r.id));
        console.log(`  -> Fixed.\n`);
      } else {
        console.log(`  -> Would fix (run with --apply to actually update).\n`);
      }
    }
  }

  if (mismatches === 0) {
    console.log("No mismatches found — every cuddler's DB record matches Stripe.");
  } else {
    console.log(`\n${mismatches} mismatch(es) found${APPLY ? ", fixed above." : ". Re-run with --apply to fix them."}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
