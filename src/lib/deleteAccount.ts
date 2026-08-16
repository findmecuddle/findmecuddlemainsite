// Shared account-deletion logic used by both the cuddler's own "Delete My Account" (see
// deleteAccount() in src/app/actions.ts) and the admin "Delete This Account" action (see
// adminDeleteCuddler() in src/app/admin/actions.ts) — kept in a plain (non "use server") module,
// same reasoning as lib/listingUpdate.ts: not independently callable as a server action/RPC
// endpoint, every caller is responsible for its own auth check first.
//
// Cancels billing immediately so nothing keeps charging after the account is gone, best-effort
// cleans up storage (photos + private license/ID documents) and the Clerk login, then deletes the
// cuddler row — reviews, reports, hours, and credit events all cascade-delete automatically via
// the foreign keys in schema.ts.

import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "./db";
import { cuddlers, type Cuddler } from "./schema";
import { stripe } from "./stripe";
import { deleteObject, deletePrivateObject, keyFromPublicUrl } from "./storage";

const PHOTO_URL_COLUMNS = ["photoUrl", "photoUrl2", "photoUrl3", "photoUrl4", "photoUrl5", "photoUrl6"] as const;

export async function deleteCuddlerAccount(t: Cuddler): Promise<void> {
  if (t.stripeSubscriptionId) {
    try {
      await stripe().subscriptions.cancel(t.stripeSubscriptionId);
    } catch {
      // Already canceled, or Stripe is unreachable — don't block account deletion on this;
      // worst case is one extra billing cycle, which support can refund on request.
    }
  }

  for (const col of PHOTO_URL_COLUMNS) {
    const url = (t as unknown as Record<string, string | null>)[col];
    const key = url ? keyFromPublicUrl(url) : null;
    if (key) deleteObject(key).catch(() => {});
  }
  if (t.licenseKey) deletePrivateObject(t.licenseKey).catch(() => {});
  if (t.idKey) deletePrivateObject(t.idKey).catch(() => {});

  await db.delete(cuddlers).where(eq(cuddlers.id, t.id));

  // Delete the Clerk login too — otherwise the account would still exist and be able to sign in
  // even though its listing/data is gone. Best-effort: DB deletion above is the part that matters
  // most for CCPA, so don't fail the whole request if Clerk is briefly unreachable.
  if (t.clerkUserId) {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(t.clerkUserId).catch(() => {});
  }
}
