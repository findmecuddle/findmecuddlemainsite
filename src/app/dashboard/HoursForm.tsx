"use client";

import { useFormState } from "react-dom";
import { updateHours } from "@/app/actions";
import { HOUR_BLOCKS_PER_DAY } from "@/lib/config";

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
        Set the days and times you're available. Leave every block on a day blank to mark it closed.
        You can add up to {HOUR_BLOCKS_PER_DAY} separate time blocks per day (e.g. 9-10am, then
        11am-1pm) if you have a gap in your schedule.
      </p>

      <div className="grid gap-4">
        {hours.map(({ day, label, blocks }) => (
          <div key={day} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
            <span className="text-sm font-medium">{label}</span>
            <div className="mt-1.5 grid gap-1.5">
              {Array.from({ length: HOUR_BLOCKS_PER_DAY }, (_, i) => {
                const block = blocks.find((b) => b.blockIndex === i);
                return (
                  <div key={i} className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
                    <input
                      type="time"
                      name={`day_${day}_block${i}_open`}
                      defaultValue={block?.openTime ?? ""}
                      className="field"
                      aria-label={`${label} block ${i + 1} opens`}
                    />
                    <span className="text-center text-xs text-stone2">to</span>
                    <input
                      type="time"
                      name={`day_${day}_block${i}_close`}
                      defaultValue={block?.closeTime ?? ""}
                      className="field"
                      aria-label={`${label} block ${i + 1} closes`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
