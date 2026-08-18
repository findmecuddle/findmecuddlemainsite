import Link from "next/link";
import {
  SITE_NAME,
  LEGAL_CONTACT_EMAIL,
  SUPPORT_EMAIL,
  BOOST_COOLDOWN_HOURS,
  VACATION_PAUSE_DAYS,
  VIP_BOOST_GRANT,
} from "@/lib/config";

export const metadata = {
  title: "Frequently Asked Questions",
  description: `Common questions about ${SITE_NAME}, for clients looking for a cuddler, and for cuddlers advertising their listing.`,
};

// Every answer here is sourced from what's actually true elsewhere in the app (Terms, Privacy
// Policy, lib/config.ts, lib/stripe.ts) rather than written fresh — if a policy changes, update it
// there first and this page should follow, not the other way around.
const CLIENT_FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it safe to book with a cuddler I find here?",
    a: (
      <>
        Before a listing can go live, we require the cuddler to pass an automated government-ID
        and live-selfie check. A profile showing the blue "✓ Verified" badge has passed that
        check, confirming a real government ID was checked against a live selfie. It isn't an
        ongoing guarantee of a cuddler's conduct, so use your own judgment the same way you would
        with any independent contractor. {SITE_NAME} is a directory, not the cuddler's employer,
        and every session is arranged directly between you and the cuddler.
      </>
    ),
  },
  {
    q: "How do I actually book a session?",
    a: (
      <>
        There's no in-app booking or payment. Each profile shows how the cuddler prefers to be
        reached: call, text, email, or the "Send My Info" form. You arrange the appointment,
        rates, and payment method directly with them.
      </>
    ),
  },
  {
    q: 'What does the "Available Now" badge mean, and what if I can\'t reach someone during their posted hours?',
    a: (
      <>
        Cuddlers can optionally list weekly hours, and "Available Now" reflects whether it's
        currently within those hours in the cuddler's own time zone. Some cuddlers choose to
        only take calls/texts during those hours (outside them, you'll see email or "Send My Info"
        instead). That's a setting they control, not a guarantee of an instant response either
        way. Hours are self-reported and approximate.
      </>
    ),
  },
  {
    q: "Do you charge clients anything, or take a cut of what I pay the cuddler?",
    a: "No. Browsing and contacting cuddlers is free, and we never see or take a percentage of what you pay a cuddler directly.",
  },
  {
    q: "What if something goes wrong during a session, or I feel unsafe?",
    a: (
      <>
        If you're ever in a dangerous situation, contact 911 or emergency services immediately.
        Don't wait to report it to us first. Once you're safe, you can submit a report right from
        the cuddler's listing, or{" "}
        <Link href="/contact" className="font-medium text-spruce hover:underline">
          contact support
        </Link>
        . We investigate every report, use a three-strike policy for confirmed violations, and
        cooperate with law enforcement on anything illegal.
      </>
    ),
  },
  {
    q: "Are the reviews on a listing real?",
    a: "Every review is submitted by someone claiming a genuine experience and goes through moderation before it appears publicly. We remove reviews that are fake, abusive, or violate our content rules.",
  },
];

const CUDDLER_FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How much does it cost to list on Find Me Cuddle?",
    a: (
      <>
        Standard and VIP plans. Current prices (pulled live from Stripe, so they're always
        accurate) are on the{" "}
        <Link href="/pricing" className="font-medium text-spruce hover:underline">
          pricing page
        </Link>
        . No commission or per-booking fee on top of your listing, since clients contact you
        directly.
      </>
    ),
  },
  {
    q: "What's the difference between Standard and VIP?",
    a: (
      <>
        VIP adds {VIP_BOOST_GRANT} free boost credits every billing cycle, a second location, and
        up to 6 rotating photos on your ad (vs. 3 on Standard).
      </>
    ),
  },
  {
    q: "How does identity verification work?",
    a: (
      <>
        Complete an automated government-ID and live-selfie check through Stripe Identity. Once
        it's approved, your listing can go live and shows the "Verified" badge. Approval can take
        up to 24 hours, though it's often faster than that.
      </>
    ),
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, from your dashboard, whenever you want. Canceling stops future billing but doesn't refund the period you're currently in. See our Terms of Service for the full refund policy.",
  },
  {
    q: "What are boosts?",
    a: (
      <>
        A boost temporarily pushes your ad to the top of local search and marks it "Featured." You
        buy boost credits from your dashboard and spend one whenever you want the spotlight, up to
        once every {BOOST_COOLDOWN_HOURS} hours. Monthly VIP includes {VIP_BOOST_GRANT} free
        credits every billing cycle.
      </>
    ),
  },
  {
    q: "What's the off-hours gatekeeping toggle?",
    a: 'On by default: clients can only call or text you during the hours you set on your dashboard. Outside them, they see email or "Send My Info" instead, so you\'re not disturbed. You can turn it off anytime from the Hours card if you\'d rather be reachable around the clock.',
  },
  {
    q: 'What\'s "Site Messages Only"?',
    a: (
      <>
        A 4th contact option on your dashboard, alongside Phone Call, Text, and Email. Turn it on
        and your phone number and email stay private. Clients can only reach you through the
        "Send My Info" form on your profile, and every one of those messages is automatically
        checked against reports other cuddlers have filed before it lands in your inbox. See{" "}
        <Link href="/how-it-works" className="font-medium text-spruce hover:underline">
          how messaging and screening work
        </Link>{" "}
        for more.
      </>
    ),
  },
  {
    q: "What if I need to take time off?",
    a: `Use Vacation Pause from your dashboard. It hides your listing from search and pauses billing (if you're subscribed) for up to ${VACATION_PAUSE_DAYS} days, then both resume automatically. You can also end it early.`,
  },
  {
    q: "Can I link my own website?",
    a: "Yes, add it from your dashboard. We review each link before it goes live (and again if you ever change it) so we're not vouching for a destination we haven't looked at.",
  },
  {
    q: "Can I delete my account?",
    a: "Yes, anytime from your dashboard. It cancels any active subscription immediately (no refund or proration for time you've already paid for) and removes your listing, photos, and verification documents.",
  },
  {
    q: "Do you help promote my listing beyond the site itself?",
    a: "Boosts and the VIP badge help within search. We also repost approved listings on our own social channels and invest in outside marketing, not just organic posts.",
  },
];

function FaqSection({ title, items }: { title: string; items: { q: string; a: React.ReactNode }[] }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.map(({ q, a }) => (
          <details key={q} className="card group p-4 open:border-spruce">
            <summary className="cursor-pointer list-none font-medium text-ink marker:content-none">
              <span className="flex items-center justify-between gap-3">
                {q}
                <span className="shrink-0 text-stone2 transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-stone2">{a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function FaqPage() {
  // Plain-text versions for the FAQPage structured data below — React nodes above render the
  // rich linked version on the page; search engines just need the text.
  const toPlainText = (node: React.ReactNode): string => {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(toPlainText).join("");
    if (node && typeof node === "object" && "props" in (node as { props?: { children?: React.ReactNode } })) {
      return toPlainText((node as { props: { children?: React.ReactNode } }).props.children);
    }
    return "";
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [...CLIENT_FAQS, ...CUDDLER_FAQS].map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: toPlainText(a) },
    })),
  };

  return (
    <div className="bg-silk-mist">
      <div className="container-page relative max-w-3xl py-14">
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <h1 className="font-display text-4xl font-semibold tracking-tight">Frequently Asked Questions</h1>
        <p className="mt-3 text-stone2">
          Questions from clients looking for a cuddler, and from cuddlers advertising on {SITE_NAME}.
          Don't see yours? <Link href="/contact" className="font-medium text-spruce hover:underline">Contact support</Link>.
        </p>

        <div className="mt-10 grid gap-12">
          <FaqSection title="For Clients" items={CLIENT_FAQS} />
          <FaqSection title="For Cuddlers" items={CUDDLER_FAQS} />
        </div>

        <p className="mt-12 text-xs text-stone2">
          For the full legal details behind these answers, see our{" "}
          <Link href="/terms" className="font-medium text-spruce hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="font-medium text-spruce hover:underline">Privacy Policy</Link>
          , or email{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-medium text-spruce hover:underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          {" "}/{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-spruce hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
