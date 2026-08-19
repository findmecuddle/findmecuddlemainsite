"use client";

import { useMemo, useState, useTransition } from "react";
import { createAppointment, updateAppointment, deleteAppointment, type listAppointments } from "@/app/actions";
import { DURATION_OPTIONS } from "@/lib/config";
import { formatTime12, timesOverlap } from "@/lib/scheduling";

type Appointment = Awaited<ReturnType<typeof listAppointments>>[number];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function CalendarView({ appointments }: { appointments: Appointment[] }) {
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    }
    return map;
  }, [appointments]);

  const cells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = firstOfMonth.getDay(); // 0 = Sunday
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - leading + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      return new Date(year, month, dayNum);
    });
  }, [monthCursor]);

  const monthLabel = monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = toDateKey(today);
  const selectedDayAppointments = selectedDay ? byDate.get(selectedDay) ?? [] : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            className="btn-ghost px-3 py-1.5 text-sm"
          >
            ‹
          </button>
          <h2 className="font-display text-lg font-semibold">{monthLabel}</h2>
          <button
            type="button"
            onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            className="btn-ghost px-3 py-1.5 text-sm"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAddingFor(todayKey)}
          className="btn-primary px-3 py-1.5 text-sm"
        >
          + Add Appointment
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-stone2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-[90px] rounded-lg bg-transparent" />;
          const key = toDateKey(date);
          const dayAppointments = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDay(key)}
              className={`min-h-[90px] rounded-lg border p-1.5 text-left ${
                isSelected ? "border-spruce ring-2 ring-spruce/30" : isToday ? "border-spruce bg-spruce-tint" : "border-line bg-white hover:border-spruce/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isToday ? "font-semibold text-spruce" : "text-stone2"}`}>
                  {date.getDate()}
                </span>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddingFor(key);
                  }}
                  className="text-xs text-stone2 hover:text-spruce"
                  aria-label={`Add appointment on ${key}`}
                >
                  +
                </span>
              </div>
              <ul className="mt-1 grid gap-1">
                {dayAppointments.slice(0, 3).map((a) => (
                  <li key={a.id} className="truncate rounded bg-porcelain px-1.5 py-1 text-[11px] leading-tight">
                    {formatTime12(a.time) && <span className="font-medium">{formatTime12(a.time)} </span>}
                    {a.clientName}
                  </li>
                ))}
                {dayAppointments.length > 3 && (
                  <li className="px-1.5 text-[11px] text-stone2">+{dayAppointments.length - 3} more</li>
                )}
              </ul>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="card mt-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">{formatDateLabel(selectedDay)}</h3>
            <button type="button" onClick={() => setSelectedDay(null)} className="text-xs text-stone2 hover:text-spruce">
              Close
            </button>
          </div>
          {selectedDayAppointments.length === 0 ? (
            <p className="mt-3 text-sm text-stone2">
              Nothing booked.{" "}
              <button type="button" onClick={() => setAddingFor(selectedDay)} className="font-medium text-spruce hover:underline">
                Add an appointment
              </button>
              .
            </p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {selectedDayAppointments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">
                      {a.clientName}
                      {formatTime12(a.time) && <span className="ml-2 font-normal text-stone2">{formatTime12(a.time)}</span>}
                      {a.duration && <span className="ml-2 font-normal text-stone2">· {a.duration}</span>}
                    </p>
                    {(a.clientPhone || a.clientEmail) && (
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-stone2">
                        {a.clientPhone && (
                          <a href={`tel:${a.clientPhone}`} className="hover:text-spruce hover:underline">
                            {a.clientPhone}
                          </a>
                        )}
                        {a.clientEmail && (
                          <a href={`mailto:${a.clientEmail}`} className="hover:text-spruce hover:underline">
                            {a.clientEmail}
                          </a>
                        )}
                      </p>
                    )}
                    {a.notes && <p className="mt-0.5 text-xs text-stone2">{a.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setEditing(a)} className="btn-ghost px-3 py-1.5 text-xs">
                      Edit
                    </button>
                    <form action={deleteAppointment}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn-ghost px-3 py-1.5 text-xs text-red-700">Delete</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {addingFor && (
        <AppointmentForm mode="add" date={addingFor} onClose={() => setAddingFor(null)} appointments={appointments} />
      )}
      {editing && (
        <AppointmentForm mode="edit" appointment={editing} onClose={() => setEditing(null)} appointments={appointments} />
      )}
    </div>
  );
}

function AppointmentForm(
  props:
    | { mode: "add"; date: string; onClose: () => void; appointments: Appointment[] }
    | { mode: "edit"; appointment: Appointment; onClose: () => void; appointments: Appointment[] }
) {
  const { mode, onClose, appointments } = props;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const defaults =
    mode === "edit"
      ? {
          id: props.appointment.id,
          clientName: props.appointment.clientName,
          clientPhone: props.appointment.clientPhone ?? "",
          clientEmail: props.appointment.clientEmail ?? "",
          date: props.appointment.date,
          time: props.appointment.time ?? "",
          duration: props.appointment.duration ?? "",
          notes: props.appointment.notes ?? "",
        }
      : { id: "", clientName: "", clientPhone: "", clientEmail: "", date: props.date, time: "", duration: "", notes: "" };

  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [duration, setDuration] = useState(defaults.duration);

  // Live heads-up as they fill out the form — the actual block happens server-side on submit
  // (see findSchedulingConflict in actions.ts) regardless of whether this warning shows.
  const liveConflicts = appointments.filter(
    (a) => a.id !== defaults.id && a.date === date && timesOverlap(time || null, duration || null, a.time, a.duration)
  );

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "add" ? await createAppointment(null, formData) : await updateAppointment(null, formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form action={submit} onClick={(e) => e.stopPropagation()} className="card grid w-full max-w-sm gap-3 p-5">
        <h3 className="font-display text-lg font-semibold">{mode === "add" ? "Add Appointment" : "Edit Appointment"}</h3>
        {mode === "edit" && <input type="hidden" name="id" value={defaults.id} />}
        <div>
          <label className="label" htmlFor="apptClientName">Client Name</label>
          <input id="apptClientName" name="clientName" required defaultValue={defaults.clientName} className="field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="apptClientPhone">Phone (Optional)</label>
            <input id="apptClientPhone" name="clientPhone" type="tel" defaultValue={defaults.clientPhone} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="apptClientEmail">Email (Optional)</label>
            <input id="apptClientEmail" name="clientEmail" type="email" defaultValue={defaults.clientEmail} className="field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="apptDate">Date</label>
            <input
              id="apptDate"
              name="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="apptTime">Time</label>
            <input
              id="apptTime"
              name="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="field"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="apptDuration">Duration</label>
          <select
            id="apptDuration"
            name="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="field"
          >
            <option value="">Not Set</option>
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="apptNotes">Notes (Optional)</label>
          <textarea id="apptNotes" name="notes" rows={2} defaultValue={defaults.notes} className="field" />
        </div>
        {liveConflicts.length > 0 && (
          <p className="text-xs text-red-700">
            ⚠ Already booked with {liveConflicts.map((c) => c.clientName).join(", ")} at this date/time — pick a
            different slot (this will be blocked when you save).
          </p>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary flex-1 disabled:opacity-50">
            {pending ? "Saving…" : mode === "add" ? "Add To Calendar" : "Save Changes"}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}
