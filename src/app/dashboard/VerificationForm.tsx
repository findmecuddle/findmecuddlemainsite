"use client";

import { useRef, useState } from "react";
import type { ClientSafeCuddler } from "@/lib/auth";

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  none: { label: "Not submitted", className: "text-stone2" },
  pending: { label: "Pending review", className: "text-gold" },
  approved: { label: "Verified", className: "text-spruce" },
  rejected: { label: "Resubmission needed", className: "text-red-700" },
};

export default function VerificationForm({
  cuddler,
}: {
  // hasLicenseOnFile is a plain boolean, never the raw storage key — the client only ever needs
  // to know whether a license exists, not the private key that would let someone construct a
  // request for it. See toClientSafeCuddler() in lib/auth.ts and where this prop is built in
  // dashboard/page.tsx.
  cuddler: Pick<ClientSafeCuddler, "verificationStatus" | "verificationNote" | "licenseNotRequired" | "state"> & {
    hasLicenseOnFile: boolean;
  };
}) {
  const [status, setStatus] = useState(cuddler.verificationStatus);
  const [have, setHave] = useState(cuddler.hasLicenseOnFile);
  const [notRequired, setNotRequired] = useState(cuddler.licenseNotRequired);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.set("doc", "license");
    form.set("file", file);

    try {
      const res = await fetch("/api/verification", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed.");
      } else {
        setHave(true);
        setNotRequired(false);
        setStatus(data.status);
      }
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function submitNotRequired() {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("licenseNotRequired", "true");
    try {
      const res = await fetch("/api/verification", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't submit that.");
      } else {
        setNotRequired(true);
        setHave(false);
        setConfirming(false);
        setStatus(data.status);
      }
    } catch {
      setError("Couldn't submit that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const badge = STATUS_COPY[status] ?? STATUS_COPY.none;

  if (status === "approved") {
    return (
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Cuddle Certification</h2>
          <span className={`text-sm font-medium ${badge.className}`}>✓ {badge.label}</span>
        </div>
        <p className="mt-1 text-xs text-stone2">
          {notRequired
            ? `Confirmed — ${cuddler.state} doesn't require certification for cuddle therapy, and our team has reviewed that.`
            : "Your certification has been reviewed and verified."}
        </p>
      </section>
    );
  }

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Cuddle Certification</h2>
        <span className={`text-sm font-medium ${badge.className}`}>{badge.label}</span>
      </div>
      <p className="mt-1 text-xs text-stone2">
        Required before your listing can go live. Upload a photo of your certification, or confirm below if
        your state doesn't require one. An admin reviews it either way, this usually takes a day or two.
      </p>

      {status === "rejected" && cuddler.verificationNote && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">
          <span className="font-medium">Not approved:</span> {cuddler.verificationNote}. Upload a new photo,
          or use the option below, to resubmit.
        </p>
      )}

      <div className="mt-4 flex flex-col items-center gap-1.5">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="btn-ghost w-full text-sm disabled:opacity-50 sm:w-auto"
        >
          {busy ? "Uploading…" : "Upload Photo"}
        </button>
        {have && !busy && <p className="text-[11px] text-stone2">On file, kept private, admin-only.</p>}
        {error && <p className="text-[11px] text-red-700">{error}</p>}
      </div>

      <div className="mt-3 border-t border-line pt-3 text-center">
        {notRequired && !busy ? (
          <p className="text-[11px] text-stone2">
            You confirmed {cuddler.state} doesn't require certification — an admin will check this.
          </p>
        ) : confirming ? (
          <div className="grid gap-2">
            <p className="text-xs text-stone2">
              Confirm that {cuddler.state} doesn't require certification for cuddle therapy for the services you offer.
              An admin will independently verify this before approving.
            </p>
            <div className="flex justify-center gap-2">
              <button type="button" disabled={busy} onClick={submitNotRequired} className="btn-primary text-sm disabled:opacity-50">
                {busy ? "Submitting…" : "Confirm — No Certification Required"}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="btn-ghost text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="text-xs text-stone2 underline hover:text-ink">
            My state doesn't require certification for this
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-stone2">
        This photo is never shown publicly or used anywhere on your ad, it's stored separately and only an
        admin can view it for review.
      </p>
    </section>
  );
}
