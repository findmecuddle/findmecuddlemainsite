"use client";

import { useState } from "react";
import { REPORT_BODY_MAX_CHARS, REPORT_MAX_PHOTOS } from "@/lib/config";
import Turnstile from "@/components/Turnstile";

export default function ReportForm({ cuddlerId }: { cuddlerId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-stone2 underline hover:text-ink">
        Report This Listing
      </button>
    );
  }

  if (result?.ok) {
    return <p className="mt-3 text-sm text-spruce">Thanks — we'll review this report.</p>;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    formData.set("cuddlerId", cuddlerId);
    const files = formData.getAll("photos").filter((f) => f instanceof File && f.size > 0);
    if (files.length > REPORT_MAX_PHOTOS) {
      setResult({ error: `Attach up to ${REPORT_MAX_PHOTOS} photos.` });
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/reports", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error || "Couldn't submit that report." });
      else setResult({ ok: true });
    } catch {
      setResult({ error: "Couldn't submit that report. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border border-line bg-porcelain p-4">
      <p className="text-xs text-stone2">
        Report inaccurate, inappropriate, or fraudulent content on this listing. Include what you can — reports are
        reviewed manually.
      </p>
      <div>
        <label className="label" htmlFor="reportBody">What's wrong</label>
        <textarea
          id="reportBody"
          name="body"
          rows={4}
          required
          maxLength={REPORT_BODY_MAX_CHARS}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="field"
        />
        <p className="mt-1 text-right text-xs text-stone2">{body.length}/{REPORT_BODY_MAX_CHARS}</p>
      </div>
      <div>
        <label className="label" htmlFor="reporterEmail">Your email (optional, not shown publicly)</label>
        <input id="reporterEmail" name="reporterEmail" type="email" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="photos">Evidence photos (up to {REPORT_MAX_PHOTOS})</label>
        <input id="photos" name="photos" type="file" accept="image/*" multiple className="field" />
      </div>
      <Turnstile />
      {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Submitting…" : "Submit report"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
