"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import {
  markInquiryRead,
  deleteInquiries,
  reportContact,
  deleteMyReport,
  acceptInquiryAsAppointment,
  denyInquiry,
  resetInquiryStatus,
  updateAppointment,
  type listInquiries,
  type listMyReports,
  type listAppointments,
} from "@/app/actions";
import { REPORT_REASONS, FLAG_REASON_MAX_CHARS, SUPPORT_EMAIL } from "@/lib/config";

type Inquiry = Awaited<ReturnType<typeof listInquiries>>[number];
type MyReport = Awaited<ReturnType<typeof listMyReports>>[number];
type Appointment = Awaited<ReturnType<typeof listAppointments>>[number];

function formatTime12(hm: string | null): string | null {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Rough length in minutes for a DURATION_OPTIONS value (see lib/config.ts: "30 min", "1
 *  hour"..."23 hours", "Overnight") — only used for conflict-checking below, so an unknown/empty
 *  duration falls back to a conservative 1 hour rather than 0 (a 0-length block could never
 *  conflict with anything, which would silently hide a real double-booking). */
function durationToMinutes(d: string | null): number {
  if (!d) return 60;
  if (d === "Overnight") return 720;
  const min = /^(\d+)\s*min$/.exec(d);
  if (min) return parseInt(min[1], 10);
  const hrs = /^(\d+)\s*hours?$/.exec(d);
  if (hrs) return parseInt(hrs[1], 10) * 60;
  return 60;
}

function timeToMinutes(hm: string | null): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Every existing appointment on `date` that overlaps [time, time + duration) — used to warn a
 *  cuddler, before they accept, that they're already booked then. If no specific time was
 *  requested (flexible "Whenever open"), or an existing appointment has no time set either, it
 *  can't be ruled out as a conflict, so it's included as a heads-up rather than silently skipped. */
function findConflicts(
  date: string | null,
  time: string | null,
  duration: string | null,
  appointments: Appointment[]
): Appointment[] {
  if (!date) return [];
  const dayAppts = appointments.filter((a) => a.date === date);
  if (dayAppts.length === 0) return [];
  const startMin = timeToMinutes(time);
  if (startMin == null) return dayAppts;
  const endMin = startMin + durationToMinutes(duration);
  return dayAppts.filter((a) => {
    const aStart = timeToMinutes(a.time);
    if (aStart == null) return true;
    const aEnd = aStart + durationToMinutes(a.duration);
    return startMin < aEnd && aStart < endMin;
  });
}

const LOCATION_LABEL: Record<string, string> = {
  incall: "In-Studio",
  outcall: "Outcall",
};

const SEVERITY_STYLE: Record<"yellow" | "red", string> = {
  yellow: "font-medium text-amber-700",
  red: "font-medium text-red-700",
};

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "denied", label: "Denied" },
] as const;
type StatusTab = (typeof STATUS_TABS)[number]["key"];

export default function MessagesCard({
  inquiries,
  myReports,
  appointments,
}: {
  inquiries: Inquiry[];
  myReports: MyReport[];
  appointments: Appointment[];
}) {
  const unreadCount = inquiries.filter((i) => !i.readAt).length;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<StatusTab>("pending");

  // Most recent appointment per source inquiry (there's normally only ever one, but "most
  // recent" is a harmless tiebreaker if a message was ever accepted more than once) — lets an
  // Accepted row show/edit its scheduled time without leaving the inbox for the calendar.
  const appointmentByInquiryId = new Map<string, Appointment>();
  for (const a of appointments) {
    if (a.sourceInquiryId) appointmentByInquiryId.set(a.sourceInquiryId, a);
  }

  // Anything without an explicit status (shouldn't happen post-migration, but defensive for any
  // row that predates the status column) counts as pending, same as the DB column's own default.
  const counts = {
    all: inquiries.length,
    pending: inquiries.filter((i) => (i.status ?? "pending") === "pending").length,
    accepted: inquiries.filter((i) => i.status === "accepted").length,
    denied: inquiries.filter((i) => i.status === "denied").length,
  };
  const tabInquiries = tab === "all" ? inquiries : inquiries.filter((i) => (i.status ?? "pending") === tab);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markRead = (ids: string[]) => {
    if (ids.length === 0) return;
    const fd = new FormData();
    ids.forEach((id) => fd.append("id", id));
    startTransition(() => {
      markInquiryRead(fd);
    });
    setSelected(new Set());
  };

  const deleteMessages = (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(ids.length === 1 ? "Delete this message?" : `Delete ${ids.length} messages?`)) return;
    const fd = new FormData();
    ids.forEach((id) => fd.append("id", id));
    startTransition(() => {
      deleteInquiries(fd);
    });
    setSelected(new Set());
  };

  const denyMessages = (ids: string[]) => {
    if (ids.length === 0) return;
    const fd = new FormData();
    ids.forEach((id) => fd.append("id", id));
    startTransition(() => {
      denyInquiry(fd);
    });
    setSelected(new Set());
  };

  const allChecked = tabInquiries.length > 0 && selected.size === tabInquiries.length;

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Messages</h2>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && <span className="badge-pill bg-spruce text-white">{unreadCount} New</span>}
          <Link href="/dashboard/calendar" className="text-xs font-medium text-spruce hover:underline">
            My Calendar →
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-stone2">
        Every "Send My Info" request lands here and is emailed to you right away, even while you're offline. A
        yellow or red number/email means that contact's been reported before. We never share who reported it or
        why.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setSelected(new Set());
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tab === t.key ? "bg-spruce text-white" : "bg-porcelain text-stone2"
            }`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {tabInquiries.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <label className="flex items-center gap-2 text-xs text-stone2">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => setSelected(allChecked ? new Set() : new Set(tabInquiries.map((i) => i.id)))}
            />
            Select All
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selected.size === 0 || isPending}
              onClick={() => markRead(Array.from(selected))}
              className="btn-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark Selected As Read{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
            <button
              type="button"
              disabled={unreadCount === 0 || isPending}
              onClick={() => markRead(tabInquiries.filter((i) => !i.readAt).map((i) => i.id))}
              className="btn-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark All As Read
            </button>
            {(tab === "pending" || tab === "all") && (
              <button
                type="button"
                disabled={selected.size === 0 || isPending}
                onClick={() => denyMessages(Array.from(selected))}
                className="btn-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Deny Selected{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
            )}
            <button
              type="button"
              disabled={selected.size === 0 || isPending}
              onClick={() => deleteMessages(Array.from(selected))}
              className="btn-ghost px-3 py-1.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete Selected{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
            <button
              type="button"
              disabled={tabInquiries.length === 0 || isPending}
              onClick={() => deleteMessages(tabInquiries.map((i) => i.id))}
              className="btn-ghost px-3 py-1.5 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete All
            </button>
          </div>
        </div>
      )}

      {tabInquiries.length === 0 ? (
        <p className="mt-4 text-sm text-stone2">
          {tab === "all"
            ? "No messages yet."
            : tab === "pending"
            ? "No pending messages."
            : tab === "accepted"
            ? "Nothing accepted yet."
            : "Nothing denied."}
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {tabInquiries.map((inq) => (
            <MessageRow
              key={inq.id}
              inquiry={inq}
              appointment={appointmentByInquiryId.get(inq.id) ?? null}
              appointments={appointments}
              checked={selected.has(inq.id)}
              onToggle={() => toggle(inq.id)}
              onDelete={() => deleteMessages([inq.id])}
              onDeny={() => denyMessages([inq.id])}
            />
          ))}
        </ul>
      )}

      <ReportCustomer />
      <MyReports reports={myReports} />
    </section>
  );
}

/** Read-only list of reports this cuddler has personally filed — so they can double-check what
 *  they submitted. Deliberately no delete/edit button here (see listMyReports's comment in
 *  actions.ts): removing a live report needs a human look, so it's a support request instead of a
 *  one-click undo a bad actor could also use to erase their own report before anyone sees it. */
function MyReports({ reports }: { reports: MyReport[] }) {
  if (reports.length === 0) return null;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-ink">Your Reports</h3>
      <p className="mt-0.5 text-xs text-stone2">
        Reports you've filed, for your own records. Filed one by mistake? Delete it below. For anything else,
        like correcting or reinstating a report, contact us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-spruce hover:underline">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
      <ul className="mt-3 grid gap-2">
        {reports.map((r) => (
          <li key={r.id} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink">{r.contactValue}</span>
              <span className="text-xs text-stone2">{r.createdAt.toLocaleDateString()}</span>
            </div>
            {r.reason && <p className="mt-1 text-xs text-stone2">{r.reason}</p>}
            <form action={deleteMyReport} className="mt-2">
              <input type="hidden" name="id" value={r.id} />
              <button className="text-xs text-red-700 hover:underline">Delete This Report</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageRow({
  inquiry,
  appointment,
  appointments,
  checked,
  onToggle,
  onDelete,
  onDeny,
}: {
  inquiry: Inquiry;
  appointment: Appointment | null;
  appointments: Appointment[];
  checked: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onDeny: () => void;
}) {
  const status = inquiry.status ?? "pending";
  const unread = !inquiry.readAt;
  const severity = inquiry.flagSeverity;
  const whenLabel = inquiry.flexible
    ? "Whenever open"
    : [inquiry.preferredDate, inquiry.preferredTime].filter(Boolean).join(" at ") || null;
  // Checks the requested date/time against everything already on the calendar — lets a cuddler
  // see they're double-booked before they hit Accept, instead of finding out later.
  const conflicts =
    status === "pending" && !inquiry.flexible
      ? findConflicts(inquiry.preferredDate, inquiry.preferredTime, inquiry.duration, appointments)
      : [];

  return (
    <li className={`rounded-lg border p-3 text-sm ${unread ? "border-spruce bg-spruce-tint" : "border-line"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="mt-1 shrink-0"
            aria-label={`Select message from ${inquiry.clientName}`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-ink">{inquiry.clientName}</span>
              {unread && <span className="badge-pill bg-spruce text-white">New</span>}
              {inquiry.locationType && (
                <span className="badge-pill border border-line bg-white text-ink">
                  {inquiry.locationType
                    .split(",")
                    .map((v) => LOCATION_LABEL[v] ?? v)
                    .join(" or ")}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {inquiry.clientPhone && (
                <span className={severity !== "none" ? SEVERITY_STYLE[severity] : "text-stone2"}>
                  {inquiry.clientPhone}
                  {severity !== "none" && <span className="ml-1">👎 {inquiry.flaggedCount}</span>}
                </span>
              )}
              {inquiry.clientEmail && (
                <span className={severity !== "none" && !inquiry.clientPhone ? SEVERITY_STYLE[severity] : "text-stone2"}>
                  {inquiry.clientEmail}
                  {severity !== "none" && !inquiry.clientPhone && <span className="ml-1">👎 {inquiry.flaggedCount}</span>}
                </span>
              )}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-xs text-stone2">{inquiry.createdAt.toLocaleDateString()}</span>
      </div>

      {(inquiry.cuddleType || inquiry.duration || whenLabel) && (
        <p className="mt-2 text-xs text-stone2">
          {inquiry.cuddleType && <span className="font-medium text-ink">{inquiry.cuddleType}</span>}
          {inquiry.cuddleType && inquiry.duration && " · "}
          {inquiry.duration}
          {(inquiry.cuddleType || inquiry.duration) && whenLabel && " · "}
          {whenLabel}
        </p>
      )}
      {inquiry.message && <p className="mt-2 leading-relaxed text-ink">{inquiry.message}</p>}

      {conflicts.length > 0 && (
        <p className="mt-2 text-xs font-medium text-red-700">
          ⚠ You're already booked with {conflicts.map((c) => c.clientName).join(", ")} around this time — review
          before accepting.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2">
        {unread && (
          <form action={markInquiryRead}>
            <input type="hidden" name="id" value={inquiry.id} />
            <button className="btn-ghost px-3 py-1.5 text-xs">Mark As Read</button>
          </form>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="btn-ghost px-3 py-1.5 text-xs text-red-700"
        >
          Delete
        </button>
        {(inquiry.clientPhone || inquiry.clientEmail) && (
          <QuickReport phone={inquiry.clientPhone} email={inquiry.clientEmail} alreadyFlagged={severity !== "none"} />
        )}
        {status === "pending" && (
          <>
            <AcceptInquiryButton inquiry={inquiry} appointments={appointments} hasConflict={conflicts.length > 0} />
            <button type="button" onClick={onDeny} className="btn-ghost px-3 py-1.5 text-xs text-stone2">
              Deny
            </button>
          </>
        )}
        {status === "accepted" && appointment && (
          <>
            <span className="text-xs text-stone2">
              Scheduled: {new Date(`${appointment.date}T00:00:00`).toLocaleDateString()}
              {formatTime12(appointment.time) && ` at ${formatTime12(appointment.time)}`}
            </span>
            <EditApptTimeButton appointment={appointment} />
          </>
        )}
        {status !== "pending" && (
          <form action={resetInquiryStatus}>
            <input type="hidden" name="id" value={inquiry.id} />
            <button className="btn-ghost px-3 py-1.5 text-xs text-stone2">Move Back To Pending</button>
          </form>
        )}
      </div>
    </li>
  );
}

/** Lets a cuddler adjust the date/time of an already-accepted booking right from the inbox, no
 *  need to open the calendar just to fix a time (see the contact-info-on-the-calendar-card
 *  precedent — same "don't make them go back and forth" goal, just the other direction). Reuses
 *  updateAppointment with the appointment's existing name/phone/email/duration/notes carried
 *  along untouched, since only date/time are editable here. */
function EditApptTimeButton({ appointment }: { appointment: Appointment }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
        Edit Time
      </button>
    );
  }

  function submit(formData: FormData) {
    setError(null);
    formData.set("id", appointment.id);
    formData.set("clientName", appointment.clientName);
    if (appointment.clientPhone) formData.set("clientPhone", appointment.clientPhone);
    if (appointment.clientEmail) formData.set("clientEmail", appointment.clientEmail);
    if (appointment.duration) formData.set("duration", appointment.duration);
    if (appointment.notes) formData.set("notes", appointment.notes);
    startTransition(async () => {
      const result = await updateAppointment(null, formData);
      if (result?.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <form action={submit} className="mt-2 flex w-full flex-wrap items-center gap-2 rounded-lg bg-porcelain p-2">
      <input type="date" name="date" defaultValue={appointment.date} required className="field text-xs" />
      <input type="time" name="time" defaultValue={appointment.time ?? ""} className="field text-xs" />
      <button disabled={pending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-3 py-1.5 text-xs">
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </form>
  );
}

/** Turns a message into a calendar entry (see /dashboard/calendar) — opens a small inline form
 *  instead of accepting instantly, since the actual agreed time often isn't exactly what was
 *  first requested (or nothing was requested at all — "Whenever You're Open"). Pre-fills from the
 *  inquiry's preferredDate/preferredTime where available. Uses a direct transition (like
 *  PhotoUploader's flag/undo-crop buttons) rather than useFormState so the form only collapses on
 *  an actual success, not on every submit regardless of whether it errored.
 *
 *  Date/time are controlled inputs (rather than defaultValue) specifically so the conflict check
 *  can re-run live as the cuddler edits them — pick a different, free slot and the warning
 *  clears without needing to cancel and reopen the form. */
function AcceptInquiryButton({
  inquiry,
  appointments,
  hasConflict,
}: {
  inquiry: Inquiry;
  appointments: Appointment[];
  hasConflict: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(inquiry.preferredDate ?? "");
  const [time, setTime] = useState(inquiry.preferredTime ?? "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn-ghost px-3 py-1.5 text-xs ${hasConflict ? "text-red-700" : "text-spruce"}`}
      >
        {hasConflict ? "⚠ Review Conflict & Accept" : "Accept → Add To Calendar"}
      </button>
    );
  }

  const liveConflicts = findConflicts(date || null, time || null, inquiry.duration, appointments);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await acceptInquiryAsAppointment(null, formData);
      if (result?.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <form action={submit} className="mt-2 flex w-full flex-wrap items-center gap-2 rounded-lg bg-porcelain p-2">
      <input type="hidden" name="inquiryId" value={inquiry.id} />
      <input
        type="date"
        name="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        className="field text-xs"
      />
      <input
        type="time"
        name="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="field text-xs"
      />
      <button disabled={pending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
        {pending ? "Adding…" : "Confirm"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost px-3 py-1.5 text-xs">
        Cancel
      </button>
      {liveConflicts.length > 0 && (
        <p className="w-full text-xs text-red-700">
          ⚠ Already booked with {liveConflicts.map((c) => c.clientName).join(", ")} at this date/time — pick a
          different slot above, or confirm anyway if you can actually fit both.
        </p>
      )}
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </form>
  );
}

/** Reason picker shared by QuickReport and ReportCustomer below — a fixed list instead of a free
 *  text box (see REPORT_REASONS comment in lib/config.ts), with "Other" revealing a short
 *  free-text fallback capped at FLAG_REASON_MAX_CHARS. */
function ReasonFields() {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  return (
    <div className="grid gap-2">
      <select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="field text-xs">
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {reason === "Other" && (
        <input
          name="reasonOther"
          type="text"
          maxLength={FLAG_REASON_MAX_CHARS}
          className="field text-xs"
          placeholder="Briefly describe what happened"
        />
      )}
    </div>
  );
}

/** In-the-moment safety notice shown right above every report form — reporting a contact is not
 *  a substitute for calling emergency services, and we're not liable for a client's actions or
 *  for the accuracy of what another cuddler reports (see /terms's "Reports, safety, and
 *  liability" section, linked below, for the full legal language). */
function SafetyNotice() {
  return (
    <p className="rounded-lg bg-red-50 p-2 text-xs text-red-800">
      If you feel unsafe or are in immediate danger, call 911 first. Find Me Cuddle does not verify reports and
      is not responsible for a client's actions or for the accuracy of what's reported here. See our{" "}
      <a href="/terms" target="_blank" className="underline">
        Terms
      </a>
      .
    </p>
  );
}

/** Report button scoped to one message — pre-fills whichever contact info the client left, so
 *  there's nothing to type except an optional reason. See ReportCustomer below for the standalone
 *  version used when a cuddler wants to report someone who never came through a message. */
function QuickReport({
  phone,
  email,
  alreadyFlagged,
}: {
  phone: string | null;
  email: string | null;
  alreadyFlagged: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(reportContact, null as null | { error?: string; ok?: string });

  if (state?.ok) return <span className="ml-auto text-xs text-spruce">{state.ok}</span>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="ml-auto text-xs text-stone2 hover:underline">
        {alreadyFlagged ? "Also Report This Contact" : "Report This Client"}
      </button>
    );
  }

  return (
    <form action={action} className="grid w-full gap-2 border-t border-line pt-2">
      {phone && <input type="hidden" name="phone" value={phone} />}
      {!phone && email && <input type="hidden" name="email" value={email} />}
      <label className="text-xs text-stone2">
        Reporting flags this contact for every cuddler on Find Me Cuddle. We only ever show other cuddlers
        that it's been reported, never your name or the reason.
      </label>
      <ReasonFields />
      <SafetyNotice />
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-ghost text-xs">Submit Report</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-stone2 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Standalone reporting entry point — for a bad customer who called or texted directly and never
 *  used "Send My Info", so there's no message row to attach the report to. Deliberately asks for
 *  only a phone or email, never a name (see the flaggedContacts comment in lib/schema.ts). */
function ReportCustomer() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(reportContact, null as null | { error?: string; ok?: string });

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Report A Client</h3>
          <p className="mt-0.5 text-xs text-stone2">
            Had a bad experience with someone who didn't message you through the site? Flag their number or
            email to warn other cuddlers if that contact reaches out to them too.
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost shrink-0">
            Report Someone
          </button>
        )}
      </div>

      {open && !state?.ok && (
        <form action={action} className="mt-3 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="phone" type="tel" className="field text-sm" placeholder="Their phone number" />
            <input name="email" type="email" className="field text-sm" placeholder="Or their email" />
          </div>
          <ReasonFields />
          <SafetyNotice />
          {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary w-fit text-xs">Submit Report</button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-stone2 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      )}
      {state?.ok && <p className="mt-2 text-sm text-spruce">{state.ok}</p>}
    </div>
  );
}
