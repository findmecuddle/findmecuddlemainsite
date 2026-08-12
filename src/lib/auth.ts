import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { cuddlers, type Cuddler } from "./schema";

// Fields that must never cross the server/client boundary — password hash, reset token hash,
// Stripe identifiers, private-storage keys, and the Clerk user id. `currentCuddler()` still
// fetches the full row (server-side code, e.g. actions.ts, legitimately needs all of it), but
// anything passed as a prop into a "use client" component gets serialized into the page's RSC
// payload and is visible in the browser, so dashboard/page.tsx must pass `toClientSafeCuddler(me)`
// — never `me` itself — into IdentityVerification/ListingForm (and, transitively, PhotoUploader,
// which ListingForm renders).
const SENSITIVE_FIELDS = [
  "passwordHash",
  "resetTokenHash",
  "resetTokenExpiresAt",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "licenseKey",
  "idKey",
  "identitySessionId",
  "clerkUserId",
] as const;

export type ClientSafeCuddler = Omit<Cuddler, (typeof SENSITIVE_FIELDS)[number]>;

export function toClientSafeCuddler(t: Cuddler): ClientSafeCuddler {
  const copy = { ...t };
  for (const field of SENSITIVE_FIELDS) delete copy[field];
  return copy;
}

// Login/session is entirely Clerk's responsibility now (see middleware.ts + ClerkProvider in
// layout.tsx). This file's job is just the one bit of glue the rest of the app depends on:
// mapping "who's the signed-in Clerk user" to "which cuddlers row is theirs", via clerkUserId.
// currentCuddler()/currentCuddlerId() keep the exact same signature they had before the
// Clerk migration on purpose — every existing call site (actions.ts, dashboard, API routes)
// needed zero changes because of it.

export async function currentCuddlerId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const rows = await db
    .select({ id: cuddlers.id })
    .from(cuddlers)
    .where(eq(cuddlers.clerkUserId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function currentCuddler(): Promise<Cuddler | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const rows = await db.select().from(cuddlers).where(eq(cuddlers.clerkUserId, userId)).limit(1);
  return rows[0] ?? null;
}

// True once someone has a Clerk account but hasn't finished the "complete your listing" step yet
// (see /onboarding) — i.e. signed in, but no cuddlers row points at them. Distinguishing this
// from "not signed in at all" is what lets dashboard/page.tsx send people to the right place.
export async function currentClerkUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

// Server-only helper for the onboarding step and admin-facing account actions — fetches the
// verified email address straight from Clerk rather than trusting a client-submitted value.
export async function clerkEmail(userId: string): Promise<string | null> {
  const user = await (await clerkClient()).users.getUser(userId);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}
