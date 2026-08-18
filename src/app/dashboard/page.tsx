import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { currentCuddler, currentClerkUserId, toClientSafeCuddler } from "@/lib/auth";
import { recentLedger, getHours, listEmployees, listInquiries, listMyReports } from "@/app/actions";
import {
  creditPacks,
  PLANS,
  AGENCY_PLAN_KEYS,
  PLAN_BUTTON_LABELS,
  BOOST_COOLDOWN_HOURS,
  VACATION_PAUSE_DAYS,
  MANUAL_OPEN_NOW_HOURS,
} from "@/lib/config";
import { isLive, isVip, isPaused, isSuspended, isAgencyAccount, agencyEmployeeLimit } from "@/lib/stripe";
import { pauseListing, resumeListing, togglePublished } from "@/app/actions";
import ListingForm from "./ListingForm";
import HoursForm from "./HoursForm";
import BoostButton from "./BoostButton";
import CountdownClock from "./CountdownClock";
import IdentityVerification from "./IdentityVerification";
import ChangePasswordForm from "./ChangePasswordForm";
import CancelSubscriptionForm from "./CancelSubscriptionForm";
import DeleteAccountForm from "./DeleteAccountForm";
import CheckoutRefresh from "./CheckoutRefresh";
import TeamManager from "./TeamManager";
import OpenNowButton from "./OpenNowButton";
import MessagesCard from "./MessagesCard";
import SetupWizard from "./SetupWizard";
// Temporarily disabled — VIP photoshoot perk is paused for now, planned to come back later.
// import PhotoshootCard from "./PhotoshootCard";

export const dynamic = "force-dynamic";

/** Pill-button tab link — active tab is driven by the `?tab=` search param (see DashboardPage
 *  below) rather than client state, so the URL stays shareable/bookmarkable and no client
 *  component is needed just to switch sections. */
function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-spruce bg-spruce text-white"
          : "border-line bg-white text-stone2 hover:border-spruce/40 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function DashboardPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const userId = await currentClerkUserId();
  if (!userId) redirect("/login");
  const me = await currentCuddler();
  if (!me) redirect("/onboarding");

  const { tab } = await props.searchParams;
  const activeTab = tab === "messages" ? "messages" : tab === "privacy" ? "privacy" : "dashboard";

  const live = isLive(me);
  const suspended = isSuspended(me);
  const paused = isPaused(me);
  const pauseResumesAt = me.pausedAt ? new Date(me.pausedAt.getTime() + VACATION_PAUSE_DAYS * 86_400_000) : null;
  const packs = creditPacks();
  const recent = await recentLedger(me.id);
  const hours = await getHours(me.id);
  const agency = isAgencyAccount(me);
  const employees = agency ? await listEmployees(me.id) : [];
  const inquiries = await listInquiries(me.id);
  const myReports = await listMyReports();
  // Solo accounts only ever see Weekly/Monthly/VIP; agency accounts only ever see Small/Large Agency —
  // accountType is fixed at signup (see OnboardingForm.tsx), so there's no case where both sets
  // should show at once.
  const availablePlans = PLANS.filter((p) => AGENCY_PLAN_KEYS.includes(p.key) === agency);

  const planLabel = PLANS.find((p) => p.key === me.plan)?.label ?? me.plan;
  // Never pass `me` itself into a "use client" component below — it's the full database row
  // (password hash, Stripe IDs, private storage keys included). This stripped copy is what
  // actually gets serialized into the browser. See lib/auth.ts for the field list.
  const safeCuddler = toClientSafeCuddler(me);
  const unreadCount = inquiries.filter((i) => !i.readAt).length;

  // A cuddler who hasn't finished the guided setup wizard yet (see the setupCompletedAt comment
  // in schema.ts) sees that instead of the normal dashboard below — checking wentLiveAt too means
  // every account that was already live before this feature existed skips the wizard automatically,
  // no backfill needed, since going live already implies setup was finished.
  if (!me.setupCompletedAt && !me.wentLiveAt) {
    return (
      <SetupWizard
        cuddler={safeCuddler}
        agency={agency}
        employees={employees}
        employeeLimit={agencyEmployeeLimit(me)}
        hours={hours}
        // PLANS entries include a priceId() function (see lib/config.ts) — functions can't be
        // serialized across the server/client boundary, so this strips down to plain key/label
        // data before crossing into the "use client" SetupWizard. This is what actually broke
        // production last deploy ("Functions cannot be passed directly to Client Components").
        availablePlans={availablePlans.map((p) => ({ key: p.key, label: p.label }))}
      />
    );
  }

  return (
    <div className="container-page py-10">
      <CheckoutRefresh />
      <div className="card flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">Your Listing</h1>
          <p className="mt-3 text-sm text-stone2">{me.email}</p>
          <p className="mt-1 text-xs text-stone2">
            Listing ID: <span className="font-medium text-ink">FMM-{String(me.memberNumber).padStart(6, "0")}</span>
            {" · "}Member Since {me.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {live && (
            <a href={`/cuddlers/${me.slug}`} className="btn-ghost">View Public Ad</a>
          )}
          <SignOutButton><button className="btn-ghost">Log Out</button></SignOutButton>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <TabLink href="/dashboard" active={activeTab === "dashboard"}>Dashboard</TabLink>
        <TabLink href="/dashboard?tab=messages" active={activeTab === "messages"}>
          Inbox
          {unreadCount > 0 && (
            <span
              className={`badge-pill ml-1.5 ${
                activeTab === "messages" ? "bg-white text-spruce" : "bg-spruce text-white"
              }`}
            >
              {unreadCount}
            </span>
          )}
        </TabLink>
        <TabLink href="/dashboard?tab=privacy" active={activeTab === "privacy"}>Privacy</TabLink>
        <TabLink href="/dashboard/calendar" active={false}>My Calendar</TabLink>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,360px]">
        {/* Left: tab content */}
        <div className="grid h-fit gap-6">
          {activeTab === "dashboard" && (
            <>
              <IdentityVerification cuddler={safeCuddler} />
              <ListingForm cuddler={safeCuddler} />
              {agency && <TeamManager employees={employees} employeeLimit={agencyEmployeeLimit(me)} />}
              <HoursForm hours={hours} gatekeepHours={me.gatekeepHours} />
            </>
          )}
          {activeTab === "messages" && <MessagesCard inquiries={inquiries} myReports={myReports} />}
          {activeTab === "privacy" && (
            <>
              <ChangePasswordForm />
              <DeleteAccountForm />
            </>
          )}
        </div>

        {/* Right: status, subscription, boosts */}
        <div className="grid h-fit gap-6">
          <section className="card p-6">
            <h2 className="font-display text-lg font-semibold">Status</h2>
            <p className="mt-2 text-sm">
              {live ? (
                <span className="font-medium text-spruce">● Live</span>
              ) : (
                <span className="font-medium text-stone2">○ Not Visible In Search</span>
              )}
            </p>
            {suspended && (
              <div className="mt-3 rounded-lg bg-red-50 p-3">
                <p className="text-xs font-medium text-red-800">
                  Your account has been suspended for a Terms of Service violation.
                </p>
                {me.suspensionNote && <p className="mt-1 text-xs text-red-800">{me.suspensionNote}</p>}
                <p className="mt-1 text-xs text-red-800">
                  Your listing is hidden from search until this is resolved. Contact support if you believe
                  this was a mistake.
                </p>
              </div>
            )}
            {!live && !suspended && (
              <p className="mt-1 text-xs text-stone2">
                {me.subStatus !== "active"
                  ? "Choose A Listing Plan Below To Go Live."
                  : me.identityStatus !== "verified"
                  ? "Complete The Quick Identity Check Below: Your Listing Can't Go Live Until It's Verified."
                  : paused
                  ? `Your Listing Is Paused For Vacation Until ${pauseResumesAt?.toLocaleDateString()}. Resume Anytime Below.`
                  : "Click “Publish My Ad” Below To Go Live."}
              </p>
            )}
            {me.activeUntil && (
              <p className="mt-2 text-xs text-stone2">
                Paid Through {me.activeUntil.toLocaleDateString()} ({planLabel})
              </p>
            )}

            {me.subStatus === "active" &&
              me.identityStatus === "verified" &&
              !suspended &&
              !paused && (
              <form action={togglePublished} className="mt-3 border-t border-line pt-3">
                <button className={me.published ? "btn-ghost w-full text-sm" : "btn-primary w-full text-sm"}>
                  {me.published ? "Unpublish My Ad" : "Publish My Ad"}
                </button>
              </form>
            )}

            <div className="mt-3 border-t border-line pt-3">
              <p className="text-sm font-medium text-ink">Available Now</p>
              <p className="mt-1 text-xs text-stone2">
                For cuddlers without hours set above, or reachable right now outside them. Turning this on
                shows you as open for the next {MANUAL_OPEN_NOW_HOURS} hours, then automatically turns back off.
              </p>
              <OpenNowButton openNowActivatedAt={me.openNowActivatedAt?.toISOString() ?? null} live={live} />
            </div>

            {me.subStatus === "active" &&
              me.identityStatus === "verified" && (
              <div className="mt-3 border-t border-line pt-3">
                {paused ? (
                  <>
                    <p className="text-xs text-stone2">
                      Paused since {me.pausedAt?.toLocaleDateString()}. Billing is paused too, you won't be
                      charged while away. Automatically goes live again on{" "}
                      <span className="font-medium text-ink">{pauseResumesAt?.toLocaleDateString()}</span>, or
                      resume early anytime below.
                    </p>
                    <form action={resumeListing} className="mt-2">
                      <button className="btn-primary w-full text-sm">Resume My Listing Now</button>
                    </form>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-stone2">
                      Going away for a while? Pause your listing for up to {VACATION_PAUSE_DAYS} days, it's
                      hidden from search and billing pauses too. It automatically goes live again after{" "}
                      {VACATION_PAUSE_DAYS} days, or you can resume early anytime.
                    </p>
                    <form action={pauseListing} className="mt-2">
                      <button className="btn-ghost w-full text-sm">Pause My Listing (Vacation)</button>
                    </form>
                  </>
                )}
              </div>
            )}
          </section>

          <section id="listing-plan" className="card p-6">
            <h2 className="font-display text-lg font-semibold">{agency ? "Agency Plan" : "Listing Plan"}</h2>
            {me.subStatus === "active" ? (
              <>
                <p className="mt-2 text-sm">
                  You're subscribed to <span className="font-semibold text-spruce">{planLabel}</span>
                  {isVip(me) && (
                    <span className="ml-2 rounded-full bg-spruce-tint px-2 py-0.5 text-[11px] font-medium text-spruce">
                      VIP Perks Active
                    </span>
                  )}
                </p>
                {me.activeUntil && (
                  <p className="mt-1 text-xs text-stone2">
                    <CountdownClock until={me.activeUntil.toISOString()} className="font-medium text-ink" /> until
                    renewal
                  </p>
                )}
                <form action="/api/billing-portal" method="POST" className="mt-3">
                  <button className="btn-ghost w-full">Manage Subscription</button>
                </form>

                {availablePlans.some((p) => p.key !== me.plan) && (
                  <form action="/api/checkout" method="POST" className="mt-3 grid gap-2 border-t border-line pt-3">
                    <input type="hidden" name="type" value="plan" />
                    <label className="text-xs font-medium text-stone2">Switch Plan</label>
                    <select
                      name="plan"
                      className="field"
                      defaultValue={availablePlans.find((p) => p.key !== me.plan)?.key}
                    >
                      {availablePlans
                        .filter((p) => p.key !== me.plan)
                        .map((p) => (
                          <option key={p.key} value={p.key}>{PLAN_BUTTON_LABELS[p.key]}</option>
                        ))}
                    </select>
                    <button className="btn-ghost w-full text-sm">Switch Plan</button>
                    <p className="text-xs text-stone2">
                      Charges or credits the prorated difference right away, no need to cancel first.
                    </p>
                  </form>
                )}
              </>
            ) : (
              <form action="/api/checkout" method="POST" className="mt-3 grid gap-2">
                <input type="hidden" name="type" value="plan" />
                <select
                  name="plan"
                  className="field"
                  defaultValue={availablePlans.some((p) => p.key === "standard") ? "standard" : availablePlans[0]?.key}
                >
                  {availablePlans.map((p) => (
                    <option key={p.key} value={p.key}>{PLAN_BUTTON_LABELS[p.key]}</option>
                  ))}
                </select>
                <button className="btn-primary w-full">Subscribe</button>
                <p className="text-xs text-stone2">Prices shown at Stripe checkout. Cancel anytime.</p>
              </form>
            )}
          </section>

          <section className="card border-l-[3px] border-l-gold p-6">
            <h2 className="font-display text-lg font-semibold">Boosts</h2>
            <p className="mt-1 text-xs text-stone2">
              Boosts push your ad to the top of the search list for {BOOST_COOLDOWN_HOURS} Hours.
            </p>
            <p className="mt-2 text-sm">
              <span className="font-display text-3xl font-semibold">{me.credits}</span>{" "}
              <span className="text-stone2">credit{me.credits === 1 ? "" : "s"} available</span>
            </p>
            <BoostButton
              credits={me.credits}
              boostedAt={me.boostedAt?.toISOString() ?? null}
              boostMessage={me.boostMessage}
              live={live}
            />
            <div className="mt-4 grid gap-2 border-t border-line pt-4">
              {packs.length === 0 && (
                <p className="text-xs text-stone2">Credit packs aren’t configured yet (STRIPE_CREDIT_PACKS).</p>
              )}
              {packs.map((pack) => (
                <form key={pack.priceId} action="/api/checkout" method="POST">
                  <input type="hidden" name="type" value="credits" />
                  <input type="hidden" name="priceId" value={pack.priceId} />
                  <button className="btn-ghost w-full">Buy {pack.credits} Boost Credits</button>
                </form>
              ))}
            </div>
            {recent.length > 0 && (
              <ul className="mt-4 grid gap-1 border-t border-line pt-4 text-xs text-stone2">
                {recent.map((e) => (
                  <li key={e.id} className="flex justify-between">
                    <span>
                      {e.reason === "boost"
                        ? "Boost used"
                        : e.reason.startsWith("grant:")
                        ? `+${e.delta} VIP monthly bonus`
                        : `+${e.delta} credits purchased`}
                    </span>
                    <span>{e.createdAt.toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Temporarily disabled — VIP photoshoot perk is paused for now, planned to come back later.
          {isVip(me) && (
            <PhotoshootCard requestedAt={me.photoshootRequestedAt?.toISOString() ?? null} />
          )} */}

          {(me.subStatus === "active" || me.cancelRequestedAt) && (
            <CancelSubscriptionForm
              cancelRequestedAt={me.cancelRequestedAt?.toISOString() ?? null}
              activeUntil={me.activeUntil?.toISOString() ?? null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
