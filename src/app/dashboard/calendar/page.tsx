import { redirect } from "next/navigation";
import Link from "next/link";
import { currentCuddler, currentClerkUserId } from "@/lib/auth";
import { listAppointments } from "@/app/actions";
import CalendarView from "./CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const userId = await currentClerkUserId();
  if (!userId) redirect("/login");
  const me = await currentCuddler();
  if (!me) redirect("/onboarding");

  const appointments = await listAppointments(me.id);

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">My Calendar</h1>
          <p className="mt-1 text-sm text-stone2">
            A personal organizer for appointments you've agreed to — not shown to clients, and doesn't affect
            your Hours or Available Now status.
          </p>
        </div>
        <Link href="/dashboard" className="btn-ghost">Back To Dashboard</Link>
      </div>

      <div className="mt-6">
        <CalendarView appointments={appointments} />
      </div>
    </div>
  );
}
