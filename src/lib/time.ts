/** Formats "HH:MM" (24h) as "9:00 AM". Returns null for missing/invalid input. */
export function formatTime12(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  if (h < 0 || h > 23) return null;
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${suffix}`;
}
