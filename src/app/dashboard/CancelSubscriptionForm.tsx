"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { cancelSubscription, undoCancelSubscription } from "@/app/actions";

const CANCEL_REASONS = [
  "It's too expensive",
  "Not getting enough clients from it",
  "Taking a break / leaving the business",
  "Switching to another platform",
  "Other",
];

export default function CancelSubscriptionForm({
  cancelRequestedAt,
  activeUntil,
}: {
  cancelRequestedAt: string | null;
  activeUntil: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [state, action] = useFormState(cancelSubscription, null as null | { error?: string; ok?: string });

  // Already scheduled to cancel — show status + a way to undo instead of the cancel form.
  if (cancelRequestedAt) {
    return (
      <section className="card border border-line p-6">
        <h2 className="font-display text-lg font-semibold">Subscription Ending</h2>
        <p className="mt-1 text-xs text-stone2">
          Your subscription is set to cancel{activeUntil ? ` on ${new Date(activeUntil).toLocaleDateString()}` : ""}.
          You&rsquo;ll keep full access until then, and you won&rsquo;t be charged again.
        </p>
        <form action={undoCancelSubscription} className="mt-4">
          <button className="btn-ghost text-sm leading-tight">
            Changed My Mind
            <br />
            Keep My Subscription
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <h2 className="font-display text-lg font-semibold">Cancel Subscription</h2>
      <p className="mt-1 text-xs text-stone2">
        Stops future billing. Your listing stays live through the rest of your current billing
        period. No refund for time already paid, same as our cancellation policy.
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost mt-4">
          Cancel Subscription
        </button>
      ) : (
        <form action={action} className="mt-4 grid gap-3 rounded-lg border border-line bg-porcelain p-4">
          <div>
            <label className="label" htmlFor="cancelReason">Why are you cancelling? This helps us improve.</label>
            <select
              id="cancelReason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="field"
            >
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {reason === "Other" && (
            <textarea
              name="reasonDetail"
              placeholder="Tell us more (optional)"
              rows={3}
              className="field"
              maxLength={500}
            />
          )}
          {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
          {state?.ok && <p className="text-sm text-spruce">{state.ok}</p>}
          <div className="flex gap-2">
            <button className="btn-primary bg-red-700 hover:bg-red-800">Confirm Cancellation</button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Never Mind</button>
          </div>
        </form>
      )}
    </section>
  );
}
