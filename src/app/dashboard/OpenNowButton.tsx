"use client";

import { useEffect, useState } from "react";
import { activateOpenNow } from "@/app/actions";
import { MANUAL_OPEN_NOW_HOURS } from "@/lib/config";
import CountdownClock from "./CountdownClock";

export default function OpenNowButton({
  openNowActivatedAt,
  live,
}: {
  /** ISO timestamp of the most recent activation, if any — stays active for MANUAL_OPEN_NOW_HOURS from here. */
  openNowActivatedAt: string | null;
  live: boolean;
}) {
  // Ticks every second so the button re-enables itself live once the window lapses, without
  // needing a page refresh — same pattern as BoostButton.tsx.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const expiresAt = openNowActivatedAt
    ? new Date(openNowActivatedAt).getTime() + MANUAL_OPEN_NOW_HOURS * 3600_000
    : null;
  // Must also be live — an activation from before the listing went down (e.g. a past_due
  // subscription, see dashboard/page.tsx) can still be sitting inside its window, but it isn't
  // actually showing anywhere while the listing itself is hidden. Without the `live` check here,
  // the button confusingly claimed "Available Now Active" while "Go live first" was shown right
  // underneath it.
  const withinWindow = !!expiresAt && expiresAt > now;
  const active = live && withinWindow;

  return (
    <div className="mt-3">
      <form action={activateOpenNow}>
        <button className="btn-primary w-full disabled:opacity-50" disabled={!live || active}>
          {active ? "Available Now Active" : "Available Now"}
        </button>
      </form>
      {!live && <p className="mt-2 text-xs text-stone2">Go live first. This only works on active listings.</p>}
      {live && active && expiresAt && (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          Showing as Available Now: <CountdownClock until={new Date(expiresAt).toISOString()} />
        </p>
      )}
    </div>
  );
}
