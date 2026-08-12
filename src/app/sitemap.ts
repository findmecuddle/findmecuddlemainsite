import type { MetadataRoute } from "next";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers } from "@/lib/schema";
import { isLive } from "@/lib/stripe";
import { SITE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Auto-served at /sitemap.xml by Next.js — no extra config needed. Lists every static page plus
 * every live (published + subscribed + verified) cuddler profile, so search engines can find
 * individual listings without needing to crawl the search results first.
 *
 * City landing pages and the blog were left out of the v1 (MVP) scope for this site — add their
 * entries back here if/when those features get built, same pattern as the original app's sitemap.ts.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const candidates = await db
    .select({
      slug: cuddlers.slug,
      published: cuddlers.published,
      subStatus: cuddlers.subStatus,
      activeUntil: cuddlers.activeUntil,
      identityStatus: cuddlers.identityStatus,
      pausedAt: cuddlers.pausedAt,
      suspendedAt: cuddlers.suspendedAt,
      createdAt: cuddlers.createdAt,
    })
    .from(cuddlers)
    .where(and(eq(cuddlers.published, true), eq(cuddlers.subStatus, "active")));

  const cuddlerPages: MetadataRoute.Sitemap = candidates
    .filter(isLive)
    .map((t) => ({
      url: `${SITE_URL}/cuddlers/${t.slug}`,
      lastModified: t.createdAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticPages, ...cuddlerPages];
}
