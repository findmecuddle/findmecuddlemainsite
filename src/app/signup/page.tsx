"use client";

import { SignUp } from "@clerk/nextjs";

// Clerk only handles creating login credentials here (email/password or Google). Name, location,
// and the required Terms/age/marketing checkboxes are collected right after, on /onboarding —
// see actions.ts completeOnboarding() and app/onboarding/page.tsx.
export default function SignupPage() {
  return (
    <div className="container-page flex justify-center py-16">
      <SignUp
        routing="hash"
        signInUrl="/login"
        forceRedirectUrl="/onboarding"
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "card w-full p-8 shadow-none",
            headerTitle: "font-display text-2xl font-semibold",
            headerSubtitle: "text-sm text-stone2",
            formButtonPrimary: "btn-primary w-full",
            footerActionLink: "font-medium text-spruce hover:underline",
          },
        }}
      />
    </div>
  );
}
