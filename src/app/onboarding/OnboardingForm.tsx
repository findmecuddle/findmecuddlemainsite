"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { completeOnboarding } from "@/app/actions";
import { SITE_NAME } from "@/lib/config";

export default function OnboardingForm() {
  const [state, action] = useFormState(completeOnboarding, null as null | { error?: string });
  // Agency/team accounts are hidden from signup as of the v1 launch decision — every new signup is
  // a solo cuddler. The accountType field still exists server-side (see actions.ts) and defaults to
  // "solo" when omitted, so this form simply never sends it. The underlying agency code (schema,
  // TeamManager, agency Stripe plans) is untouched in case this is turned back on later.

  return (
    <form action={action} className="mt-7 grid gap-5">
      <div className="grid gap-4">
        <div>
          <label className="label" htmlFor="name">
            Name Shown On Your Ad
          </label>
          <input
            id="name"
            name="name"
            required
            className="field"
            placeholder="Jordan Reyes, LMT"
          />
        </div>
        <div>
          <label className="label" htmlFor="location">Where You Cuddle</label>
          <input id="location" name="location" required className="field" placeholder="Zip code or City, ST" />
        </div>
      </div>
      <div className="grid gap-3 border-t border-line pt-5">
        <label className="flex items-start gap-2.5 text-sm text-stone2">
          <input type="checkbox" name="ageConfirm" required className="mt-0.5 h-4 w-4 shrink-0 accent-spruce" />
          <span>I confirm I am 18 years of age or older.</span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-stone2">
          <input type="checkbox" name="agreeToTerms" required className="mt-0.5 h-4 w-4 shrink-0 accent-spruce" />
          <span>
            I agree to the{" "}
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
        <label className="flex items-start gap-2.5 text-sm text-stone2">
          <input type="checkbox" name="marketingOptIn" className="mt-0.5 h-4 w-4 shrink-0 accent-spruce" />
          <span>
            Send me occasional emails about promotions, tips, and updates from {SITE_NAME}. I can
            unsubscribe anytime. (Optional.)
          </span>
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full">Finish Setting Up My Listing</button>
    </form>
  );
}
