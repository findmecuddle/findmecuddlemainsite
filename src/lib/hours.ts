import { MANUAL_OPEN_NOW_HOURS } from "./config";

// Single canonical IANA timezone per US state. A few states technically span two zones (small
// slivers of TX/FL/ID/OR/ND/SD/KY/TN/IN/MI/NE/KS sit in a neighboring one), but this is right for
// the large majority of each state's population — good enough for a courtesy "Open Now"
// indicator/gate, not something that needs to be perfectly precise to the county.
export const STATE_TIMEZONES: Record<string, string> = {
  AL: "America/Chicago", AK: "America/Anchorage", AZ: "America/Phoenix", AR: "America/Chicago",
  CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DE: "America/New_York",
  DC: "America/New_York", FL: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu",
  ID: "America/Denver", IL: "America/Chicago", IN: "America/New_York", IA: "America/Chicago",
  KS: "America/Chicago", KY: "America/New_York", LA: "America/Chicago", ME: "America/New_York",
  MD: "America/New_York", MA: "America/New_York", MI: "America/New_York", MN: "America/Chicago",
  MS: "America/Chicago", MO: "America/Chicago", MT: "America/Denver", NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver",
  NY: "America/New_York", NC: "America/New_York", ND: "America/Chicago", OH: "America/New_York",
  OK: "America/Chicago", OR: "America/Los_Angeles", PA: "America/New_York", RI: "America/New_York",
  SC: "America/New_York", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  UT: "America/Denver", VT: "America/New_York", VA: "America/New_York", WA: "America/Los_Angeles",
  WV: "America/New_York", WI: "America/Chicago", WY: "America/Denver",
};

const DAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Current local day-of-week (0=Sun..6=Sat) and "HH:MM" (24h) in the given state's timezone. */
function nowInState(state: string | null | undefined): { day: number; hm: string } {
  const tz = (state && STATE_TIMEZONES[state.toUpperCase()]) || "America/New_York";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  let hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  if (hour === "24") hour = "00"; // some runtimes format midnight as 24 with hour12:false
  return { day: DAY_MAP[weekday] ?? 0, hm: `${hour}:${minute}` };
}

// One entry per open time block (see cuddlerHours in lib/schema.ts) — a day with no blocks is
// simply closed, so there's no separate "closed" flag here anymore.
export type HourRow = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
};

/**
 * True if right now — in the cuddler's own state's local time, not the visitor's or the
 * server's — falls within ANY of their configured open blocks for today. Same-day ranges only
 * (close time after open time), matching the assumption the rest of the hours UI already makes.
 */
export function isOpenNow(rows: HourRow[], state: string | null | undefined): boolean {
  const { day, hm } = nowInState(state);
  return rows.some((r) => r.dayOfWeek === day && hm >= r.openTime && hm <= r.closeTime);
}

/** True if the cuddler has entered any hours at all (vs. leaving the optional field blank). */
export function hasAnyHours(rows: HourRow[]): boolean {
  return rows.length > 0;
}

/** True only while a manual "I'm Open Now" activation is still within MANUAL_OPEN_NOW_HOURS —
 *  lets a cuddler with no posted hours (or who's just stepping outside them for a bit) flip on
 *  the Open Now badge/search filter themselves. Same one-shot-timestamp-checked-through-a-window
 *  pattern as isBoosted()/isPaused() in lib/stripe.ts — openNowActivatedAt is never cleared, only
 *  ever overwritten by a fresh press. */
export function isManuallyOpen(t: { openNowActivatedAt: Date | null }): boolean {
  return !!t.openNowActivatedAt && Date.now() - t.openNowActivatedAt.getTime() < MANUAL_OPEN_NOW_HOURS * 3600_000;
}
