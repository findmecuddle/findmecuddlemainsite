import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/adminAuth";
import CopyCaptionButton from "@/components/CopyCaptionButton";
import FlaggedContactSearch from "./FlaggedContactSearch";
import {
  pendingReviews,
  pendingReports,
  approveReview,
  denyReview,
  allReviews,
  adminDeleteReview,
  actionReport,
  dismissReport,
  pendingWebsiteReviews,
  approveWebsite,
  rejectWebsite,
  pendingFlaggedPhotos,
  dismissFlaggedPhoto,
  removeFlaggedPhoto,
  pendingSocialPosts,
  markSocialPosted,
  pendingPhotoshootRequests,
  markPhotoshootContacted,
  suspendCuddler,
  adminLogout,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const [
    reviewQueue,
    reportQueue,
    websiteQueue,
    photoQueue,
    socialQueue,
    photoshootQueue,
    allReviewsList,
  ] = await Promise.all([
    pendingReviews(),
    pendingReports(),
    pendingWebsiteReviews(),
    pendingFlaggedPhotos(),
    pendingSocialPosts(),
    pendingPhotoshootRequests(),
    allReviews(),
  ]);

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Moderation</h1>
          <p className="mt-1 text-sm text-stone2">Signed in as {admin.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/cuddlers" className="btn-ghost">Manage Cuddlers</Link>
          <Link href="/admin/activity" className="btn-ghost">Activity Log</Link>
          <Link href="/admin/subscribers" className="btn-ghost">Subscribers</Link>
          <Link href="/admin/referrals" className="btn-ghost">Referrals</Link>
          {admin.role === "super" && <Link href="/admin/team" className="btn-ghost">Team</Link>}
          <form action={adminLogout}><button className="btn-ghost">Log Out</button></form>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">
          Flagged Photos{" "}
          {photoQueue.length > 0 && <span className="text-stone2">({photoQueue.length})</span>}
        </h2>
        <p className="mt-1 text-xs text-stone2">
          Photos you've flagged yourself while reviewing a listing (see the photo grid on each account's Edit
          page). The photo is already live on the site either way; flagging it here just puts it in this queue
          for a follow-up decision. Dismiss if it's fine after all, Remove Photo if it's not, or Crop to trim it
          instead of removing it entirely.
        </p>
        {photoQueue.length === 0 ? (
          <p className="mt-3 text-sm text-stone2">Nothing flagged.</p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photoQueue.map((p) => {
              const manualNote = p.flagReason?.startsWith("manual:") ? p.flagReason.slice("manual:".length).trim() : null;
              return (
                <li key={p.id} className="card overflow-hidden p-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photoUrl} alt="" className="aspect-square w-full object-cover" />
                  <div className="p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/cuddlers/${p.cuddlerSlug}`} className="font-medium text-spruce hover:underline">
                        {p.employeeName ?? p.cuddlerName}
                      </Link>
                      <span className="text-xs text-stone2">Flagged</span>
                    </div>
                    {p.employeeName && (
                      <p className="mt-0.5 text-xs text-stone2">Team member of {p.cuddlerName}</p>
                    )}
                    {manualNote && <p className="mt-1 text-xs italic text-stone2">"{manualNote}"</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <form action={dismissFlaggedPhoto}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-ghost text-xs">Dismiss</button>
                      </form>
                      {/* Crop only applies to the main profile photo (slot 1) — see cardPhotoUrl in
                          schema.ts. Other slots and agency employee photos don't appear on cards, so
                          there's nothing for a crop to fix. */}
                      {!p.employeeId && p.slot === 1 && (
                        <Link href={`/admin/crop-photo?flagId=${p.id}&cuddlerId=${p.cuddlerId}`} className="btn-ghost text-xs">
                          Crop
                        </Link>
                      )}
                      <form action={removeFlaggedPhoto}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="btn-ghost text-xs text-red-700">Remove Photo</button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          Pending Website Links{" "}
          {websiteQueue.length > 0 && <span className="text-stone2">({websiteQueue.length})</span>}
        </h2>
        <p className="mt-1 text-xs text-stone2">
          Click through before approving: check it's actually the cuddler's own site and not a scam,
          malware, or something unrelated. We're not responsible for a link once it's live, but we don't want to
          have shown it in the first place.
        </p>
        {websiteQueue.length === 0 ? (
          <p className="mt-3 text-sm text-stone2">Nothing waiting.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {websiteQueue.map((w) => (
              <li key={w.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/cuddlers/${w.slug}`} className="font-medium text-spruce hover:underline">
                    {w.name}
                  </Link>
                  <span className="text-xs text-stone2">{w.email}</span>
                </div>
                <a
                  href={w.websiteUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-block break-all text-sm text-spruce hover:underline"
                >
                  {w.websiteUrl}
                </a>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <form action={approveWebsite}>
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="slug" value={w.slug} />
                    <button className="btn-primary">Approve</button>
                  </form>
                  <form action={rejectWebsite} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="id" value={w.id} />
                    <input type="hidden" name="slug" value={w.slug} />
                    <input
                      type="text"
                      name="note"
                      placeholder="Rejection reason (shown to cuddler)"
                      className="field flex-1 text-sm"
                    />
                    <button className="btn-ghost">Reject</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          Ready To Post{" "}
          {socialQueue.length > 0 && <span className="text-stone2">({socialQueue.length})</span>}
        </h2>
        <p className="mt-1 text-xs text-stone2">
          Newly-live listings that opted into social marketing. Nothing posts automatically: copy the caption,
          save the photo, and post it yourself to X, Facebook, or anywhere else, then mark it done.
        </p>
        {socialQueue.length === 0 ? (
          <p className="mt-3 text-sm text-stone2">Nothing waiting.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {socialQueue.map((s) => (
              <li key={s.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/cuddlers/${s.slug}`} className="font-medium text-spruce hover:underline">
                    {s.name}
                  </Link>
                  <span className="text-xs text-stone2">{s.city}, {s.state}</span>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.photoUrl}
                    alt={s.name}
                    className="h-32 w-32 shrink-0 rounded-lg border border-line object-cover"
                  />
                  <pre className="flex-1 whitespace-pre-wrap rounded-lg bg-porcelain p-3 font-sans text-sm">
                    {s.caption}
                  </pre>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <CopyCaptionButton caption={s.caption} />
                  <form action={markSocialPosted}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-primary">Mark As Posted</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Temporarily disabled — VIP photoshoot perk is paused for now, planned to come back later.
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          VIP photoshoot requests{" "}
          {photoshootQueue.length > 0 && <span className="text-stone2">({photoshootQueue.length})</span>}
        </h2>
        {photoshootQueue.length === 0 ? (
          <p className="mt-3 text-sm text-stone2">Nothing waiting.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {photoshootQueue.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <Link href={`/cuddlers/${p.slug}`} className="font-medium text-spruce hover:underline">
                    {p.name}
                  </Link>
                  <p className="mt-1 text-xs text-stone2">
                    {p.contactEmail || p.email}
                    {p.phone && ` · ${p.phone}`} · requested {p.photoshootRequestedAt?.toLocaleDateString()}
                  </p>
                </div>
                <form action={markPhotoshootContacted}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn-ghost">Mark contacted</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      */}

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          Pending Reviews {reviewQueue.length > 0 && <span className="text-stone2">({reviewQueue.length})</span>}
        </h2>
        {reviewQueue.length === 0 ? (
          <p className="mt-3 text-sm text-stone2">Nothing waiting.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {reviewQueue.map((r) => (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Link href={`/cuddlers/${r.cuddlerSlug}`} className="font-medium text-spruce hover:underline">
                      {r.cuddlerName}
                    </Link>
                    {!r.verifiedContact && (
                      <span
                        className="badge-pill border border-amber-300 bg-amber-50 text-amber-800"
                        title="This reviewer's phone/email doesn't match any inquiry on file for this cuddler."
                      >
                        Unverified
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-stone2">{r.createdAt.toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-medium">{r.authorName}</span>{" "}
                  <span className="text-gold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  {r.authorEmail && <span className="text-stone2"> · {r.authorEmail}</span>}
                  {r.authorPhone && <span className="text-stone2"> · {r.authorPhone}</span>}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-ink/90">{r.body}</p>
                <div className="mt-4 flex gap-2">
                  <form action={approveReview}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="slug" value={r.cuddlerSlug} />
                    <button className="btn-primary">Approve</button>
                  </form>
                  <form action={denyReview}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn-ghost">Deny</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          Pending Reports {reportQueue.length > 0 && <span className="text-stone2">({reportQueue.length})</span>}
        </h2>
        {reportQueue.length === 0 ? (
          <p className="mt-3 text-sm text-stone2">Nothing waiting.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {reportQueue.map((r) => {
              // Keep original slot indexes (1/2/3) — the admin-only serving route needs to know
              // which column to fetch from the private bucket, not just which URLs are non-null.
              const slots: [number, string | null][] = [
                [1, r.photoUrl1],
                [2, r.photoUrl2],
                [3, r.photoUrl3],
              ];
              const photoIndexes = slots.filter(([, key]) => !!key).map(([i]) => i);
              return (
                <li key={r.id} className="card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/cuddlers/${r.cuddlerSlug}`} className="font-medium text-spruce hover:underline">
                      {r.cuddlerName}
                    </Link>
                    <span className="text-xs text-stone2">{r.createdAt.toLocaleString()}</span>
                  </div>
                  {r.reporterEmail && <p className="mt-1 text-xs text-stone2">Reporter: {r.reporterEmail}</p>}
                  <p className="mt-2 whitespace-pre-line text-sm text-ink/90">{r.body}</p>
                  {photoIndexes.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {photoIndexes.map((i) => {
                        const src = `/api/admin/report-evidence?reportId=${r.id}&index=${i}`;
                        return (
                          <a key={i} href={src} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden rounded-lg border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="Evidence" className="h-full w-full object-cover" />
                          </a>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={actionReport}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn-primary">Mark Actioned</button>
                    </form>
                    <form action={dismissReport}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn-ghost">Dismiss</button>
                    </form>
                    <form action={suspendCuddler}>
                      <input type="hidden" name="id" value={r.cuddlerId} />
                      <input type="hidden" name="note" value={`Suspended following a client report: ${r.body.slice(0, 200)}`} />
                      <button className="btn-ghost text-red-700">Suspend Account</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Customer Contact Reports</h2>
        <p className="mt-1 text-xs text-stone2">
          Look up a client's phone number or email to see every report a cuddler has filed against it
          site-wide, including who filed it. A regular cuddler only ever sees the aggregate count.
        </p>
        <FlaggedContactSearch />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          All Reviews {allReviewsList.length > 0 && <span className="text-stone2">({allReviewsList.length})</span>}
        </h2>
        <p className="mt-1 text-xs text-stone2">
          Every review ever submitted, any status, not just the pending queue above. A review that already
          went live can still need to come down later.
        </p>
        {allReviewsList.length === 0 ? (
          <p className="mt-3 text-sm text-stone2">No reviews yet.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {allReviewsList.map((r) => {
              const statusStyle =
                r.status === "approved"
                  ? "text-spruce"
                  : r.status === "denied"
                  ? "text-red-700"
                  : "text-gold";
              return (
                <li key={r.id} className="card p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Link href={`/cuddlers/${r.cuddlerSlug}`} className="font-medium text-spruce hover:underline">
                        {r.cuddlerName}
                      </Link>
                      {!r.verifiedContact && (
                        <span
                          className="badge-pill border border-amber-300 bg-amber-50 text-amber-800"
                          title="This reviewer's phone/email doesn't match any inquiry on file for this cuddler."
                        >
                          Unverified
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-stone2">
                      <span className={`font-medium capitalize ${statusStyle}`}>{r.status}</span>
                      {r.createdAt.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">{r.authorName}</span>{" "}
                    <span className="text-gold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    {r.authorEmail && <span className="text-stone2"> · {r.authorEmail}</span>}
                    {r.authorPhone && <span className="text-stone2"> · {r.authorPhone}</span>}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink/90">{r.body}</p>
                  <form action={adminDeleteReview} className="mt-3">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="cuddlerId" value={r.cuddlerId} />
                    <input type="hidden" name="slug" value={r.cuddlerSlug} />
                    <button className="text-xs text-red-700 hover:underline">Delete This Review</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
