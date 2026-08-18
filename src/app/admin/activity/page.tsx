import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/adminAuth";
import { recentActivity, recentSystemEvents } from "../actions";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  approve_review: "Approved a review",
  deny_review: "Denied a review",
  delete_review: "Deleted a review",
  action_report: "Marked a report actioned",
  dismiss_report: "Dismissed a report",
  approve_verification: "Approved identity verification",
  reject_verification: "Rejected identity verification",
  mark_photoshoot_contacted: "Marked a photoshoot request contacted",
  create_admin: "Added a team member",
  remove_admin: "Removed a team member",
  admin_edit_listing: "Edited a cuddler's listing",
  admin_edit_hours: "Edited a cuddler's hours",
  admin_edit_referred_by: "Edited a cuddler's referral source",
  override_identity_verified: "Manually verified identity check",
  reset_identity_verification: "Reset identity check",
};

const SYSTEM_EVENT_LABELS: Record<string, string> = {
  signup: "Signed up",
  go_live: "Listing went live",
  cancel_requested: "Requested to cancel their subscription",
};

// Two separate log tables — admin_audit_log (moderation actions taken by an admin) and
// system_events (things that happened on their own: a cuddler signing up, a listing going
// live) — merged here by timestamp so there's one combined feed to scan instead of two pages.
type Entry =
  | { kind: "admin"; id: string; who: string; label: string; detail: string | null; createdAt: Date }
  | { kind: "system"; id: string; who: string; label: string; detail: string | null; createdAt: Date };

export default async function AdminActivityPage() {
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");

  const [adminLog, systemLog] = await Promise.all([recentActivity(200), recentSystemEvents(200)]);

  const entries: Entry[] = [
    ...adminLog.map((e): Entry => ({
      kind: "admin",
      id: e.id,
      who: e.adminName,
      label: ACTION_LABELS[e.action] ?? e.action,
      detail: e.detail,
      createdAt: e.createdAt,
    })),
    ...systemLog.map((e): Entry => ({
      kind: "system",
      id: e.id,
      who: e.cuddlerName,
      label: SYSTEM_EVENT_LABELS[e.type] ?? e.type,
      detail: e.detail,
      createdAt: e.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 200);

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Activity Log</h1>
        <Link href="/admin" className="btn-ghost">Back To Moderation</Link>
      </div>
      <p className="mt-1 text-sm text-stone2">
        Admin moderation actions plus signups and listings going live, most recent first.
      </p>

      {entries.length === 0 ? (
        <p className="mt-8 text-sm text-stone2">Nothing logged yet.</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {entries.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`} className="card flex flex-wrap items-baseline justify-between gap-2 p-4 text-sm">
              <span>
                {entry.kind === "system" && (
                  <span className="mr-2 rounded-full bg-spruce-tint px-2 py-0.5 text-[11px] font-medium text-spruce">
                    New
                  </span>
                )}
                <span className="font-medium text-ink">{entry.who}</span>{" "}
                <span className="text-stone2">{entry.label}</span>
                {entry.detail && <span className="text-stone2">: {entry.detail}</span>}
              </span>
              <span className="whitespace-nowrap text-xs text-stone2">
                {entry.createdAt.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
