// Up to SOCIAL_LINKS_MAX social profile links per cuddler/agency, stored as one JSON blob
// (cuddlers.socialLinks) rather than numbered slot columns — same "always read/written as a
// whole unit" reasoning as employeeHours.ts. Not admin-reviewed (unlike websiteUrl): Instagram,
// TikTok, X, and Other are a narrower, known set of platforms, so these go live immediately.

import { SOCIAL_PLATFORMS, SOCIAL_LINKS_MAX, SOCIAL_URL_MAX_CHARS } from "./config";

export type SocialLink = { platform: string; url: string };

/** Reads social_platform_1..N / social_url_1..N fields off a submitted listing form into a
 *  validated JSON string. Rows missing either a platform or a URL are dropped rather than saved
 *  half-filled, and anything past SOCIAL_LINKS_MAX or with an unrecognized platform is ignored. */
export function buildSocialLinksJson(formData: FormData): string | null {
  const links: SocialLink[] = [];
  for (let i = 1; i <= SOCIAL_LINKS_MAX; i++) {
    const platform = String(formData.get(`social_platform_${i}`) || "").trim();
    const url = String(formData.get(`social_url_${i}`) || "").trim().slice(0, SOCIAL_URL_MAX_CHARS);
    if (!platform || !url) continue;
    if (!SOCIAL_PLATFORMS.includes(platform)) continue;
    if (!/^https?:\/\/.+/i.test(url)) continue;
    links.push({ platform, url });
  }
  return links.length > 0 ? JSON.stringify(links.slice(0, SOCIAL_LINKS_MAX)) : null;
}

/** Parses a stored socialLinks blob back into a plain array, always SOCIAL_LINKS_MAX or fewer. */
export function parseSocialLinks(json: string | null | undefined): SocialLink[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as SocialLink[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => l && typeof l.platform === "string" && typeof l.url === "string")
      .slice(0, SOCIAL_LINKS_MAX);
  } catch {
    return [];
  }
}
