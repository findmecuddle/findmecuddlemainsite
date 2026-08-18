"use client";

import { useState } from "react";
import { REVIEW_BODY_MAX_CHARS } from "@/lib/config";
import Turnstile from "@/components/Turnstile";

export default function ReviewForm({
  cuddlerId,
  mobileOffered,
}: {
  cuddlerId: string;
  /** Only ask in-studio vs. mobile when the cuddler actually offers mobile sessions. */
  mobileOffered?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [sessionType, setSessionType] = useState<"studio" | "mobile">("studio");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(null);
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorPhone, setAuthorPhone] = useState("");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost mt-3">
        Write a review
      </button>
    );
  }

  if (result?.ok) {
    return (
      <p className="mt-3 text-sm text-spruce">
        Thanks! Your review is submitted and will show up once it's approved.
      </p>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!authorEmail.trim() && !authorPhone.trim()) {
      setResult({ error: "Enter your email or phone number so we can verify you booked a session." });
      return;
    }
    setBusy(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    formData.set("cuddlerId", cuddlerId);
    try {
      const res = await fetch("/api/reviews", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error || "Couldn't submit that review." });
      else setResult({ ok: true });
    } catch {
      setResult({ error: "Couldn't submit that review. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 border-t border-line pt-4">
      <div>
        <label className="label" htmlFor="authorName">Your name</label>
        <input id="authorName" name="authorName" required className="field" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="authorEmail">Email (not shown publicly)</label>
          <input
            id="authorEmail"
            name="authorEmail"
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="authorPhone">Phone (not shown publicly)</label>
          <input
            id="authorPhone"
            name="authorPhone"
            type="tel"
            value={authorPhone}
            onChange={(e) => setAuthorPhone(e.target.value)}
            className="field"
          />
        </div>
      </div>
      <p className="-mt-1 text-xs text-stone2">
        Enter at least one — we use it to confirm you actually booked with this cuddler. Never shown publicly.
      </p>
      {mobileOffered && (
        <div>
          <label className="label">Was this session in-studio or mobile?</label>
          <div className="flex gap-4 text-sm">
            {(["studio", "mobile"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sessionType"
                  value={opt}
                  checked={sessionType === opt}
                  onChange={() => setSessionType(opt)}
                  className="h-4 w-4 accent-spruce"
                />
                {opt === "studio" ? "In-studio" : "Mobile"}
              </label>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="label">Rating</label>
        <div className="flex gap-1 text-2xl">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={n <= rating ? "text-gold" : "text-line"}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
            >
              ★
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </div>
      <div>
        <label className="label" htmlFor="body">Review</label>
        <textarea
          id="body"
          name="body"
          rows={4}
          required
          maxLength={REVIEW_BODY_MAX_CHARS}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="field"
        />
        <p className="mt-1 text-right text-xs text-stone2">{body.length}/{REVIEW_BODY_MAX_CHARS}</p>
      </div>
      <Turnstile />
      {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit review"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
