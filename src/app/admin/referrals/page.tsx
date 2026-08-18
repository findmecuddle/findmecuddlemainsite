import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/adminAuth";
import { referralSummary } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");

  const groups = await referralSummary();

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            Referrals{" "}
            {groups.length > 0 && <span className="text-stone2">({groups.length})</span>}
          </h1>
          <p className="mt-1 text-sm text-stone2">
            Grouped by the "Referred By" name entered at signup (editable per-account). "Paying"
            counts cuddlers with an active subscription right now — useful for figuring out each
            referrer's monthly percentage.
          </p>
        </div>
        <Link href="/admin" className="btn-ghost">Back To Moderation</Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-stone2">No referrals recorded yet.</p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {groups.map((g) => (
            <li key={g.label.toLowerCase()} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-lg font-semibold">{g.label}</p>
                <p className="text-sm text-stone2">
                  {g.payingCount} paying / {g.referred.length} total
                </p>
              </div>
              <ul className="mt-3 grid gap-1">
                {g.referred.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <Link href={`/admin/cuddlers/${r.id}/edit`} className="text-spruce hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-xs text-stone2">
                      {r.subStatus === "active" ? (
                        <span className="font-medium text-spruce">Paying</span>
                      ) : (
                        <span>{r.subStatus}</span>
                      )}
                      {" · Joined "}
                      {r.createdAt.toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
