"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ClientSafeCuddler } from "@/lib/auth";
import type { AgencyEmployee } from "@/lib/schema";
import { PLAN_BUTTON_LABELS, SUPPORT_EMAIL } from "@/lib/config";
import { completeSetup, togglePublished, attestListing } from "@/app/actions";
import VerificationForm from "./VerificationForm";
import IdentityVerification from "./IdentityVerification";
import ListingForm from "./ListingForm";
import TeamManager from "./TeamManager";
import HoursForm from "./HoursForm";

type SafeCuddler = ClientSafeCuddler & { hasLicenseOnFile: boolean };
type HoursProp = React.ComponentProps<typeof HoursForm>["hours"];

type Step = {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  render: () => React.ReactNode;
};

/**
 * Shown instead of the normal dashboard to any cuddler who hasn't finished setup yet (see the
 * setupCompletedAt gate in dashboard/page.tsx). Deliberately reuses the exact same form components
 * as the regular dashboard (VerificationForm, IdentityVerification, ListingForm, TeamManager,
 * HoursForm) one at a time instead of building new ones — same validation, same server actions,
 * same "Save" buttons inside each; this file only adds the step navigation around them.
 *
 * "Next" is disabled until the current step is done (see each step's isComplete below) — a
 * cuddler can always go Back, just not skip ahead. The last step's "Finish Setup" is available
 * regardless of live/approval status, since going fully live also depends on admin review timing
 * that's outside their control; from that point on they use the normal dashboard, where the Status
 * card already explains what (if anything) is still pending.
 */
export default function SetupWizard({
  cuddler: t,
  agency,
  employees,
  employeeLimit,
  hours,
  availablePlans,
}: {
  cuddler: SafeCuddler;
  agency: boolean;
  employees: AgencyEmployee[];
  employeeLimit: number;
  hours: HoursProp;
  availablePlans: { key: string; label: string }[];
}) {
  // Attestation is its own checkbox rather than baked into ListingForm's own save action —
  // ListingForm is shared with the regular dashboard (where it's saved over and over as edits
  // happen), and this attestation only makes sense once, the first time someone finishes filling
  // out their ad here in the wizard. Gates "Next" on the ad step below the same way every other
  // step's isComplete does.
  //
  // Initialized from listingAttestedAt (persisted, see schema.ts), NOT plain local-only state —
  // Subscribe posts to /api/checkout, which redirects out to Stripe Checkout and back, and Stripe
  // Identity's hosted verification flow does the same. Either round trip fully remounts this
  // component, and local-only state doesn't survive that: it used to reset to unchecked, which
  // flipped the Ad step's isComplete back to false and sent the wizard all the way back to step 0.
  const [attestConfirmed, setAttestConfirmed] = useState(!!t.listingAttestedAt);
  const [, startAttestTransition] = useTransition();

  function confirmAttestation(checked: boolean) {
    setAttestConfirmed(checked);
    // One-way and idempotent: unchecking only affects this session's local display, there's no
    // "un-attest" action, and calling attestListing() again once already set is a harmless no-op.
    if (checked) startAttestTransition(() => { attestListing(); });
  }

  const steps: Step[] = [
    {
      id: "ad",
      title: agency ? "Fill Out Your Agency's Ad" : "Fill Out Your Ad",
      description: "Add your bio, services, rates, and photos — this is what clients will see.",
      isComplete: !!(t.services || t.bio || (agency && employees.length > 0)) && attestConfirmed,
      render: () => (
        <div className="grid gap-4">
          <ListingForm cuddler={t} />
          <label className="card flex items-start gap-2.5 p-6 text-sm">
            <input
              type="checkbox"
              checked={attestConfirmed}
              onChange={(e) => confirmAttestation(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-spruce"
            />
            <span>
              I confirm everything in my listing is accurate, and I agree to the{" "}
              <Link href="/terms" target="_blank" className="font-medium text-spruce hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-spruce hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>
      ),
    },
    ...(agency
      ? [
          {
            id: "team",
            title: "Add Your Team",
            description: "Add each cuddler on your team, with their own photo, hours, and cuddle types.",
            isComplete: employees.length > 0,
            render: () => <TeamManager employees={employees} employeeLimit={employeeLimit} />,
          } satisfies Step,
        ]
      : []),
    {
      id: "hours",
      title: "Set Your Hours",
      description: "Clients can only call, text, or message you during the hours you set here.",
      isComplete: hours.some((h) => h.row !== null),
      render: () => <HoursForm hours={hours} gatekeepHours={t.gatekeepHours} />,
    },
    // Plan/payment is deliberately asked for here — after the ad, team, and hours are already
    // filled in — rather than as the very first step. Someone who's already invested a few minutes
    // building their listing is far more likely to subscribe than someone hitting a paywall before
    // they've seen any payoff. It's still placed before verification (rather than after) so
    // verification stays the true last content step before Publish — see that step's comment below
    // for why that ordering matters to the admin review queue.
    {
      id: "plan",
      title: agency ? "Choose Your Agency Plan" : "Choose Your Plan",
      description: "Pick a listing plan to get started — you can change plans anytime later.",
      isComplete: t.subStatus === "active",
      render: () => (
        <form action="/api/checkout" method="POST" className="card grid gap-3 p-6">
          <input type="hidden" name="type" value="plan" />
          <select
            name="plan"
            className="field"
            defaultValue={availablePlans.some((p) => p.key === "standard") ? "standard" : availablePlans[0]?.key}
          >
            {availablePlans.map((p) => (
              <option key={p.key} value={p.key}>
                {PLAN_BUTTON_LABELS[p.key]}
              </option>
            ))}
          </select>
          <button className="btn-primary w-full">Subscribe</button>
          <p className="text-xs text-stone2">
            Prices shown at Stripe checkout. Cancel anytime. Have a promo code? You'll be able to enter it on the
            checkout page before you pay.
          </p>
        </form>
      ),
    },
    // License + identity are submitted together as the last step before Publish (rather than
    // right after choosing a plan) so a listing only ever shows up in the admin review queue once
    // everything else — the ad, hours, team for agencies — is already filled in. That way approving
    // the license and identity check is the one thing standing between "submitted" and "live",
    // instead of an admin approving a still-mostly-empty listing early and having to circle back.
    {
      id: "verification",
      title: "Verify Your Certification & Identity",
      description: "Submit your certification and complete a quick ID check — we review both together.",
      isComplete:
        (!!t.verificationSubmittedAt || t.licenseNotRequired) &&
        (t.identityStatus === "verified" || t.identityStatus === "pending"),
      render: () => (
        <div className="grid gap-6">
          <VerificationForm
            cuddler={{
              verificationStatus: t.verificationStatus,
              verificationNote: t.verificationNote,
              licenseNotRequired: t.licenseNotRequired,
              state: t.state,
              hasLicenseOnFile: t.hasLicenseOnFile,
            }}
          />
          <IdentityVerification cuddler={t} />
          <p className="text-xs text-stone2">
            Approval can take up to 24 hours. Try refreshing this page every so often — it often goes through
            faster than that.
          </p>
          <VerificationFailureNotice cuddler={t} />
        </div>
      ),
    },
    {
      id: "publish",
      title: "Publish Your Ad",
      description: "Last step — publish to go live once everything above is approved.",
      isComplete: true,
      render: () => <PublishStep cuddler={t} />,
    },
  ];

  const firstIncomplete = steps.findIndex((s) => !s.isComplete);
  const [stepIndex, setStepIndex] = useState(firstIncomplete === -1 ? steps.length - 1 : firstIncomplete);
  const [isPending, startTransition] = useTransition();
  const step = steps[stepIndex];

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));
  const finish = () => startTransition(() => completeSetup());

  return (
    <div className="container-page max-w-2xl py-10">
      <div className="card p-6">
        <p className="text-xs font-medium text-stone2">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <div className="mt-2 flex gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full ${
                i < stepIndex || s.isComplete ? "bg-spruce" : i === stepIndex ? "bg-spruce/40" : "bg-line"
              }`}
            />
          ))}
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">{step.title}</h1>
        <p className="mt-1 text-sm text-stone2">{step.description}</p>
      </div>

      <div className="mt-6">{step.render()}</div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>

        {stepIndex === steps.length - 1 ? (
          <button type="button" onClick={finish} disabled={isPending} className="btn-primary">
            Finish Setup — Go To My Dashboard
          </button>
        ) : (
          <div className="text-right">
            <button
              type="button"
              onClick={goNext}
              disabled={!step.isComplete}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
            {!step.isComplete && <p className="mt-1 text-xs text-stone2">Complete this step above to continue.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function PublishStep({ cuddler: t }: { cuddler: SafeCuddler }) {
  const ready = t.subStatus === "active" && t.verificationStatus === "approved" && t.identityStatus === "verified";
  return (
    <div className="card grid gap-3 p-6">
      <h2 className="font-display text-lg font-semibold">You're Ready</h2>
      {ready ? (
        <>
          <p className="text-sm text-stone2">
            Everything's approved. Publish your ad to make it visible in search, then finish setup below to go
            to your full dashboard.
          </p>
          <form action={togglePublished}>
            <button className={t.published ? "btn-ghost w-full" : "btn-primary w-full"}>
              {t.published ? "Unpublish My Ad" : "Publish My Ad"}
            </button>
          </form>
        </>
      ) : (
        <p className="text-sm text-stone2">
          You're all set on your end — we're just finishing up review on your license and/or identity check.
          Approval can take up to 24 hours; try refreshing this page every so often, it often goes through
          faster than that. Your ad goes live automatically once approved. Finish setup below to go to your
          dashboard, where you can track the status and make changes anytime.
        </p>
      )}
      <VerificationFailureNotice cuddler={t} />
    </div>
  );
}

/** Shown wherever verification status is visible in the wizard (the combined verification step
 *  and the final Publish step) whenever either half was rejected/failed — a cuddler stuck on a
 *  bounced license or a failed ID check has no self-service fix (resubmitting license photos and
 *  retrying the Stripe Identity check are already possible above; this is for when that's not
 *  enough), so this points them straight at support instead of leaving them stuck with no next
 *  step. */
function VerificationFailureNotice({ cuddler: t }: { cuddler: SafeCuddler }) {
  const licenseRejected = t.verificationStatus === "rejected";
  const identityFailed = t.identityStatus === "failed";
  if (!licenseRejected && !identityFailed) return null;

  return (
    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">
        {licenseRejected && identityFailed
          ? "Your license and identity check both need another look."
          : licenseRejected
          ? "Your license submission needs another look."
          : "Your identity check didn't go through."}
      </p>
      <p className="mt-1">
        {licenseRejected && t.verificationNote && `${t.verificationNote} `}
        You can try resubmitting above. If it still isn't working, contact us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline">
          {SUPPORT_EMAIL}
        </a>{" "}
        and we'll help sort it out.
      </p>
    </div>
  );
}
