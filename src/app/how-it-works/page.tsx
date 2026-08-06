import Link from "next/link";
import { Inbox, MessageSquareText, ShieldAlert, Flag } from "lucide-react";
import { SITE_NAME, REPORT_REASONS } from "@/lib/config";

export const metadata = {
  title: "How Messaging & Client Screening Work",
  description: `See exactly how clients reach out to cuddlers on ${SITE_NAME}, how the dashboard message inbox works, and how the client-screening system warns you about contacts other cuddlers have reported.`,
};

export default function HowItWorksPage() {
  return (
    <div className="container-page max-w-3xl py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-spruce">For Cuddlers &amp; Agencies</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
        How Messaging &amp; Client Screening Work
      </h1>
      <p className="mt-3 max-w-2xl text-stone2">
        Every client inquiry lands in one inbox on your dashboard, and every contact is automatically checked
        against what other cuddlers on {SITE_NAME} have reported, before you ever have to respond.
      </p>

      {/* --- Step 1: how a client reaches out --- */}
      <section className="mt-14">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spruce-tint">
            <MessageSquareText className="h-5 w-5 text-spruce" strokeWidth={1.75} />
          </span>
          <h2 className="font-display text-2xl font-semibold">1. A Client Sends Their Info</h2>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone2">
          Instead of only a phone number, every profile has a "Send My Info" form. A client fills in their
          name, phone or email, how long they're hoping for, whether they'd rather come to you or have you
          come to them, and roughly when. No account or sign-up required on their end. Outside the hours
          you've set to be reachable by call or text, this form is the main way clients get in touch, so
          it's worth keeping an eye on.
        </p>
      </section>

      {/* --- Step 2: the inbox --- */}
      <section className="mt-14">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spruce-tint">
            <Inbox className="h-5 w-5 text-spruce" strokeWidth={1.75} />
          </span>
          <h2 className="font-display text-2xl font-semibold">2. It Lands In Your Message Inbox</h2>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone2">
          That submission is emailed to you right away, and also saved to a Messages inbox on your dashboard
          so you're never relying on email alone. From there you can select one or several messages at once
          to mark as read or delete, or use "Mark All As Read" to clear your inbox in one click.
        </p>

        {/* Static mockup — illustrative only, not wired to real data. */}
        <div className="card mt-6 max-w-xl p-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <p className="text-sm font-semibold text-ink">Messages <span className="badge-pill ml-1 bg-spruce text-white">2 New</span></p>
            <div className="flex gap-2">
              <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs">Mark All As Read</span>
            </div>
          </div>
          <ul className="mt-3 grid gap-2">
            <li className="rounded-lg border border-spruce bg-spruce-tint p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-ink">Alex R.</span>
                <span className="badge-pill bg-spruce text-white">New</span>
                <span className="badge-pill border border-line bg-white text-ink">Outcall</span>
              </div>
              <p className="mt-1 text-xs text-stone2">(555) 019-2231</p>
              <p className="mt-2 text-xs text-stone2">
                <span className="font-medium text-ink">Deep Tissue</span> · 60 min · Saturday at 2:00 PM
              </p>
            </li>
            <li className="rounded-lg border border-line p-3 text-sm opacity-70">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-ink">Jordan P.</span>
                <span className="badge-pill border border-line bg-white text-ink">In-Studio</span>
              </div>
              <p className="mt-1 text-xs text-stone2">jordan@example.com</p>
              <p className="mt-2 text-xs text-stone2">
                <span className="font-medium text-ink">Swedish</span> · 90 min · Whenever open
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* --- Step 3: screening demo --- */}
      <section className="mt-14">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spruce-tint">
            <ShieldAlert className="h-5 w-5 text-spruce" strokeWidth={1.75} />
          </span>
          <h2 className="font-display text-2xl font-semibold">3. Every Contact Is Screened Automatically</h2>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone2">
          The moment a message shows up in your inbox, its phone number and email are checked against every
          report other cuddlers have filed. No lookup, no extra step: if that contact has a history, a
          warning shows up right next to their info, before you've replied to anything.
        </p>

        {/* Static mockup — illustrative only, not wired to real data. Mirrors the actual yellow (1
            report) / red (2+ reports) severity styling from the dashboard's Messages card. */}
        <div className="card mt-6 max-w-xl p-4">
          <ul className="grid gap-2">
            <li className="rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-ink">Sam T.</span>
                <span className="badge-pill border border-line bg-white text-ink">Outcall</span>
              </div>
              <p className="mt-1 text-xs font-medium text-amber-700">
                (555) 044-7710 <span className="ml-1">👎 1</span>
              </p>
              <p className="mt-2 text-xs text-stone2">
                <span className="font-medium text-ink">Prenatal</span> · 60 min · Tomorrow at 5:00 PM
              </p>
            </li>
            <li className="rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-ink">Chris M.</span>
                <span className="badge-pill border border-line bg-white text-ink">In-Studio</span>
              </div>
              <p className="mt-1 text-xs font-medium text-red-700">
                chris.m@example.com <span className="ml-1">👎 3</span>
              </p>
              <p className="mt-2 text-xs text-stone2">
                <span className="font-medium text-ink">Sports Cuddle</span> · 90 min · Friday at 11:00 AM
              </p>
            </li>
          </ul>
          <p className="mt-3 text-xs text-stone2">
            One report shows a yellow warning; two or more show red, giving you a quick sense of how serious it
            is without having to click into anything.
          </p>
        </div>

        <h3 className="mt-8 font-display text-lg font-semibold">Reporting A Bad Contact</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone2">
          Had a no-show, a scam, a chargeback, or someone aggressive or threatening? Report it straight from
          the message (or, if they contacted you outside the site, from a standalone lookup on your
          dashboard) by picking a reason, no need to write anything identifying:
        </p>
        <div className="card mt-4 max-w-md p-4">
          <p className="label">Reason</p>
          <div className="field mt-1 flex items-center justify-between text-sm text-ink">
            <span>{REPORT_REASONS[2]}</span>
            <span className="text-stone2">▾</span>
          </div>
          <p className="mt-3 text-xs text-stone2">
            {REPORT_REASONS.slice(0, -1).join(" · ")}, or "{REPORT_REASONS[REPORT_REASONS.length - 1]}" with
            your own short note.
          </p>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-stone2">
          A report only ever shows other cuddlers the phone/email, the reason, and how many times it's
          been reported, never your name or theirs. You can review everything you've filed from your
          dashboard and delete a report yourself if you made a mistake; if you need one corrected or
          reinstated instead, contact support.
        </p>
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          If you ever fear for your safety or are in a dangerous situation with a client, call 911 or local
          emergency services immediately. Don't wait to report it here first. {SITE_NAME} doesn't verify
          reports or investigate incidents; we only collect and display what's submitted. See our{" "}
          <Link href="/terms" className="font-medium underline">Terms of Service</Link> for the full policy.
        </div>
      </section>

      <section className="mt-14 flex items-center gap-3 border-t border-line pt-8">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spruce-tint">
          <Flag className="h-5 w-5 text-spruce" strokeWidth={1.75} />
        </span>
        <p className="text-sm text-stone2">
          Messaging and client screening are included on every plan. See{" "}
          <Link href="/pricing" className="font-medium text-spruce hover:underline">pricing</Link> or check
          the{" "}
          <Link href="/faq" className="font-medium text-spruce hover:underline">FAQ</Link> for more.
        </p>
      </section>
    </div>
  );
}
