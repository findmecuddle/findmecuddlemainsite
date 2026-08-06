import Link from "next/link";
import { MapPin, Calendar, Info, Headphones, Crown, Zap } from "lucide-react";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers, type Cuddler } from "@/lib/schema";
import { isLive, isNewListing, isVip, isBoosted, photosApproved } from "@/lib/stripe";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import SearchBar from "@/components/SearchBar";
import InstagramFeed from "@/components/InstagramFeed";
import NewsletterForm from "@/components/NewsletterForm";

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  { icon: MapPin, title: "Search Nearby", body: "Enter a zip code or city to see cuddlers near you." },
  { icon: Calendar, title: "Check Availability", body: "Every profile lists weekly hours, so you know when they're free." },
  { icon: Info, title: "Get To Know Them", body: "Rates, a bit about who they are, and a verified badge, all in one place." },
  { icon: Headphones, title: "Reach Out Directly", body: "Message or contact the cuddler yourself and set up a time. No middleman." },
];

const HOMEPAGE_SECTION_LIMIT = 8;

export default async function HomePage() {
  // All live listings, split into three homepage showcases below. A listing only appears in the
  // first section it qualifies for — Boosted (temporary paid spotlight) outranks VIP (persistent
  // subscription perk), which outranks New (first NEW_LISTING_DAYS after signup) — so the same
  // card never shows up twice on the page.
  const candidates = await db
    .select()
    .from(cuddlers)
    .where(and(eq(cuddlers.published, true), eq(cuddlers.subStatus, "active")))
    .orderBy(desc(cuddlers.createdAt));
  const live = candidates.filter(isLive);

  const boostedProviders = live
    .filter(isBoosted)
    .sort((a, b) => (b.boostedAt?.getTime() ?? 0) - (a.boostedAt?.getTime() ?? 0))
    .slice(0, HOMEPAGE_SECTION_LIMIT);
  const shownAfterBoosted = new Set(boostedProviders.map((t) => t.id));

  const vipProviders = live
    .filter((t) => isVip(t) && !shownAfterBoosted.has(t.id))
    .slice(0, HOMEPAGE_SECTION_LIMIT);
  const shownAfterVip = new Set(Array.from(shownAfterBoosted).concat(vipProviders.map((t) => t.id)));

  const newProviders = live
    .filter((t) => isNewListing(t) && !shownAfterVip.has(t.id))
    .slice(0, HOMEPAGE_SECTION_LIMIT);

  // JSON-LD structured data — establishes the site itself as an entity for Google (and enables the
  // Sitelinks Search Box, which lets a search box appear directly under our result on Google) and
  // gives AI answer engines a clean, unambiguous "what is this site" fact instead of inferring it
  // from page copy.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo-icon.png`,
      },
    ],
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="border-b border-line bg-spruce-tint">
        <div className="container-page py-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spruce">
            For Cuddlers &amp; Agencies
          </p>
          <h2 className="mx-auto mt-2 max-w-2xl font-display text-xl font-semibold leading-snug sm:text-2xl">
            A Warmer Way To List Your Cuddle Practice
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-stone2">
            We built {SITE_NAME} because cuddlers deserve a home that actually feels like it's on their
            side: no surprise bans, no playing favorites, just a simple listing that puts a real, human
            connection front and center.
          </p>
        </div>
      </section>

      <section
        className="border-b border-line bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(rgba(247,245,240,0.88), rgba(247,245,240,0.88)), url(/hero-bg.jpg)",
        }}
      >
        <div className="container-page py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-spruce">
              Verified · Independent · Local
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Find A Cuddler <em className="font-normal italic text-spruce">Near You</em>
            </h1>
            <p className="mt-4 max-w-xl text-base text-stone2 sm:text-lg">
              A little comfort, connection, and calm, right in your area.
            </p>
          </div>
          <div className="mt-8 max-w-2xl">
            <SearchBar autoFocus compact />
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="container-page py-14">
          <h2 className="font-display text-2xl font-semibold">How It Works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spruce-tint">
                    <Icon className="h-5 w-5 text-spruce" strokeWidth={1.75} />
                  </span>
                  <h3 className="font-display text-lg font-semibold">{title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-stone2">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {boostedProviders.length > 0 && (
        <section className="border-t border-line bg-white">
          <div className="container-page py-14">
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <Zap className="h-6 w-6 fill-gold text-gold" strokeWidth={2} />
              Boosted Right Now
            </h2>
            <p className="mt-1 text-sm text-stone2">Currently in the spotlight, the paid boost perk in action.</p>
            <MiniProfileGrid cuddlers={boostedProviders} badge="boosted" />
          </div>
        </section>
      )}

      {vipProviders.length > 0 && (
        <section className="border-t border-line bg-white">
          <div className="container-page py-14">
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <Crown className="h-6 w-6 text-gold" strokeWidth={2} />
              Monthly VIP Members
            </h2>
            <p className="mt-1 text-sm text-stone2">Our VIP subscribers, from across the country.</p>
            <MiniProfileGrid cuddlers={vipProviders} badge="vip" />
          </div>
        </section>
      )}

      {newProviders.length > 0 && (
        <section className="border-t border-line bg-white">
          <div className="container-page py-10">
            <h2 className="font-display text-lg font-semibold">New on {SITE_NAME}</h2>
            <p className="mt-1 text-sm text-stone2">Recently joined, say Hello!</p>
            <MiniProfileGrid cuddlers={newProviders} badge={null} compact />
          </div>
        </section>
      )}

      <section className="border-t border-line bg-porcelain">
        <div className="container-page grid gap-8 py-14 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <h2 className="font-display text-2xl font-semibold">New Cuddlers Near You</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-stone2">
              Give us your name, email, and location, and we'll let you know as new cuddlers join in
              your area.
            </p>
          </div>
          <div className="card p-6">
            <NewsletterForm />
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="container-page py-14">
          <h3 className="font-display text-lg font-semibold">Are You A Cuddler?</h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone2">
            List yourself on {SITE_NAME} with a Standard or VIP profile, and start connecting with
            clients near you.
          </p>
          <Link href="/pricing" className="mt-3 inline-block text-sm font-medium text-spruce hover:underline">
            See listing plans →
          </Link>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="container-page py-14">
          <h2 className="font-display text-2xl font-semibold">Follow Us On Instagram</h2>
          <div className="mt-6">
            <InstagramFeed />
          </div>
        </div>
      </section>
    </>
  );
}

type BadgeKind = "boosted" | "vip" | null;

/** Square mini-profile cards shared by the Boosted / VIP / New homepage showcases. */
function MiniProfileGrid({
  cuddlers,
  badge,
  compact = false,
}: {
  cuddlers: Cuddler[];
  badge: BadgeKind;
  /** Smaller thumbnails for the (lower-priority) New section. */
  compact?: boolean;
}) {
  return (
    <ul className={`mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 ${compact ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}>
      {cuddlers.map((t) => (
        <li key={t.id}>
          <Link href={`/cuddlers/${t.slug}`} className="group block">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-spruce-tint">
              {photosApproved(t) && t.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.cardPhotoUrl || t.photoUrl}
                  alt={t.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-3xl text-spruce">
                  {t.name.charAt(0)}
                </div>
              )}
              {badge === "boosted" && (
                <span className="badge-pill absolute left-1.5 top-1.5 bg-gradient-to-r from-gold to-[#8a6a2c] text-white shadow-sm">
                  <Zap className="h-3 w-3 shrink-0 fill-white" strokeWidth={2.5} />
                  Featured
                </span>
              )}
              {badge === "vip" && (
                <span className="badge-pill absolute left-1.5 top-1.5 bg-gradient-to-r from-spruce-deep to-spruce text-white shadow-sm ring-1 ring-gold/40">
                  <Crown className="h-3 w-3 shrink-0 text-gold" strokeWidth={2.5} />
                  VIP
                </span>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-medium text-ink group-hover:text-spruce">{t.name}</p>
            {badge === "boosted" && t.boostMessage ? (
              <p className="truncate text-xs font-medium text-gold">{t.boostMessage}</p>
            ) : (
              <p className="truncate text-xs text-stone2">{t.city}, {t.state}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
