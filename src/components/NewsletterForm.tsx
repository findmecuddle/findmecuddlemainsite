"use client";

import { useState } from "react";
import Turnstile from "@/components/Turnstile";

export default function NewsletterForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(null);

  if (result?.ok) {
    return (
      <p className="text-sm font-medium text-spruce">
        You're subscribed! We'll email you when new cuddlers join near you.
      </p>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/newsletter/subscribe", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error || "Couldn't subscribe. Try again." });
      else setResult({ ok: true });
    } catch {
      setResult({ error: "Couldn't subscribe. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <input name="name" required placeholder="Your Name" className="field" />
      <input name="email" type="email" required placeholder="Email Address" className="field" />
      <input name="location" required placeholder="Zip Code Or City, State" className="field sm:col-span-2" />
      <label className="flex items-start gap-2 text-sm text-stone2 sm:col-span-2">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-spruce" />
        <span>
          I agree to receive emails about new cuddle professionals in my area. I can unsubscribe anytime.
        </span>
      </label>
      <div className="sm:col-span-2">
        <Turnstile />
      </div>
      {result?.error && <p className="text-sm text-red-700 sm:col-span-2">{result.error}</p>}
      <button className="btn-primary w-fit sm:col-span-2" disabled={busy}>
        {busy ? "Subscribing…" : "Notify Me"}
      </button>
    </form>
  );
}
