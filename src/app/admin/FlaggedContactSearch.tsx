"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchFlaggedContacts, adminDeleteFlaggedContact } from "./actions";

type Result = Awaited<ReturnType<typeof searchFlaggedContacts>>[number];

/** Client-side search box for the flaggedContacts table (the "Report A Customer" system on the
 *  cuddler dashboard) — an admin types a client's phone number or email and sees every report
 *  filed against it site-wide, including who filed it, which a regular cuddler never sees. */
export default function FlaggedContactSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const runSearch = () => {
    if (!query.trim()) return;
    startTransition(async () => {
      const r = await searchFlaggedContacts(query);
      setResults(r);
    });
  };

  const deleteReport = (id: string) => {
    const fd = new FormData();
    fd.append("id", id);
    startTransition(async () => {
      await adminDeleteFlaggedContact(fd);
      setResults((prev) => prev?.filter((r) => r.id !== id) ?? null);
    });
  };

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          type="text"
          placeholder="Search a client's phone number or email"
          className="field flex-1 text-sm"
        />
        <button type="button" onClick={runSearch} disabled={isPending || !query.trim()} className="btn-primary">
          Search
        </button>
      </div>

      {results !== null &&
        (results.length === 0 ? (
          <p className="mt-3 text-sm text-stone2">No reports found for that number or email.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {results.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{r.contactValue}</span>
                  <span className="text-xs text-stone2">{r.createdAt.toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-stone2">
                  Reported by{" "}
                  <Link href={`/cuddlers/${r.reportedBySlug}`} className="font-medium text-spruce hover:underline">
                    {r.reportedByName}
                  </Link>
                </p>
                {r.reason && <p className="mt-1 text-sm text-ink/90">{r.reason}</p>}
                <button
                  type="button"
                  onClick={() => deleteReport(r.id)}
                  disabled={isPending}
                  className="mt-2 text-xs text-red-700 hover:underline"
                >
                  Delete This Report
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
