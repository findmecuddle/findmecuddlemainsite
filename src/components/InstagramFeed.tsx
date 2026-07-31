"use client";

import { useEffect } from "react";
import { INSTAGRAM_HANDLE, INSTAGRAM_POST_URLS, X_HANDLE } from "@/lib/config";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.1" cy="6.9" r="1.1" fill="currentColor" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 4l7.2 9.1L4.4 20h2.3l6-6.5 4.6 6.5H20l-7.6-9.6L19 4h-2.3l-5.6 6-4.3-6H4z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Embeds real Instagram posts with no API key or access token — just Instagram's
 * public oEmbed script. Add post URLs to INSTAGRAM_POST_URLS in lib/config.ts as you
 * post them; there's no live auto-sync without setting up the Instagram Graph API.
 */
export default function InstagramFeed() {
  useEffect(() => {
    if (INSTAGRAM_POST_URLS.length === 0) return;
    if (window.instgrm) {
      window.instgrm.Embeds.process();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleUrl = `https://instagram.com/${INSTAGRAM_HANDLE}`;
  const xUrl = X_HANDLE ? `https://x.com/${X_HANDLE}` : null;

  if (INSTAGRAM_POST_URLS.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-5">
        <a href={handleUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-spruce hover:underline">
          <InstagramIcon className="h-5 w-5" />
          Follow @{INSTAGRAM_HANDLE} on Instagram
        </a>
        {xUrl && (
          <a href={xUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-spruce hover:underline">
            <XIcon className="h-4 w-4" />
            Follow @{X_HANDLE} on X
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {INSTAGRAM_POST_URLS.slice(0, 6).map((url) => (
          <blockquote
            key={url}
            className="instagram-media"
            data-instgrm-permalink={url}
            data-instgrm-version="14"
            style={{ margin: 0, width: "100%" }}
          />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-5">
        <a href={handleUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-spruce hover:underline">
          <InstagramIcon className="h-5 w-5" />
          Follow @{INSTAGRAM_HANDLE}
        </a>
        {xUrl && (
          <a href={xUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-spruce hover:underline">
            <XIcon className="h-4 w-4" />
            Follow @{X_HANDLE}
          </a>
        )}
      </div>
    </div>
  );
}
