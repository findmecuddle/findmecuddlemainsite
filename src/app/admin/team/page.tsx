import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/adminAuth";
import { listAdmins, removeAdmin } from "../actions";
import AddAdminForm from "./AddAdminForm";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");
  if (me.role !== "super") redirect("/admin");

  const team = await listAdmins();

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Team</h1>
        <Link href="/admin" className="btn-ghost">Back To Moderation</Link>
      </div>

      <div className="mt-8 grid gap-6">
        <AddAdminForm />

        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold">Everyone with admin access</h2>
          <ul className="mt-4 grid gap-3">
            {team.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
                <div>
                  <p className="text-sm font-medium">
                    {a.name}{" "}
                    {a.role === "super" && (
                      <span className="ml-1 rounded-full bg-spruce-tint px-2 py-0.5 text-[11px] font-medium text-spruce">Super admin</span>
                    )}
                    {a.id === me.id && <span className="ml-1 text-xs text-stone2">(you)</span>}
                  </p>
                  <p className="text-xs text-stone2">{a.email} · added {a.createdAt.toLocaleDateString()}</p>
                </div>
                {a.id !== me.id && (
                  <form action={removeAdmin}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn-ghost text-red-700">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
