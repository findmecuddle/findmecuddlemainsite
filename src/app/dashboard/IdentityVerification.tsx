"use client";

import { useState } from "react";
import Script from "next/script";
import type { ClientSafeCuddler } from "@/lib/auth";

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => {
      verifyIdentity: (clientSecret: string) => Promise<{ error?: { message?: string } }>;
    };
  }
}

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  none: { label: "Not started", className: "text-stone2" },
  pending: { label: "Pending review", className: "text-gold" },
  verified: { label: "Verified", className: "text-spruce" },
  failed: { label: "Couldn't verify, try again", className: "text-red-700" },
};

export default function IdentityVerification({
  cuddler,
}: {
  cuddler: Pick<ClientSafeCuddler, "identityStatus">;
}) {
  const [status, setStatus] = useState(cuddler.identityStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const badge = STATUS_COPY[status] ?? STATUS_COPY.none;

  async function startVerification() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/identity/create-session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't start identity verification.");
        return;
      }
      if (!publishableKey || !window.Stripe) {
        setError("Identity verification isn't configured yet.");
        return;
      }
      const stripeClient = window.Stripe(publishableKey);
      const result = await stripeClient.verifyIdentity(data.clientSecret);
      if (result.error) {
        setError(result.error.message || "Verification was cancelled or failed.");
      } else {
        setStatus("pending");
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "verified") {
    return (
      <section className="card p-6">
        <Script src="https://js.stripe.com/v3/" strategy="afterInteractive" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Identity Verification</h2>
          <span className={`text-sm font-medium ${badge.className}`}>✓ {badge.label}</span>
        </div>
        <p className="mt-1 text-xs text-stone2">Your government ID and a live selfie have been verified.</p>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <Script src="https://js.stripe.com/v3/" strategy="afterInteractive" />
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Identity Verification</h2>
        <span className={`text-sm font-medium ${badge.className}`}>{badge.label}</span>
      </div>
      <p className="mt-1 text-xs text-stone2">
        Required before your listing can go live. A quick automatic check, scan your government-issued ID and
        take a selfie, usually takes about a minute.
      </p>

      {status === "pending" && (
        <p className="mt-3 rounded-lg bg-porcelain p-3 text-xs text-stone2">
          Submitted. Stripe is reviewing it now, this usually finishes within a few minutes. Refresh this page to
          check your status.
        </p>
      )}

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={startVerification}
          className="btn-ghost w-full text-sm disabled:opacity-50 sm:w-auto"
        >
          {busy ? "Starting…" : status === "pending" ? "Retake Verification" : "Verify My Identity"}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-red-700">{error}</p>}
    </section>
  );
}
