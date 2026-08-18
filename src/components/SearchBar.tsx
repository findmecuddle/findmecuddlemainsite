"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { GENDER_OPTIONS } from "@/lib/config";

export default function SearchBar({
  autoFocus = false,
  // Homepage stays minimal — just where. Radius and Gender are "browse" filters, refinements you
  // reach for once you're already looking at results, so they only show up on the actual /search
  // page (see search/page.tsx's plain <SearchBar /> call vs. the homepage's <SearchBar compact />).
  compact = false,
}: {
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [radius, setRadius] = useState(params.get("radius") ?? "25");
  const [gender, setGender] = useState(params.get("gender") ?? "");
  const [availableNow, setAvailableNow] = useState(params.get("availableNow") === "1");

  function go() {
    if (!q.trim()) return;
    const qs = new URLSearchParams({ q: q.trim(), radius });
    if (gender) qs.set("gender", gender);
    if (availableNow) qs.set("availableNow", "1");
    router.push(`/search?${qs.toString()}`);
  }

  function applyGender(next: string) {
    setGender(next);
    // Same "apply immediately if results are already showing" pattern used elsewhere in the app.
    if (q.trim()) {
      const qs = new URLSearchParams({ q: q.trim(), radius });
      if (next) qs.set("gender", next);
      if (availableNow) qs.set("availableNow", "1");
      router.push(`/search?${qs.toString()}`);
    }
  }

  function applyAvailableNow(next: boolean) {
    setAvailableNow(next);
    if (q.trim()) {
      const qs = new URLSearchParams({ q: q.trim(), radius });
      if (gender) qs.set("gender", gender);
      if (next) qs.set("availableNow", "1");
      router.push(`/search?${qs.toString()}`);
    }
  }

  const chevron = (
    <svg
      className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone2"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div>
      {/* Primary row: where + go. Kept to just these two so it never competes for space with the
          filters below — on narrow screens the input and Search button always stay full-width and
          legible instead of getting squeezed by however many filters happen to be selected. */}
      <div className="card flex flex-col gap-2 p-2 sm:flex-row">
        <input
          className="field h-11 border-0 shadow-none focus:ring-0 sm:flex-1"
          placeholder="Zip Code, City, Or Address"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          aria-label="Search location"
        />
        <button onClick={() => go()} className="btn-primary h-11 sm:px-8">Search</button>
      </div>

      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              className="field h-9 w-auto appearance-none py-0 pl-3 pr-8 text-sm"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              aria-label="Search radius"
            >
              {[10, 25, 50, 100].map((r) => (
                <option key={r} value={r}>{r} mi</option>
              ))}
            </select>
            {chevron}
          </div>

          <div className="relative">
            <select
              className="field h-9 w-auto appearance-none py-0 pl-3 pr-8 text-sm"
              value={gender}
              onChange={(e) => applyGender(e.target.value)}
              aria-label="Cuddler gender"
            >
              <option value="">Any Gender</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            {chevron}
          </div>

          <label
            className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm ${
              availableNow ? "border-spruce bg-spruce-tint text-spruce" : "border-line bg-white text-stone2"
            }`}
          >
            <input
              type="checkbox"
              checked={availableNow}
              onChange={(e) => applyAvailableNow(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Available Now
          </label>
        </div>
      )}
    </div>
  );
}
