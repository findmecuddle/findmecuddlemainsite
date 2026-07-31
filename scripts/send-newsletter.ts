/**
 * Sends the "new cuddlers near you" digest to every consented newsletter subscriber.
 *
 * Run manually with: npx tsx scripts/send-newsletter.ts
 * In production, schedule this on a recurring cron job (e.g. weekly) — it's a plain script, not a
 * web endpoint, so a standard crontab entry works:
 *   0 9 * * 1  cd /path/to/app && npx tsx scripts/send-newsletter.ts >> newsletter.log 2>&1
 *
 * Each subscriber only gets emailed about cuddlers that joined after their last digest (or, on
 * their very first digest, cuddlers still within the site's "New" window — see NEW_LISTING_DAYS
 * in lib/config.ts) so nobody sees the same listing twice.
 */
import "dotenv/config"; // tsx doesn't auto-load .env the way `next dev`/`next build` do.
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { cuddlers, newsletterSubscribers } from "../src/lib/schema";
import { milesBetween } from "../src/lib/geo";
import { isLive } from "../src/lib/stripe";
import { sendNewsletterDigestEmail } from "../src/lib/email";
import { SITE_NAME, SITE_URL, NEWSLETTER_RADIUS_MILES, NEW_LISTING_DAYS } from "../src/lib/config";

const DIGEST_MAX_LISTINGS = 10;

async function main() {
  const subscribers = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.consent, true));

  if (subscribers.length === 0) {
    console.log("No subscribers to notify.");
    return;
  }

  const candidates = (
    await db
      .select()
      .from(cuddlers)
      .where(and(eq(cuddlers.published, true), eq(cuddlers.subStatus, "active")))
  ).filter(isLive);

  let sent = 0;
  for (const sub of subscribers) {
    const cutoff = sub.lastNotifiedAt ?? new Date(sub.createdAt.getTime() - NEW_LISTING_DAYS * 86_400_000);

    const nearby = candidates.filter(
      (t) => t.createdAt > cutoff && milesBetween(sub, { lat: t.lat, lng: t.lng }) <= NEWSLETTER_RADIUS_MILES
    );

    if (nearby.length === 0) continue;

    const listings = nearby.slice(0, DIGEST_MAX_LISTINGS).map((t) => ({
      name: t.name,
      city: t.city,
      state: t.state,
      url: `${SITE_URL}/cuddlers/${t.slug}`,
    }));

    await sendNewsletterDigestEmail({
      to: sub.email,
      name: sub.name,
      siteName: SITE_NAME,
      siteUrl: SITE_URL,
      listings,
      unsubscribeUrl: `${SITE_URL}/api/newsletter/unsubscribe?token=${sub.unsubscribeToken}`,
    });

    await db
      .update(newsletterSubscribers)
      .set({ lastNotifiedAt: new Date() })
      .where(eq(newsletterSubscribers.id, sub.id));

    sent++;
  }

  console.log(`Sent ${sent} digest email(s) out of ${subscribers.length} subscriber(s).`);
}

main();
