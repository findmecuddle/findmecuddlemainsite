// Despite the filename (kept as-is — it started as phone-only before flagging grew to cover email
// too), this now holds both normalizers used for the flagged-contacts lookup (see flagSeverityFor
// and reportContact in app/actions.ts).

/** Strips everything but digits, and drops a leading US country code "1" so "+1 (555) 201-8834",
 *  "555-201-8834", and "5552018834" all normalize to the same value — used so a phone number typed
 *  slightly differently by two different clients still matches. Returns null for anything too short
 *  to be a real number (e.g. empty string), so callers can skip the lookup entirely. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length >= 7 ? digits : null;
}

/** Lowercases + trims so "Jane@Example.com " and "jane@example.com" match. Returns null for
 *  anything that isn't at least shaped like an email. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}
