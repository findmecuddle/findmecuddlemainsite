import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Auto-served at /robots.txt by Next.js — no extra config needed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/onboarding", "/admin", "/login", "/signup", "/forgot-password", "/reset-password", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
