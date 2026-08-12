import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignOutButton } from "@clerk/nextjs";
import "./globals.css";
import { SITE_NAME } from "@/lib/config";
import { currentClerkUserId, currentCuddler } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} · Find A Cuddler Near You`, template: `%s · ${SITE_NAME}` },
  description:
    "Find Me Cuddle: search independent cuddlers near you by zip code or city. In-person and virtual sessions.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  verification: {
    google: "vD6qNaffOnVOBUJ_tx6sFZEKU3GH6t9FxOmmuQT_d0E",
    other: {
      "msvalidate.01": "8BAE9EBA69927DDDAEEAF2668539AEAD",
    },
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentCuddler();
  // Someone can be signed in to Clerk without a cuddlers row yet (mid-onboarding, e.g. stuck on
  // /onboarding — see dashboard/page.tsx and onboarding/page.tsx). `me` is null in that state, so
  // it must be checked separately, otherwise these users see "Log In / Join Today" in the header
  // as if they were signed out, with no way to find a Log Out button anywhere on the site.
  const clerkUserId = me ? null : await currentClerkUserId();
  return (
    <ClerkProvider>
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-line bg-porcelain/90 backdrop-blur">
          <div className="container-page flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-spruce-deep">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="" className="h-8 w-8" />
              {SITE_NAME}
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/search" className="hidden px-3 py-2 text-stone2 hover:text-ink sm:block">
                Browse Cuddlers
              </Link>
              <Link href="/pricing" className="hidden px-3 py-2 text-stone2 hover:text-ink sm:block">
                Advertise
              </Link>
              {me ? (
                <Link href="/dashboard" className="btn-ghost">My Listing</Link>
              ) : clerkUserId ? (
                <>
                  <Link href="/onboarding" className="px-3 py-2 text-stone2 hover:text-ink">
                    Finish Setup
                  </Link>
                  <SignOutButton>
                    <button className="btn-ghost">Log Out</button>
                  </SignOutButton>
                </>
              ) : (
                <>
                  <Link href="/login" className="px-3 py-2 text-stone2 hover:text-ink">Log In</Link>
                  <Link href="/signup" className="btn-primary">Join Today</Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line">
          <div className="container-page flex flex-col items-start justify-between gap-3 py-8 text-sm text-stone2 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
            <div className="flex gap-5">
              <Link href="/pricing" className="hover:text-ink">Advertise</Link>
              <Link href="/login" className="hover:text-ink">Cuddler Login</Link>
              <Link href="/how-it-works" className="hover:text-ink">How It Works</Link>
              <Link href="/faq" className="hover:text-ink">FAQ</Link>
              <Link href="/contact" className="hover:text-ink">Contact Support</Link>
              <Link href="/privacy" className="hover:text-ink">Privacy</Link>
              <Link href="/terms" className="hover:text-ink">Terms</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
    </ClerkProvider>
  );
}
