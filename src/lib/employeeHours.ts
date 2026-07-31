// Per-employee weekly hours, stored as one JSON blob per row (agencyEmployees.hoursJson) rather than
// a second hours table — see the comment on that column in lib/schema.ts. This mirrors the exact
// day fields used by HoursForm/applyHoursUpdate for the agency's own hours (day_${day}_closed/open/
// close), so the same day-grid UI pattern works for an employee's card too — just built/read
// against a JSON string instead of a cuddler_hours table.

import { WEEK_DAYS } from "./config";

export type EmployeeHourRow = {
  day: number;
  closed: boolean;
  openTime: string | null;
  closeTime: string | null;
};

function blankWeek(): EmployeeHourRow[] {
  return WEEK_DAYS.map(({ day }) => ({ day, closed: true, openTime: null, closeTime: null }));
}

/** Reads day_${day}_closed/open/close fields off a submitted employee form into one JSON string. */
export function buildEmployeeHoursJson(formData: FormData): string {
  const rows: EmployeeHourRow[] = WEEK_DAYS.map(({ day }) => {
    const closed = formData.get(`day_${day}_closed`) === "on";
    const open = String(formData.get(`day_${day}_open`) || "").trim();
    const close = String(formData.get(`day_${day}_close`) || "").trim();
    const missingTimes = !open || !close;
    return {
      day,
      closed: closed || missingTimes,
      openTime: closed || missingTimes ? null : open,
      closeTime: closed || missingTimes ? null : close,
    };
  });
  return JSON.stringify(rows);
}

/** Parses a stored hoursJson blob back into one row per day, Monday-first — same shape whether or
 *  not the employee has ever saved hours yet, so callers never need a null check. */
export function parseEmployeeHours(json: string | null | undefined): EmployeeHourRow[] {
  if (!json) return blankWeek();
  try {
    const parsed = JSON.parse(json) as EmployeeHourRow[];
    const byDay = new Map(parsed.map((r) => [r.day, r]));
    return WEEK_DAYS.map(({ day }) => byDay.get(day) ?? { day, closed: true, openTime: null, closeTime: null });
  } catch {
    return blankWeek();
  }
}
