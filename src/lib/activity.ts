import { eq } from "drizzle-orm";
import { db } from "./db";
import { systemEvents, cuddlers } from "./schema";
import { isLive } from "./stripe";

/** Call right after a new cuddler row is created (see completeOnboarding in actions.ts). */
export async function logSignup(cuddlerId: string, cuddlerName: string) {
  await db.insert(systemEvents).values({ type: "signup", cuddlerId, cuddlerName });
}

/** Call from cancelSubscription() so the reason a cuddler gave shows up in /admin/activity. */
export async function logCancelRequested(cuddlerId: string, cuddlerName: string, reason: string) {
  await db.insert(systemEvents).values({ type: "cancel_requested", cuddlerId, cuddlerName, detail: reason });
}

/**
 * Call after any mutation that could flip a listing from not-live to live: the Stripe
 * subscription webhook (invoice.paid), the identity-verification webhook, an admin approving a
 * license, publishing a listing, resuming from vacation pause, or un-suspending. Cheap to call
 * from all of them — it re-reads the row, checks isLive(), and only logs (once, ever, via the
 * wentLiveAt flag) the first time the listing actually goes live. Safe to call speculatively even
 * when the mutation didn't end up making the listing live.
 */
export async function checkGoLive(cuddlerId: string) {
  const [t] = await db.select().from(cuddlers).where(eq(cuddlers.id, cuddlerId)).limit(1);
  if (!t || t.wentLiveAt || !isLive(t)) return;

  await db.update(cuddlers).set({ wentLiveAt: new Date() }).where(eq(cuddlers.id, cuddlerId));
  await db.insert(systemEvents).values({ type: "go_live", cuddlerId, cuddlerName: t.name });
}
