// Shared time-overlap math for the appointment calendar — used both server-side (actions.ts, to
// actually block a double-booking) and client-side (MessagesCard.tsx, CalendarView.tsx, to show
// a live warning as a cuddler edits a date/time field). Keeping this in one plain, framework-free
// file means both sides always agree on what counts as "the same slot."

/** Rough length in minutes for a DURATION_OPTIONS value (see lib/config.ts: "30 min", "1
 *  hour"..."23 hours", "Overnight") — an unknown/empty duration falls back to a conservative 1
 *  hour rather than 0, since a 0-length block could never conflict with anything and would
 *  silently let a real double-booking through. */
export function durationToMinutes(d: string | null): number {
  if (!d) return 60;
  if (d === "Overnight") return 720;
  const min = /^(\d+)\s*min$/.exec(d);
  if (min) return parseInt(min[1], 10);
  const hrs = /^(\d+)\s*hours?$/.exec(d);
  if (hrs) return parseInt(hrs[1], 10) * 60;
  return 60;
}

export function timeToMinutes(hm: string | null): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function formatTime12(hm: string | null): string | null {
  const total = timeToMinutes(hm);
  if (total == null) return null;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** True if [aStart, aStart+aDuration) genuinely overlaps [bStart, bStart+bDuration) — both sides
 *  need a real start time to compare; a null/unparseable time on either side means "can't be sure
 *  either way," which callers should treat as NOT a hard conflict (only a soft heads-up, if any). */
export function timesOverlap(
  aTime: string | null,
  aDuration: string | null,
  bTime: string | null,
  bDuration: string | null
): boolean {
  const aStart = timeToMinutes(aTime);
  const bStart = timeToMinutes(bTime);
  if (aStart == null || bStart == null) return false;
  const aEnd = aStart + durationToMinutes(aDuration);
  const bEnd = bStart + durationToMinutes(bDuration);
  return aStart < bEnd && bStart < aEnd;
}
