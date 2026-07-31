"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CUDDLE_TYPES, GENDER_OPTIONS } from "@/lib/config";

export default function SearchBar({
  autoFocus = false,
  // Homepage stays minimal — just where, Cuddle Type, and Open Now. Radius and Gender are
  // "browse" filters, refinements you reach for once you're already looking at results, so they
  // only show up on the actual /search page (see search/page.tsx's plain <SearchBar /> call vs.
  // the homepage's <SearchBar compact />).
  compact = false,
}: {
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [radius, setRadius] = useState(params.get("radius") ?? "25");
  const [types, setTypes] = useState<string[]>(
    (params.get("types") ?? "").split(",").map((t) => t.trim()).filter(Boolean)
  );
  const [showTypes, setShowTypes] = useState(false);
  const [openNow, setOpenNow] = useState(params.get("openNow") === "1");
  const [gender, setGender] = useState(params.get("gender") ?? "");
  const [kind, setKind] = useState(params.get("kind") ?? "all");

  function toggleType(type: string) {
    setTypes((t) => (t.includes(type) ? t.filter((x) => x !== type) : [...t, type]));
  }

  function go(openNowOverride = openNow) {
    if (!q.trim()) return;
    const qs = new URLSearchParams({ q: q.trim(), radius });
    if (types.length) qs.set("types", types.join(","));
    if (openNowOverride) qs.set("openNow", "1");
    if (gender) qs.set("gender", gender);
    if (kind !== "all") qs.set("kind", kind);
    router.push(`/search?${qs.toString()}`);
  }

  function applyGender(next: string) {
    setGender(next);
    // Same "apply immediately if results are already showing" pattern as Open Now below.
    if (q.trim()) {
      const qs = new URLSearchParams({ q: q.trim(), radius });
      if (types.length) qs.set("types", types.join(","));
      if (openNow) qs.set("openNow", "1");
      if (next) qs.set("gender", next);
      if (kind !== "all") qs.set("kind", kind);
      router.push(`/search?${qs.toString()}`);
    }
  }

  function applyKind(next: string) {
    setKind(next);
    // Unlike gender/openNow, this applies even with no location entered yet — it also filters the
    // no-location "browse" view (see browseTopCuddlers in search/page.tsx), so there's no reason
    // to gate this behind q being filled in.
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    qs.set("radius", radius);
    if (types.length) qs.set("types", types.join(","));
    if (openNow) qs.set("openNow", "1");
    if (gender) qs.set("gender", gender);
    if (next !== "all") qs.set("kind", next);
    router.push(`/search?${qs.toString()}`);
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

      {/* Filters row: wraps freely instead of being squeezed into fixed-width columns, and each
          control is only as wide as its own content needs — nothing gets cut off, no matter how
          many filters are active at once. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Unlike radius/gender below, this shows on the homepage too (not gated by `compact`) —
            the user explicitly wants to filter by listing type from the main page, not just once
            results are already showing. */}
        <div className="relative">
          <select
            className={`field h-9 w-auto appearance-none py-0 pl-3 pr-8 text-sm ${kind !== "all" ? "border-spruce text-spruce" : ""}`}
            value={kind}
            onChange={(e) => applyKind(e.target.value)}
            aria-label="Listing type"
          >
            <option value="all">Cuddlers &amp; Agencies</option>
            <option value="solo">Cuddle Professionals Only</option>
            <option value="agency">Agencies Only</option>
          </select>
          {chevron}
        </div>

        {!compact && (
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
        )}

        {!compact && (
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
        )}

        <button
          type="button"
          onClick={() => setShowTypes((s) => !s)}
          className={`btn-ghost h-9 whitespace-nowrap px-3 text-sm ${types.length > 0 ? "border-spruce text-spruce" : ""}`}
        >
          Cuddle Type{types.length > 0 ? ` (${types.length})` : ""}
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !openNow;
            setOpenNow(next);
            // If results are already showing, apply immediately instead of waiting for another
            // click on Search — this is a filter people expect to react right away.
            if (q.trim()) go(next);
          }}
          className={`btn-ghost h-9 whitespace-nowrap px-3 text-sm ${openNow ? "border-spruce text-spruce" : ""}`}
        >
          {openNow ? "✓ " : ""}Open Now
        </button>
      </div>

      {showTypes && (
        <div className="card mt-2 grid grid-cols-2 gap-x-4 gap-y-2 p-4 sm:grid-cols-3 md:grid-cols-4">
          {CUDDLE_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={types.includes(type)}
                onChange={() => toggleType(type)}
                className="h-4 w-4 accent-spruce"
              />
              {type}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
