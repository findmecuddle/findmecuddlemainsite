"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Stripe redirects back to /dashboard?checkout=success the instant checkout completes — but our
 * webhook (which is what actually marks the subscription active in our database) can take a
 * moment to arrive and process. Without this, the dashboard's first render can land before that
 * webhook has run, showing stale "not live yet" status until the user manually refreshes.
 *
 * This re-fetches the server-rendered dashboard a couple of times a beat after landing here, then
 * strips the query param so a later manual refresh doesn't keep re-triggering it. It also surfaces
 * a small banner for the "canceled"/"plan_failed" cases (see /api/checkout's plan-switch branch),
 * which previously landed back on the dashboard with no feedback at all.
 */
export default function CheckoutRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");

  useEffect(() => {
    if (!checkout) return;

    if (checkout === "success") {
      const timers = [1500, 3500].map((ms) => setTimeout(() => router.refresh(), ms));
      router.replace(pathname);
      return () => timers.forEach(clearTimeout);
    }

    // canceled / plan_failed: nothing to re-fetch, just clean the URL after a moment so the
    // banner below has a chance to render before the query param disappears.
    const timer = setTimeout(() => router.replace(pathname), 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  if (checkout === "plan_failed") {
    return (
      <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
        We couldn't switch your plan: the charge for the prorated difference didn't go through. Check your
        payment method under Manage Subscription and try again.
      </p>
    );
  }
  if (checkout === "canceled") {
    return (
      <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Checkout was canceled. No changes were made.</p>
    );
  }

  return null;
}
