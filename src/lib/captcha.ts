/**
 * Cloudflare Turnstile verification (https://developers.cloudflare.com/turnstile/) — free,
 * privacy-respecting captcha to keep bots off the signup and forgot-password forms.
 *
 * If TURNSTILE_SECRET_KEY isn't set (e.g. local dev before you've created a Turnstile site),
 * this skips verification entirely rather than blocking the form. Set it before real launch.
 */
let warnedMissingInProd = false;

export async function verifyCaptcha(token: FormDataEntryValue | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Loud, one-time server-log warning if this happens in production — captcha is silently
    // bypassed otherwise, which is fine for local dev but a real gap if forgotten at launch.
    if (process.env.NODE_ENV === "production" && !warnedMissingInProd) {
      warnedMissingInProd = true;
      console.error(
        "WARNING: TURNSTILE_SECRET_KEY is not set in production. Captcha checks are being " +
          "skipped on every form (signup, login, admin login, password reset, reviews, reports, " +
          "newsletter, contact). Set it in .env to actually enforce them."
      );
    }
    return true; // not configured yet — don't block local dev/testing
  }

  if (!token || typeof token !== "string") return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}
