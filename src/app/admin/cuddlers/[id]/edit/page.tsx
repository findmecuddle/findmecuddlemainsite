import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/adminAuth";
import {
  adminGetCuddler,
  adminUpdateListing,
  adminUpdateHours,
  adminOverrideIdentity,
  adminResetIdentity,
  cuddlerReviews,
  adminDeleteReview,
  manualFlagPhoto,
  undoCardCrop,
} from "@/app/admin/actions";
import { getHours } from "@/app/actions";
import { toClientSafeCuddler } from "@/lib/auth";
import { isLive, isPaused, isSuspended } from "@/lib/stripe";
import ListingForm from "@/app/dashboard/ListingForm";
import HoursForm from "@/app/dashboard/HoursForm";

export const dynamic = "force-dynamic";

export default async function AdminEditCuddlerPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const t = await adminGetCuddler(id);
  if (!t) notFound();

  const [hours, safeCuddler, reviews] = [await getHours(id), toClientSafeCuddler(t), await cuddlerReviews(id)];
  const live = isLive(t);
  const suspended = isSuspended(t);
  const paused = isPaused(t);

  // Same "what's blocking go-live" order dashboard/page.tsx uses for the cuddler's own status
  // message — mirrored here so an admin can see at a glance why an otherwise-set-up account isn't
  // live, instead of having to scroll down and guess. isLive() checks these in this exact order.
  const notLiveReason = live
    ? null
    : suspended
    ? "Suspended. Lift the suspension below to allow it to go live again."
    : !t.published
    ? 'Not published. The "Publish My Ad" checkbox in the form below is off.'
    : t.subStatus !== "active"
    ? `No active subscription (subscription status: "${t.subStatus}").`
    : t.activeUntil && t.activeUntil.getTime() < Date.now()
    ? `Subscription period ended ${t.activeUntil.toLocaleDateString()} (Stripe should renew or cancel it shortly).`
    : t.verificationStatus !== "approved"
    ? `Certification review isn't approved yet (status: "${t.verificationStatus}").`
    : t.identityStatus !== "verified"
    ? `Identity check isn't verified yet (status: "${t.identityStatus}"). See the Stripe Identity card below.`
    : paused
    ? "Vacation-paused. Resume it (from their own dashboard, or wait for it to auto-expire)."
    : "Not live for an unclear reason. Double-check every field below.";

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t.name}</h1>
          <p className="mt-1 text-sm text-stone2">{t.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/cuddlers/${t.slug}`} className="btn-ghost">View Public Ad</Link>
          <Link href="/admin/cuddlers" className="btn-ghost">Back to Accounts</Link>
        </div>
      </div>

      <div className="card mt-6 grid gap-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-stone2">Status</p>
          <p className="font-medium">
            {live ? <span className="text-spruce">● Live</span> : <span className="text-stone2">○ Not Live</span>}
            {suspended && <span className="ml-2 text-red-700">Suspended</span>}
            {paused && <span className="ml-2 text-gold">Paused</span>}
          </p>
          {notLiveReason && <p className="mt-1 text-xs text-stone2">{notLiveReason}</p>}
        </div>
        <div>
          <p className="text-xs text-stone2">Subscription</p>
          <p className="font-medium">
            {t.subStatus}
            {t.plan ? ` · ${t.plan}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone2">Certification Review</p>
          <p className="font-medium">
            {t.verificationStatus}
            {t.verificationStatus !== "approved" && (
              <Link href="/admin" className="ml-2 text-xs font-medium text-spruce hover:underline">
                Review Queue
              </Link>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone2">Member Since</p>
          <p className="font-medium">{t.createdAt.toLocaleDateString()}</p>
        </div>
      </div>

      <div className="card mt-3 flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
        <div>
          <p className="text-xs text-stone2">Stripe Identity Check (Government ID + Selfie)</p>
          <p className="font-medium">
            {t.identityStatus}
            {t.identityVerifiedAt && (
              <span className="ml-2 text-xs font-normal text-stone2">
                since {t.identityVerifiedAt.toLocaleDateString()}
              </span>
            )}
          </p>
          <p className="mt-1 max-w-md text-xs text-stone2">
            Normally automatic. If it&rsquo;s stuck for someone, you can manually mark it verified
            here. The license review above is still required separately before they go live.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {t.identityStatus !== "verified" ? (
            <form action={adminOverrideIdentity}>
              <input type="hidden" name="id" value={id} />
              <button className="btn-primary text-sm">Mark ID Verified</button>
            </form>
          ) : (
            <form action={adminResetIdentity}>
              <input type="hidden" name="id" value={id} />
              <button className="btn-ghost text-sm">Reset (Let Them Redo It)</button>
            </form>
          )}
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-xs text-stone2">
        Changes saved here go live immediately, same as if the cuddler made them directly. Login
        and subscription/billing aren&rsquo;t editable from here: login stays with Clerk and billing
        stays with Stripe. Photos can be uploaded, changed, removed, flagged, or cropped from the
        grid below.
      </p>

      <div className="card mt-6 p-5">
        <h2 className="font-display text-lg font-semibold">
          Reviews {reviews.length > 0 && <span className="text-stone2">({reviews.length})</span>}
        </h2>
        <p className="mt-1 text-xs text-stone2">
          Live reviews on this profile. Deleting one removes it permanently, so use this for fake,
          abusive, or otherwise problematic reviews that already made it through moderation.
        </p>
        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-stone2">No approved reviews yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {r.authorName} <span className="text-gold">{"★".repeat(r.rating)}</span>
                    </p>
                    <p className="mt-1 text-sm text-stone2">{r.body}</p>
                    <p className="mt-1 text-xs text-stone2">{r.createdAt.toLocaleDateString()}</p>
                  </div>
                  <form action={adminDeleteReview}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="cuddlerId" value={id} />
                    <input type="hidden" name="slug" value={t.slug} />
                    <button className="btn-ghost text-xs text-red-700 hover:border-red-700">Delete</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 grid gap-6">
        <ListingForm
          cuddler={safeCuddler}
          action={adminUpdateListing.bind(null, id)}
          flagPhotoAction={manualFlagPhoto}
          undoCropAction={undoCardCrop}
        />
        <HoursForm hours={hours} gatekeepHours={t.gatekeepHours} action={adminUpdateHours.bind(null, id)} />
      </div>
    </div>
  );
}
