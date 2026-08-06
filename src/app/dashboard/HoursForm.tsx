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
        you're available around the clock, just set it 12:00 AM to 11:59 PM.
      </p>

      <div className="grid gap-4">
        {hours.map(({ day, label, blocks }) => {
          const block = blocks.find((b) => b.blockIndex === 0);
          return (
            <div key={day} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
              <span className="text-sm font-medium">{label}</span>
              <div className="mt-1.5 grid grid-cols-[1fr,auto,1fr] items-center gap-2">
                <input
                  type="time"
                  name={`day_${day}_block0_open`}
                  defaultValue={block?.openTime ?? ""}
                  className="field"
                  aria-label={`${label} opens`}
                />
                <span className="text-center text-xs text-stone2">to</span>
                <input
                  type="time"
                  name={`day_${day}_block0_close`}
                  defaultValue={block?.closeTime ?? ""}
                  className="field"
                  aria-label={`${label} closes`}
                />
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
