"use client";

import { useFormState } from "react-dom";
import { updateHours } from "@/app/actions";

type DayRow = {
  day: number;
  label: string;
  blocks: { blockIndex: number; openTime: string | null; closeTime: string | null }[];
};
type FormAction = (
  state: { error?: string; ok?: string } | null,
  formData: FormData
) => Promise<{ error?: string; ok?: string }>;

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1)); // "1".."12"

// Splits a stored "HH:MM" 24-hour string (native <input type="time"> format, still what the
// server stores and reads — see applyHoursUpdate in lib/listingUpdate.ts) into the hour/minute/
// AM-PM parts these three <select>s show. Minutes round to the nearest half hour, since going
// forward only :00/:30 are selectable — carries into the next hour when rounding up from :45.
function splitTime(t: string | null): { hour: string; minute: "00" | "30"; ampm: "AM" | "PM" } {
  if (!t) return { hour: "", minute: "00", ampm: "AM" };
  const [hStr, mStr] = t.split(":");
  let h24 = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  let minute: "00" | "30" = "00";
  if (m >= 45) h24 = (h24 + 1) % 24;
  else if (m >= 15) minute = "30";
  const ampm: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour: String(hour12), minute, ampm };
}

export default function HoursForm({
  hours,
  gatekeepHours,
  action: actionProp,
}: {
  hours: DayRow[];
  gatekeepHours: boolean;
  // Lets the admin "edit on behalf of a cuddler" panel pass a bound admin action
  // (adminUpdateHours.bind(null, cuddlerId)) instead of the cuddler's own updateHours.
  action?: FormAction;
}) {
  const [state, action] = useFormState(
    actionProp ?? updateHours,
    null as null | { error?: string; ok?: string }
  );

  return (
    <form action={action} className="card grid gap-4 p-6">
      <h2 className="font-display text-lg font-semibold">Hours</h2>
      <p className="text-sm text-stone2">
        Set the hours you're available each day. Leave a day blank to mark it closed. For a day
        you're available around the clock, just set it 12:00 AM to 11:30 PM.
      </p>

      <div className="grid gap-4">
        {hours.map(({ day, label, blocks }) => {
          const block = blocks.find((b) => b.blockIndex === 0);
          const open = splitTime(block?.openTime ?? null);
          const close = splitTime(block?.closeTime ?? null);
          return (
            <div key={day} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
              <span className="text-sm font-medium">{label}</span>
              <div className="mt-1.5 grid grid-cols-[1fr,auto,1fr] items-center gap-2">
                <TimeSelect name={`day_${day}_block0_open`} label={`${label} opens`} value={open} />
                <span className="text-center text-xs text-stone2">to</span>
                <TimeSelect name={`day_${day}_block0_close`} label={`${label} closes`} value={close} />
              </div>
            </div>
          );
        })}
      </div>

      <label className="flex items-start gap-2 rounded-lg bg-porcelain p-3 text-sm">
        <input
          type="checkbox"
          name="gatekeepHours"
          defaultChecked={gatekeepHours}
          className="mt-0.5 h-4 w-4 accent-spruce"
        />
        <span>
          <span className="font-medium text-ink">Only Let Clients Call/Text During My Hours Above</span>
          <span className="mt-0.5 block text-xs text-stone2">
            On by default, this is on right now unless you've turned it off before. Outside your hours,
            visitors see Email and "Send My Info" instead, so you won't be disturbed. Turn this off if
            you're fine being reached by call or text anytime.
          </span>
        </span>
      </label>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-spruce">{state.ok}</p>}
      <button className="btn-primary w-fit">Save Hours</button>
    </form>
  );
}

/** Hour + :00/:30 + AM/PM, three plain selects (no client JS needed to combine them — see
 *  applyHoursUpdate in lib/listingUpdate.ts, which reads `${name}_hour`/`_min`/`_ampm` and builds
 *  the "HH:MM" string server-side). Leaving Hour on "--" means this time isn't set. */
function TimeSelect({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: { hour: string; minute: "00" | "30"; ampm: "AM" | "PM" };
}) {
  return (
    <div className="flex gap-1">
      <select name={`${name}_hour`} defaultValue={value.hour} className="field" aria-label={`${label} hour`}>
        <option value="">--</option>
        {HOURS_12.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select name={`${name}_min`} defaultValue={value.minute} className="field" aria-label={`${label} minute`}>
        <option value="00">:00</option>
        <option value="30">:30</option>
      </select>
      <select name={`${name}_ampm`} defaultValue={value.ampm} className="field" aria-label={`${label} AM/PM`}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
