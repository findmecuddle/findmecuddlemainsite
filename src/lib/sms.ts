/**
 * Builds an `sms:` link with a pre-filled message body.
 *
 * The query-string separator before "body=" differs by platform for historical reasons —
 * iOS wants `&`, Android (and everything else) wants `?`. We sniff the User-Agent from the
 * incoming request server-side (this runs inside a Server Component via next/headers), so no
 * client-side JS is needed and it works the same on first paint for every visitor.
 */
export function smsHref(phone: string, body: string, userAgent: string | null): string {
  const isIOS = !!userAgent && /iPhone|iPad|iPod/i.test(userAgent);
  const sep = isIOS ? "&" : "?";
  return `sms:${phone}${sep}body=${encodeURIComponent(body)}`;
}
