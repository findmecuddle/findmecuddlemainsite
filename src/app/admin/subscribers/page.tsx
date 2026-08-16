import { redirect } from "next/navigation";
import Link from "next/link";
import { currentAdmin } from "@/lib/adminAuth";
import { allNewsletterSubscribers } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminSubscribersPage() {
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");

  const subscribers = await allNewsletterSubscribers();

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            Newsletter Subscribers{" "}
            {subscribers.length > 0 && <span className="text-stone2">({subscribers.length})</span>}
          </h1>
          <p className="mt-1 text-sm text-stone2">
            Everyone who signed up for "New Cuddlers Near You" alerts. The weekly digest email
            (scripts/send-newsletter.ts) is what actually notifies them — this is just the list.
          </p>
        </div>
        <Link href="/admin" className="btn-ghost">Back To Moderation</Link>
      </div>

      {subscribers.length === 0 ? (
        <p className="mt-8 text-sm text-stone2">No subscribers yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-stone2">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Location</th>
                <th className="py-2 pr-4 font-medium">Signed Up</th>
                <th className="py-2 pr-4 font-medium">Last Notified</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-line/60">
                  <td className="py-2 pr-4">{s.name}</td>
                  <td className="py-2 pr-4">{s.email}</td>
                  <td className="py-2 pr-4 text-stone2">{s.city}, {s.state}</td>
                  <td className="py-2 pr-4 text-stone2 whitespace-nowrap">
                    {s.consentAt ? s.consentAt.toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 pr-4 text-stone2 whitespace-nowrap">
                    {s.lastNotifiedAt ? s.lastNotifiedAt.toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
