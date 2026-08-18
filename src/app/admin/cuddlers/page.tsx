import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/adminAuth";
import { allCuddlers, searchCuddlers, suspendedCuddlers, suspendCuddler, unsuspendCuddler } from "../actions";

export const dynamic = "force-dynamic";

type CuddlerRow = {
  id: string;
  name: string;
  slug: string;
  email: string;
  subStatus: string;
  published: boolean;
  suspendedAt: Date | null;
  suspensionNote: string | null;
  referredBy?: string | null;
};

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "not_live", label: "Not Live" },
  { key: "suspended", label: "Suspended" },
] as const;

export default async function AdminCuddlersPage(
  props: {
    searchParams: Promise<{ q?: string; status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const q = searchParams.q ?? "";
  const statusFilter = searchParams.status ?? "all";
  const [results, suspended, accounts] = await Promise.all([
    q ? searchCuddlers(q) : Promise.resolve([]),
    suspendedCuddlers(),
    allCuddlers(),
  ]);

  const filteredAccounts = accounts.filter((t) => {
    if (statusFilter === "live") return t.live;
    if (statusFilter === "not_live") return !t.live && !t.suspended;
    if (statusFilter === "suspended") return t.suspended;
    return true;
  });

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Manage Cuddlers</h1>
        <Link href="/admin" className="btn-ghost">Back To Moderation</Link>
      </div>
      <p className="mt-1 text-sm text-stone2">
        See who&rsquo;s live or stuck mid-setup, open an account to fill in or fix their listing for
        them, or suspend an account for a Terms of Service violation.
      </p>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            All Accounts <span className="text-stone2">({filteredAccounts.length})</span>
          </h2>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/admin/cuddlers" : `/admin/cuddlers?status=${f.key}`}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  statusFilter === f.key ? "bg-spruce text-white" : "bg-porcelain text-stone2"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {filteredAccounts.length === 0 ? (
          <p className="mt-4 text-sm text-stone2">No accounts match this filter.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {filteredAccounts.map((t) => (
              <li key={t.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium text-ink">
                    {t.name}
                    {t.live ? (
                      <span className="ml-2 text-xs font-medium text-spruce">● Live</span>
                    ) : (
                      <span className="ml-2 text-xs font-medium text-stone2">○ Not Live</span>
                    )}
                    {t.suspended && <span className="ml-2 text-xs font-medium text-red-700">Suspended</span>}
                    {t.paused && <span className="ml-2 text-xs font-medium text-gold">Paused</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-stone2">
                    {t.email} · Plan: {t.subStatus} · ID Check: {t.identityStatus}
                    {" · "}Joined {t.createdAt.toLocaleDateString()}
                    {t.referredBy && <> · Referred By: {t.referredBy}</>}
                  </p>
                </div>
                <Link href={`/admin/cuddlers/${t.id}/edit`} className="btn-ghost text-sm">
                  Help Set Up / Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">
          Currently Suspended{" "}
          {suspended.length > 0 && <span className="text-stone2">({suspended.length})</span>}
        </h2>
        {suspended.length === 0 ? (
          <p className="mt-2 text-sm text-stone2">No suspended accounts right now.</p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {suspended.map((t) => (
              <CuddlerCard key={t.id} t={t} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Search</h2>
        <form className="mt-3 flex max-w-lg gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, or slug"
            className="field flex-1"
          />
          <button className="btn-primary">Search</button>
        </form>

        {q && results.length === 0 && <p className="mt-4 text-sm text-stone2">No matches for &ldquo;{q}&rdquo;.</p>}

        {results.length > 0 && (
          <ul className="mt-4 grid gap-4">
            {results.map((t) => (
              <CuddlerCard key={t.id} t={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CuddlerCard({ t }: { t: CuddlerRow }) {
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`/cuddlers/${t.slug}`} className="font-medium text-spruce hover:underline">
          {t.name}
        </Link>
        <span className="text-xs text-stone2">{t.email}</span>
      </div>
      <p className="mt-1 text-xs text-stone2">
        Plan status: {t.subStatus} · Published: {t.published ? "yes" : "no"}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Link href={`/admin/cuddlers/${t.id}/edit`} className="text-xs font-medium text-spruce hover:underline">
          Help Set Up / Edit
        </Link>
      </div>

      {t.suspendedAt ? (
        <div className="mt-3 rounded-lg bg-red-50 p-3">
          <p className="text-xs font-medium text-red-800">
            Suspended since {t.suspendedAt.toLocaleDateString()}
          </p>
          {t.suspensionNote && <p className="mt-1 text-xs text-red-800">{t.suspensionNote}</p>}
          <form action={unsuspendCuddler} className="mt-2">
            <input type="hidden" name="id" value={t.id} />
            <button className="btn-ghost text-sm">Lift Suspension</button>
          </form>
        </div>
      ) : (
        <form action={suspendCuddler} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={t.id} />
          <input
            type="text"
            name="note"
            placeholder="Reason (shown to cuddler)"
            className="field flex-1 text-sm"
          />
          <button className="btn-ghost text-sm text-red-700">Suspend Account</button>
        </form>
      )}
    </li>
  );
}
