import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Zap, Check } from "lucide-react";
import { headers } from "next/headers";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cuddlers, reviews, agencyEmployees } from "@/lib/schema";
import { isLive, isVip, isNewListing, isBoosted, isVerified, isAgencyAccount, photosApproved, photoLimit, websiteApproved } from "@/lib/stripe";
import { getHours } from "@/app/actions";
import { formatTime12 } from "@/lib/time";
import { isOpenNow, hasAnyHours, isManuallyOpen } from "@/lib/hours";
import { parseEmployeeHours } from "@/lib/employeeHours";
import { parseSocialLinks } from "@/lib/socialLinks";
import { RATE_CONTACT_LABEL, SMS_TEMPLATE, SITE_NAME, SITE_URL, WEEK_DAYS } from "@/lib/config";
import { smsHref } from "@/lib/sms";
import ReviewForm from "@/components/ReviewForm";
import ReportForm from "@/components/ReportForm";
import PhotoCarousel from "@/components/PhotoCarousel";
import SendInfoForm from "@/components/SendInfoForm";
import { socialIconFor } from "@/components/SocialIcons";

export const dynamic = "force-dynamic";

// JS Date#getDay() convention (0=Sun..6=Sat), same as hourRows' dayOfWeek below — maps straight to
// schema.org's day-of-week URIs for openingHoursSpecification.
const SCHEMA_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const rows = await db.select().from(cuddlers).where(eq(cuddlers.slug, params.slug)).limit(1);
  const t = rows[0];
  if (!t || !isLive(t)) return { title: "Not Found" };

  const title = `${t.name}: ${t.accountType === "agency" ? "Agency" : "Cuddle Professional"} in ${t.city}, ${t.state}`;
  const description =
    t.headline ||
    (t.bio ? t.bio.slice(0, 155) : `Book a cuddle session with ${t.name} in ${t.city}, ${t.state} on ${SITE_NAME}.`);

  return {
    title,
    description,
    openGraph: { title, description, images: t.photoUrl && photosApproved(t) ? [t.photoUrl] : undefined },
  };
}

export default async function CuddlerPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const rows = await db.select().from(cuddlers).where(eq(cuddlers.slug, params.slug)).limit(1);
  const t = rows[0];
  if (!t || !isLive(t)) notFound();

  const hours = await getHours(t.id);
  // Only gate Call/Text on hours if the cuddler actually set any — leaves contact wide open
  // (as it's always been) for the many listings that left this optional field blank, rather than
  // silently locking everyone out who hasn't filled it in.
  const hourRows = hours.flatMap((h) =>
    h.blocks.map((b) => ({ dayOfWeek: h.day, openTime: b.openTime!, closeTime: b.closeTime! }))
  );
  const hasHours = hasAnyHours(hourRows);
  // openNow reflects reality (for the badge below) regardless of the gatekeeping toggle — it's
  // only contactLocked that decides whether Call/Text actually get hidden. No hours listed and no
  // manual activation means we genuinely don't know, so it's NOT treated as open — but Call/Text
  // still isn't locked in that case either (see contactLocked's `hasHours &&` guard below), since
  // we don't want to silently shut off contact for someone who just left the optional field blank.
  const openNow = isManuallyOpen(t) || (hasHours && isOpenNow(hourRows, t.state));
  const contactLocked = hasHours && t.gatekeepHours && !openNow;
  const approvedReviews = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.cuddlerId, t.id), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.createdAt));
  const avgRating =
    approvedReviews.length > 0
      ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
      : null;

  // "Getting to know you" — only ever shown as label: value pairs for whichever fields the
  // cuddler actually filled in (see the matching columns' comments in lib/schema.ts).
  const gettingToKnowYou: { label: string; value: string }[] = [
    { label: "Favorite Food", value: t.favoriteFood ?? "" },
    { label: "Favorite Animal", value: t.favoriteAnimal ?? "" },
    { label: "Enjoys Pets", value: t.enjoysPets ?? "" },
    { label: "Allergies", value: t.allergies ?? "" },
    { label: "Favorite Music", value: t.favoriteMusic ?? "" },
    { label: "Favorite Things To Do", value: t.favoriteActivities ?? "" },
    { label: "Favorite Movie", value: t.favoriteMovie ?? "" },
    { label: "Favorite TV Show", value: t.favoriteShow ?? "" },
    { label: "Height", value: t.height ?? "" },
    { label: "Body Type", value: t.bodyType ?? "" },
    { label: "Hair Color", value: t.hairColor ?? "" },
    { label: "Eye Color", value: t.eyeColor ?? "" },
  ].filter((f) => f.value);
  const agencyAccount = isAgencyAccount(t);
  const employees = agencyAccount
    ? await db
        .select()
        .from(agencyEmployees)
        .where(eq(agencyEmployees.cuddlerId, t.id))
        .orderBy(asc(agencyEmployees.sortOrder), asc(agencyEmployees.createdAt))
    : [];
  const vip = isVip(t);
  const boosted = isBoosted(t);
  const isNew = isNewListing(t);
  const joined = t.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  // Photos only render once an admin has approved the current set for content (full-face shot, no
  // AI-generated images, a workspace/agency photo) — see photosApproved() in lib/stripe.ts. Until
  // then this is an empty list, and the page falls back to the initial-letter placeholder below.
  const photos = photosApproved(t)
    ? (
        [
          { url: t.photoUrl, w: t.photoW, h: t.photoH },
          { url: t.photoUrl2, w: t.photoW2, h: t.photoH2 },
          { url: t.photoUrl3, w: t.photoW3, h: t.photoH3 },
          { url: t.photoUrl4, w: t.photoW4, h: t.photoH4 },
          { url: t.photoUrl5, w: t.photoW5, h: t.photoH5 },
          { url: t.photoUrl6, w: t.photoW6, h: t.photoH6 },
        ] as { url: string | null; w: number | null; h: number | null }[]
      )
        .filter((p): p is { url: string; w: number; h: number } => !!p.url && !!p.w && !!p.h)
        .slice(0, photoLimit(t))
    : [];

  // JSON-LD structured data — helps Google show rich results (ratings, hours, price range) and
  // helps AI answer engines (ChatGPT, Perplexity, Google AI Overviews, etc.) parse this listing's
  // core facts directly instead of guessing from rendered text. HealthAndBeautyBusiness is the
  // closest fit in schema.org's vocabulary — there's no dedicated "cuddle professional" type — and
  // it applies fine to both solo and agency accounts, since either way this is a bookable local
  // business. Every field mirrors the same visibility rules as the page itself below (e.g.
  // telephone/email are omitted under Site Messages Only, same as the Call/Text/Email buttons).
  const priceRange = t.hourlyRate != null ? `$${t.hourlyRate}/hr` : undefined;
  const canShowPhone = !t.messagesOnly && (t.acceptsCalls || t.acceptsTexts) && !!t.phone;
  const canShowEmail = !t.messagesOnly && t.acceptsEmail && !!t.contactEmail;
  const openHours = hourRows;
  const socialLinks = parseSocialLinks(t.socialLinks);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: t.name,
    url: `${SITE_URL}/cuddlers/${t.slug}`,
    ...(photos[0]?.url ? { image: photos[0].url } : {}),
    description:
      t.headline ||
      (t.bio
        ? t.bio.slice(0, 300)
        : `${agencyAccount ? "Agency" : "Cuddle cuddler"} in ${t.city}, ${t.state} on ${SITE_NAME}.`),
    address: { "@type": "PostalAddress", addressLocality: t.city, addressRegion: t.state, addressCountry: "US" },
    ...(canShowPhone ? { telephone: t.phone } : {}),
    ...(canShowEmail ? { email: t.contactEmail } : {}),
    ...(priceRange ? { priceRange } : {}),
    ...(socialLinks.length > 0 ? { sameAs: socialLinks.map((l) => l.url) } : {}),
    ...(avgRating != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round(avgRating * 10) / 10,
            reviewCount: approvedReviews.length,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(openHours.length > 0
      ? {
          openingHoursSpecification: openHours.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: `https://schema.org/${SCHEMA_DAY_NAMES[h.dayOfWeek]}`,
            opens: h.openTime,
            closes: h.closeTime,
          })),
        }
      : {}),
  };

  return (
    <div className="container-page py-10 sm:py-14">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
        <div>
          {vip && photos.length > 1 ? (
            // Monthly VIP perk: photos auto-rotate in a single fixed-size frame instead of a static row.
            (<PhotoCarousel photos={photos} alt={t.name} />)
          ) : (
            photos.length > 0 && (
              // Every photo displays in the same fixed-size square tile (object-cover fits/crops
              // it visually to fill the frame) so photo galleries look consistent from one profile
              // to the next, regardless of what aspect ratio each original upload happens to be.
              // This is purely a display crop — the stored file itself is never touched, so nothing
              // here can cause the kind of data loss the old crop tool did (see cardPhotoUrl in
              // schema.ts). Row scrolls horizontally if photos don't all fit.
              (<div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <div key={p.url} className="h-64 w-64 shrink-0 overflow-hidden rounded-2xl bg-spruce-tint sm:h-80 sm:w-80">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`${t.name}, photo ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>)
            )
          )}

          <div className="mt-6 flex items-start gap-5">
            {photos.length === 0 && (
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-spruce-tint">
                <div className="flex h-full w-full items-center justify-center font-display text-4xl text-spruce">
                  {t.name.charAt(0)}
                </div>
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="font-display text-3xl font-semibold">{t.name}</h1>
                {boosted && (
                  <span className="badge-pill bg-gradient-to-r from-gold to-[#8a6a2c] text-white">
                    <Zap className="h-3.5 w-3.5 shrink-0 fill-white" strokeWidth={2.5} />
                    Featured
                  </span>
                )}
                {!boosted && vip && (
                  <span className="badge-pill bg-gradient-to-r from-spruce-deep to-spruce text-white">
                    <Crown className="h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.5} />
                    VIP
                  </span>
                )}
                {isVerified(t) && (
                  <span className="badge-pill bg-blue-50 text-blue-700">
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                    Verified
                  </span>
                )}
                {isNew && (
                  <span className="badge-pill bg-emerald-600 text-white">New</span>
                )}
              </div>
              <p className="mt-1 text-stone2">
                <Link
                  href={`/search?q=${encodeURIComponent(`${t.city}, ${t.state}`)}`}
                  className="hover:text-spruce hover:underline"
                >
                  {t.city}, {t.state}
                </Link>
                {t.gender && ` · ${t.gender === "female" ? "Female" : "Male"}`}
                {t.mobile ? " · Mobile sessions available" : ""} ·{" "}
                <em className="font-display font-normal italic text-stone2">Joined {joined}</em>
              </p>
              {boosted && t.boostMessage && (
                <p className="mt-2 flex items-center gap-1.5 text-base font-medium text-gold">
                  <Zap className="h-4 w-4 shrink-0 fill-gold" strokeWidth={2.5} />
                  {t.boostMessage}
                </p>
              )}
              {t.headline && <p className="mt-2 text-lg">{t.headline}</p>}
            </div>
          </div>

          {t.bio && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-semibold">About</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink/90">{t.bio}</p>
            </div>
          )}

          {gettingToKnowYou.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-semibold">Getting To Know Me</h2>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {gettingToKnowYou.map((f) => (
                  <div key={f.label} className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-1.5 text-sm sm:justify-start">
                    <dt className="text-stone2">{f.label}</dt>
                    <dd className="text-right font-medium text-ink sm:ml-auto sm:text-left">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {agencyAccount && employees.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-semibold">Our Team</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {employees.map((e) => {
                  const empServices = (e.services ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                  const empHours = parseEmployeeHours(e.hoursJson).filter((h) => !h.closed);
                  return (
                    <div key={e.id} className="card p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-spruce-tint">
                          {e.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={e.photoUrl} alt={e.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-display text-lg text-spruce">
                              {e.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">
                            {e.name}
                            {e.gender && (
                              <span className="ml-1.5 text-xs font-normal text-stone2">
                                ({e.gender === "female" ? "Female" : "Male"})
                              </span>
                            )}
                          </p>
                          {empServices.length > 0 && (
                            <p className="mt-0.5 text-xs text-stone2">{empServices.join(", ")}</p>
                          )}
                        </div>
                      </div>
                      <ul className="mt-3 grid gap-0.5 border-t border-line pt-2 text-xs text-stone2">
                        {empHours.length > 0 ? (
                          empHours.map((h) => (
                            <li key={h.day} className="flex justify-between">
                              <span>{WEEK_DAYS.find((d) => d.day === h.day)?.label}</span>
                              <span>{formatTime12(h.openTime) ?? "?"} – {formatTime12(h.closeTime) ?? "?"}</span>
                            </li>
                          ))
                        ) : (
                          <li>Hours not set</li>
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <h2 className="font-display text-xl font-semibold">
                Reviews
                {avgRating !== null && (
                  <span className="ml-2 text-base font-normal text-stone2">
                    <span className="text-gold">★</span> {avgRating.toFixed(1)} ({approvedReviews.length})
                  </span>
                )}
              </h2>
              <ReviewForm cuddlerId={t.id} mobileOffered={t.mobile} />
            </div>
            {approvedReviews.length === 0 && <p className="mt-2 text-sm text-stone2">No reviews yet.</p>}
            {approvedReviews.length > 0 && (
              <ul className="mt-3 grid gap-4">
                {approvedReviews.map((r) => (
                  <li key={r.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium">{r.authorName}</span>
                      <span className="text-gold text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      <span className="text-xs text-stone2">
                        {r.createdAt.toLocaleDateString()}
                        {r.sessionType && ` · ${r.sessionType === "studio" ? "In-Studio" : "Mobile"}`}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink/90">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="card h-fit p-6">
          <h2 className="font-display text-lg font-semibold">Book A Session</h2>
          {!agencyAccount && (
            <ul className="mt-2 grid gap-1 text-sm">
              <li className="flex justify-between">
                <span className="text-stone2">In-Person, Per Hour</span>
                <span className={t.hourlyRate != null ? "font-medium text-ink" : "text-stone2"}>
                  {t.hourlyRate != null ? `$${t.hourlyRate}` : RATE_CONTACT_LABEL}
                </span>
              </li>
              {t.offersVirtual && (
                <li className="flex justify-between">
                  <span className="text-stone2">Virtual, Per Hour</span>
                  <span className={t.virtualHourlyRate != null ? "font-medium text-ink" : "text-stone2"}>
                    {t.virtualHourlyRate != null ? `$${t.virtualHourlyRate}` : RATE_CONTACT_LABEL}
                  </span>
                </li>
              )}
            </ul>
          )}
          <p className="mt-3 text-sm text-stone2">{t.city}, {t.state} {t.zip}</p>
          {vip && t.city2 && (
            <p className="mt-1 text-sm text-stone2">
              <span className="text-stone2">Also serving:</span> {t.city2}, {t.state2} {t.zip2}
            </p>
          )}

          {websiteApproved(t) && (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Website</h3>
              <a
                href={t.websiteUrl!}
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="mt-2 inline-block break-all text-sm font-medium text-spruce hover:underline"
              >
                {t.websiteUrl}
              </a>
              <p className="mt-1 text-xs text-stone2">
                External link, provided by {t.name.split(" ")[0]}. {SITE_NAME} doesn't control or vouch for its
                content.
              </p>
            </div>
          )}

          {socialLinks.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">Follow {t.name.split(" ")[0]}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {socialLinks.map((link) => {
                  const Icon = socialIconFor(link.platform);
                  return (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink/90 hover:border-spruce hover:text-spruce"
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {link.platform}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {hasHours && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Hours</h3>
                {openNow ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Open Now
                  </span>
                ) : (
                  <span className="rounded-full bg-porcelain px-2 py-0.5 text-[11px] font-medium text-stone2">
                    Closed Now
                  </span>
                )}
              </div>
              <ul className="mt-2 grid gap-1 text-sm">
                {hours.map(({ day, label, blocks }) => (
                  <li key={day} className="flex justify-between text-stone2">
                    <span>{label}</span>
                    <span className={blocks.length > 0 ? "text-ink" : ""}>
                      {blocks.length > 0
                        ? blocks
                            .map((b) => `${formatTime12(b.openTime) ?? "?"} – ${formatTime12(b.closeTime) ?? "?"}`)
                            .join(", ")
                        : "Closed"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {t.messagesOnly ? (
            <p className="mt-4 rounded-lg bg-porcelain px-3 py-2 text-xs text-stone2">
              {t.name.split(" ")[0]} only accepts messages through {SITE_NAME}. Every inquiry is
              automatically checked against reports from other cuddlers before it reaches them.
              Send your info below.
            </p>
          ) : ((t.acceptsCalls || t.acceptsTexts) && t.phone) || (t.acceptsEmail && t.contactEmail) ? (
            <div className="mt-4 grid gap-2">
              {contactLocked && (t.acceptsCalls || t.acceptsTexts) && t.phone && (
                <p className="rounded-lg bg-porcelain px-3 py-2 text-xs text-stone2">
                  {t.name.split(" ")[0]} is currently outside business hours; call and text open
                  back up during the hours listed above. Email, or send your info below, in the meantime.
                </p>
              )}
              {t.acceptsTexts && t.phone && !contactLocked && (
                <a href={smsHref(t.phone, SMS_TEMPLATE, (await headers()).get("user-agent"))} className="btn-primary w-full">
                  Send A Text
                </a>
              )}
              {t.acceptsCalls && t.phone && !contactLocked && (
                <a href={`tel:${t.phone}`} className="btn-ghost w-full">Call {t.phone}</a>
              )}
              {t.acceptsEmail && t.contactEmail && (
                <a href={`mailto:${t.contactEmail}`} className="btn-ghost w-full">Email {t.name.split(" ")[0]}</a>
              )}
            </div>
          ) : null}
          <p className="mt-4 text-xs text-stone2">
            Contact {t.name.split(" ")[0]} directly to schedule. Rates and availability are set by the cuddler.
          </p>

          <div className="mt-2">
            <SendInfoForm cuddlerId={t.id} cuddlerFirstName={t.name.split(" ")[0]} />
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <ReportForm cuddlerId={t.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
