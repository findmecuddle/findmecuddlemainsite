"use client";

import { useState } from "react";
import Link from "next/link";
import { DURATION_OPTIONS, INQUIRY_MESSAGE_MAX_CHARS, LOCATION_TYPE_OPTIONS, SITE_NAME } from "@/lib/config";
import Turnstile from "@/components/Turnstile";

/**
 * "Send My Info" — a lighter alternative to real-time chat (see the sendInquiryEmail comment in
 * lib/email.ts for the reasoning). No account needed: a client leaves their name, a phone and/or
 * email, and optionally what they're looking for — it's emailed straight to the cuddler and also
 * saved to their dashboard message list, and any follow-up happens off-platform — a normal reply,
 * call, or text, same as every other contact method on the site.
 */
export default function SendInfoForm({ cuddlerId, cuddlerFirstName }: { cuddlerId: string; cuddlerFirstName: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [flexible, setFlexible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full">
        Send My Info
      </button>
    );
  }

  if (result?.ok) {
    return (
      <p className="mt-3 rounded-lg bg-porcelain p-3 text-sm text-spruce">
        Sent! {cuddlerFirstName} has your info and will reach out directly.
      </p>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    formData.set("cuddlerId", cuddlerId);
    try {
      const res = await fetch("/api/inquiries", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error || "Couldn't send that. Try again." });
      else setResult({ ok: true });
    } catch {
      setResult({ error: "Couldn't send that. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border border-line bg-porcelain p-4">
      <p className="text-xs text-stone2">
        Leave your info and {cuddlerFirstName} will reach out to you directly. This goes straight to their
        dashboard so they'll see it even if they're offline right now.
      </p>
      <div>
        <label className="label" htmlFor="inquiryName">Your Name</label>
        <input id="inquiryName" name="name" required className="field" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="inquiryPhone">Phone</label>
          <input id="inquiryPhone" name="phone" type="tel" className="field" placeholder="(555) 201-8834" />
        </div>
        <div>
          <label className="label" htmlFor="inquiryEmail">Email</label>
          <input id="inquiryEmail" name="email" type="email" className="field" placeholder="you@example.com" />
        </div>
      </div>
      <p className="-mt-1 text-xs text-stone2">Enter at least one: phone or email.</p>

      <div className="grid gap-3 border-t border-line pt-3">
        <p className="label !mb-0">
          Appointment Details <span className="normal-case">(All Optional)</span>
        </p>
        <div>
          <label className="text-xs font-medium text-ink" htmlFor="inquiryDuration">Duration</label>
          <select id="inquiryDuration" name="duration" className="field mt-1">
            <option value="">Not Sure Yet</option>
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-4">
          {LOCATION_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink">
              <input type="radio" name="locationType" value={opt.value} className="h-4 w-4 accent-spruce" />
              {opt.label}
            </label>
          ))}
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="flexible"
              checked={flexible}
              onChange={(e) => setFlexible(e.target.checked)}
              className="h-4 w-4 accent-spruce"
            />
            Whenever You're Open
          </label>
          {!flexible && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <input type="date" name="preferredDate" className="field" aria-label="Preferred date" />
              <input type="time" name="preferredTime" className="field" aria-label="Preferred time" />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <label className="label" htmlFor="inquiryMessage">Message (Optional)</label>
        <textarea
          id="inquiryMessage"
          name="message"
          rows={3}
          maxLength={INQUIRY_MESSAGE_MAX_CHARS}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="field"
          placeholder="Anything else they should know."
        />
        <p className="mt-1 text-right text-xs text-stone2">{message.length}/{INQUIRY_MESSAGE_MAX_CHARS}</p>
      </div>

      <label className="flex items-start gap-2 border-t border-line pt-3 text-xs text-stone2">
        <input
          type="checkbox"
          name="agreeToTerms"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-spruce"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-spruce hover:underline">
            Terms of Service
          </Link>{" "}
          and won't use this to contact {cuddlerFirstName} for anything illegal or prohibited under them.
          {SITE_NAME} cooperates with law enforcement and will comply with valid subpoenas, court orders, and
          other lawful requests for information, including the details of this message.
        </span>
      </label>

      <Turnstile />
      {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send My Info"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
