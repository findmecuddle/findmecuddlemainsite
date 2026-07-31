// Simple inline brand icons for social links (Instagram/TikTok/X) — lucide-react dropped brand
// logos, same reason InstagramFeed.tsx already has its own inline Instagram/X svgs. These are
// stateless, so safe to use from a server component too (see cuddlers/[slug]/page.tsx).

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.1" cy="6.9" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 4l7.2 9.1L4.4 20h2.3l6-6.5 4.6 6.5H20l-7.6-9.6L19 4h-2.3l-5.6 6-4.3-6H4z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M14 3v10.5a2.5 2.5 0 1 1-2-2.45V9a4.5 4.5 0 1 0 4 4.47V8.2a6 6 0 0 0 4 1.55V7.7a4 4 0 0 1-2.8-1.15A4 4 0 0 1 16 4V3h-2z"
        fill="currentColor"
      />
    </svg>
  );
}

export function socialIconFor(platform: string) {
  if (platform === "Instagram") return InstagramIcon;
  if (platform === "TikTok") return TikTokIcon;
  if (platform === "X") return XIcon;
  return null;
}
