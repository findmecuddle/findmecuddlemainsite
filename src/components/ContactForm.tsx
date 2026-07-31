"use client";

import { useState } from "react";
import { CONTACT_SUBJECT_OPTIONS, CONTACT_BODY_MAX_CHARS } from "@/lib/config";
import Turnstile from "@/components/Turnstile";

export default function ContactForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(null);

  if (result?.ok) {
    return (
      <div className="card p-6">
        <h2 className="font-display text-lg font-semibold">Message sent</h2>
        <p className="mt-2 text-sm text-stone2">Thanks for reaching out, we'll get back to you soon.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/support", { method: "POST", body: formData });
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
    <form onSubmit={submit} className="card grid gap-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="field" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <select id="subject" name="subject" className="field" defaultValue={CONTACT_SUBJECT_OPTIONS[0]}>
          {CONTACT_SUBJECT_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          maxLength={CONTACT_BODY_MAX_CHARS}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="field"
          placeholder="How can we help?"
        />
        <p className="mt-1 text-right text-xs text-stone2">{message.length}/{CONTACT_BODY_MAX_CHARS}</p>
      </div>
      <Turnstile />
      {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
      <button className="btn-primary w-fit" disabled={busy}>{busy ? "Sending…" : "Send Message"}</button>
    </form>
  );
}
