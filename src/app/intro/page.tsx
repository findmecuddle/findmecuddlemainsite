import Link from "next/link";
import type { Metadata } from "next";
import { SITE_NAME, MANUAL_OPEN_NOW_HOURS } from "@/lib/config";

// Deliberately unlisted: not in the footer nav, not in sitemap.ts, and noindex/nofollow below so
// it doesn't turn up in search either. This is a one-off page meant to be sent directly (a link in
// a DM, email, or in person) to a prospective cuddler as a pitch/onboarding walkthrough, not
// something visitors are meant to stumble onto. There's no login gate on it, same as any other
// public marketing page, the URL itself just isn't published anywhere.
export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default function IntroPage() {
  return (
    <div className="container-page max-w-2xl py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spruce">A Quick Look At {SITE_NAME}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
        We Built This To Actually Support Independent Cuddlers
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-stone2">
        Tired of platforms that take your money, ban you without a real reason, or play favorites because they
        can? Here's a quick look at three things that make {SITE_NAME} different, how we invest part of every
        subscription back into marketing for you, how the message screening system protects you from bad
        clients, and how you control when your number is reachable.
      </p>

      <div className="mt-10 grid gap-10">
        <section>
          <h2 className="font-display text-xl font-semibold">We Invest In Your Visibility, Not Just Your Listing</h2>
          <div className="mt-3 grid gap-3 text-sm leading-relaxed text-ink/90">
            <p>
              A subscription here isn't just a listing fee. We reinvest a portion of every subscription directly
              into paid marketing, Google Ads, Meta Ads, and other channels, to bring more clients to{" "}
              {SITE_NAME}, and by extension, to you.
            </p>
            <p>
              We're also committing to publishing a report every quarter covering exactly what we spent and on
              what, so you can see it for yourself rather than take our word for it. Looking further ahead, we're
              working toward physical placements too, billboards and bus stop ads in major cities, to build real,
              visible recognition for the platform that carries over to every cuddler and agency listed here.
            </p>
          </div>
          <Link href="/transparency" className="mt-3 inline-block text-sm font-medium text-spruce hover:underline">
            Read our full transparency pledge →
          </Link>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">Every Message Is Screened Before It Reaches You</h2>
          <div className="mt-3 grid gap-3 text-sm leading-relaxed text-ink/90">
            <p>
              Clients reach you through "Send My Info" instead of your number being posted openly everywhere.
              Every request lands in your dashboard inbox and is emailed to you right away, even while you're
              offline.
            </p>
            <p>
              Here's the part that actually protects you: every incoming number and email is automatically
              checked against reports filed by other cuddlers on the platform. If a contact has been reported
              before, for a no-show, a scam, harassment, or worse, you'll see a yellow or red warning right on
              that message, before you ever respond. You can also flag a bad contact yourself after a bad
              experience, so other cuddlers get warned too, all without your identity, your note, or the
              client's name ever being shown to anyone else.
            </p>
          </div>
          <Link href="/how-it-works" className="btn-ghost mt-3 inline-block">
            See The Full How It Works Walkthrough →
          </Link>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">You Control When Your Number Is Reachable</h2>
          <div className="mt-3 grid gap-3 text-sm leading-relaxed text-ink/90">
            <p>
              Set your weekly hours on your dashboard, and by default, clients can only call or text you during
              those posted hours. Outside them, visitors automatically see Email and "Send My Info" instead, so
              you're never disturbed off the clock. Prefer to be reachable by call or text anytime regardless of
              your posted hours? Turn that off with one checkbox on your Hours card.
            </p>
            <p>
              There's also an "Available Now" button for last-minute availability, no hours set yet, or just
              stepping outside your normal schedule for a bit. Turning it on shows you as open for the next{" "}
              {MANUAL_OPEN_NOW_HOURS} hours, then it automatically turns back off on its own.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-12 rounded-card border border-line bg-porcelain p-6 text-center">
        <p className="font-display text-lg font-semibold">Ready To Take A Look?</p>
        <p className="mt-1 text-sm text-stone2">Setup takes a few minutes, and your first listing decision is always reversible.</p>
        <Link href="/signup" className="btn-primary mt-4 inline-block">Join Today</Link>
      </div>
    </div>
  );
}
