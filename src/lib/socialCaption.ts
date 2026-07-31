import { SITE_NAME } from "./config";

/**
 * Builds a ready-to-copy social caption for the "Ready To Post" admin queue (see
 * pendingSocialPosts() in admin/actions.ts and the queue UI in admin/page.tsx). This is the only
 * place caption text is generated — nothing here posts anywhere automatically, it just hands an
 * admin something they can paste straight into X, Facebook, or anywhere else.
 */
export function buildSocialCaption(t: {
  name: string;
  city: string;
  state: string;
  headline: string | null;
  bio: string | null;
  services: string | null;
  listingUrl: string;
}): string {
  const blurb = t.headline?.trim() || (t.bio ? t.bio.trim().slice(0, 140) + (t.bio.trim().length > 140 ? "…" : "") : "");
  const services = (t.services ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  const cityTag = t.city.replace(/[^a-zA-Z]/g, "");
  const siteTag = SITE_NAME.replace(/[^a-zA-Z]/g, "");

  const lines = [
    `🧘 Meet ${t.name} — now on ${SITE_NAME} in ${t.city}, ${t.state}!`,
    blurb || null,
    services ? `Services: ${services}` : null,
    "",
    `Book directly: ${t.listingUrl}`,
    "",
    `#${cityTag}Cuddle #CuddleProfessional #${siteTag}`,
  ].filter((l): l is string => l !== null);

  return lines.join("\n");
}
