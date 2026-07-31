"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile captcha widget, rendered explicitly on mount.
 *
 * Why not just `<div className="cf-turnstile" />`? The Turnstile script only auto-scans the page
 * once, when it first loads. With client-side navigation (clicking a link from the homepage to
 * /signup, for example), the script is already loaded by the time the new form appears, so the
 * widget silently never renders — and the form then fails the server-side captcha check.
 * Rendering explicitly on mount works no matter how the user got to the page.
 *
 * Renders nothing if NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set (the server-side check is skipped
 * in that case too, so local dev without keys keeps working).
 */
export default function Turnstile() {
  const ref = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) return;
    let widgetId: string | null = null;
    let cancelled = false;

    const tryRender = () => {
      if (cancelled || !ref.current) return;
      if (window.turnstile) {
        // Guard against double-render (e.g. React strict mode remounts).
        if (ref.current.childElementCount === 0) {
          widgetId = window.turnstile.render(ref.current, { sitekey: siteKey });
        }
      } else {
        // Script hasn't finished loading yet — check again shortly.
        setTimeout(tryRender, 150);
      }
    };
    tryRender();

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // Widget may already be gone with the unmounted DOM node — nothing to clean up.
        }
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={ref} />
    </>
  );
}
