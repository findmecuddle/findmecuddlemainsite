"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { completeOnboarding } from "@/app/actions";
import { SITE_NAME } from "@/lib/config";

export default function OnboardingForm() {
  const [state, action] = useFormState(completeOnboarding, null as null | { error?: string });
  const [accountType, setAccountType] = useState<"solo" | "agency">("solo");

  return (
    <form action={action} className="mt-7 grid gap-5">
      <div>
        <label className="label">I'm Signing Up As</label>
        <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-4 text-sm transition-colors ${
              accountType === "solo" ? "border-spruce bg-spruce-tint" : "border-line hover:border-spruce/40"
            }`}
          >
            <input
              type="radio"
              name="accountType"
              value="solo"
              checked={accountType === "solo"}
              onChange={() => setAccountType("solo")}
              className="mt-0.5 h-4 w-4 shrink-0 accent-spruce"
            />
            <span>
              <span className="font-medium text-ink">An Individual Cuddler</span>
              <span className="mt-1 block text-xs leading-relaxed text-stone2">
                One listing, your own rates and services.
              </span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-4 text-sm transition-colors ${
              accountType === "agency" ? "border-spruce bg-spruce-tint" : "border-line hover:border-spruce/40"
            }`}
          >
            <input
              type="radio"
              name="accountType"
              value="agency"
              checked={accountType === "agency"}
              onChange={() => setAccountType("agency")}
              className="mt-0.5 h-4 w-4 shrink-0 accent-spruce"
            />
            <span>
              <span className="font-medium text-ink">A Agency Or Business</span>
              <span className="mt-1 block text-xs leading-relaxed text-stone2">
                One listing with a team of cuddlers, each with their own photo, hours, and cuddle types.
              </span>
            </span>
          </label>
        </div>
      </div>
      <div className="grid gap-4">
        <div>
          <label className="label" htmlFor="name">
            {accountType === "agency" ? "Your Agency Or Business Name" : "Name Shown On Your Ad"}
          </label>
          <input
            id="name"
            name="name"
            required
            className="field"
            placeholder={accountType === "agency" ? "Serenity Agency & Wellness" : "Jordan Reyes, LMT"}
          />
        </div>
        <div>
          <label className="label" htmlFor="location">Where You Practice</label>
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
            Send me occasional emails about promotions, tips, and updates from {SITE_NAME} — I can
            unsubscribe anytime. (Optional.)
          </span>
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full">Finish Setting Up My Listing</button>
    </form>
  );
}
