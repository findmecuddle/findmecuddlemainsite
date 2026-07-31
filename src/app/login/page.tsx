"use client";

import { SignIn } from "@clerk/nextjs";

// routing="hash" keeps Clerk's internal steps (forgot-password flow, email codes, Google
// OAuth callback) all on this same /login URL via hash fragments, instead of requiring a
// Next.js catch-all route (/login/[[...rest]]) that would replace this file.
export default function LoginPage() {
  return (
    <div className="container-page flex justify-center py-16">
      <SignIn
        routing="hash"
        signUpUrl="/signup"
        forceRedirectUrl="/dashboard"
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
