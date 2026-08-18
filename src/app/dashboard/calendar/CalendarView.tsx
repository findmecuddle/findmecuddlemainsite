"use client";

import { useMemo, useState, useTransition } from "react";
import { createAppointment, deleteAppointment, type listAppointments } from "@/app/actions";
import { DURATION_OPTIONS } from "@/lib/config";

type Appointment = Awaited<ReturnType<typeof listAppointments>>[number];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime12(hm: string | null): string | null {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function CalendarView({ appointments }: { appointments: Appointment[] }) {
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [addingFor, setAddingFor] = useState<string | null>(null);

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
          return (
            <div
              key={i}
              className={`min-h-[90px] rounded-lg border p-1.5 ${
                isToday ? "border-spruce bg-spruce-tint" : "border-line bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isToday ? "font-semibold text-spruce" : "text-stone2"}`}>
                  {date.getDate()}
                </span>
                <button
                  type="button"
                  onClick={() => setAddingFor(key)}
                  className="text-xs text-stone2 hover:text-spruce"
                  aria-label={`Add appointment on ${key}`}
                >
                  +
                </button>
              </div>
              <ul className="mt-1 grid gap-1">
                {dayAppointments.map((a) => (
                  <li key={a.id} className="group rounded bg-porcelain px-1.5 py-1 text-[11px] leading-tight">
                    <div className="flex items-start justify-between gap-1">
                      <span className="min-w-0 truncate">
                        {formatTime12(a.time) && <span className="font-medium">{formatTime12(a.time)} </span>}
                        {a.clientName}
                      </span>
                      <form action={deleteAppointment}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          className="shrink-0 text-stone2 opacity-0 hover:text-red-700 group-hover:opacity-100"
                          aria-label={`Remove appointment with ${a.clientName}`}
                        >
                          ×
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {addingFor && <AddAppointmentForm date={addingFor} onClose={() => setAddingFor(null)} />}
    </div>
  );
}

function AddAppointmentForm({ date, onClose }: { date: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAppointment(null, formData);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        action={submit}
        onClick={(e) => e.stopPropagation()}
        className="card grid w-full max-w-sm gap-3 p-5"
      >
        <h3 className="font-display text-lg font-semibold">Add Appointment</h3>
        <div>
          <label className="label" htmlFor="apptClientName">Client Name</label>
          <input id="apptClientName" name="clientName" required className="field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="apptDate">Date</label>
            <input id="apptDate" name="date" type="date" defaultValue={date} required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="apptTime">Time</label>
            <input id="apptTime" name="time" type="time" className="field" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="apptDuration">Duration</label>
          <select id="apptDuration" name="duration" className="field">
            <option value="">Not Set</option>
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="apptNotes">Notes (Optional)</label>
          <textarea id="apptNotes" name="notes" rows={2} className="field" />
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="btn-primary flex-1 disabled:opacity-50">
            {pending ? "Adding…" : "Add To Calendar"}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}
