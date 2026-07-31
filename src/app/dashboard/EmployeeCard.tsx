"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { saveEmployee, removeEmployee } from "@/app/actions";
import { CUDDLE_TYPES, WEEK_DAYS, GENDER_OPTIONS } from "@/lib/config";
import { parseEmployeeHours } from "@/lib/employeeHours";
import type { AgencyEmployee } from "@/lib/schema";
import EmployeePhotoUploader from "./EmployeePhotoUploader";

// Handles both an existing employee (edit/remove) and a brand-new one (add) — pass no `employee`
// prop for the "Add Team Member" card. Same saveEmployee action either way; presence of a hidden
// employeeId field is what tells the server which case it is (see saveEmployee in app/actions.ts).
export default function EmployeeCard({ employee }: { employee?: AgencyEmployee }) {
  const [open, setOpen] = useState(!employee);
  const [state, action] = useFormState(saveEmployee, null as null | { error?: string; ok?: string });
  const selectedServices = (employee?.services ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const hours = parseEmployeeHours(employee?.hoursJson);

  // Collapsed summary card — click Edit to expand into the full form below.
  if (!open && employee) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-line p-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-spruce-tint">
          {employee.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={employee.photoUrl} alt={employee.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-lg text-spruce">
              {employee.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{employee.name}</p>
          {selectedServices.length > 0 && (
            <p className="truncate text-xs text-stone2">{selectedServices.join(", ")}</p>
          )}
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost shrink-0 text-xs">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line p-4">
      <form action={action} className="grid gap-3">
        {employee && <input type="hidden" name="employeeId" value={employee.id} />}
        <div>
          <label className="label" htmlFor={`name-${employee?.id ?? "new"}`}>Name</label>
          <input
            id={`name-${employee?.id ?? "new"}`}
            name="name"
            defaultValue={employee?.name ?? ""}
            className="field"
            placeholder="Alex Rivera, LMT"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor={`gender-${employee?.id ?? "new"}`}>Gender (Optional)</label>
          <select
            id={`gender-${employee?.id ?? "new"}`}
            name="gender"
            defaultValue={employee?.gender ?? ""}
            className="field"
          >
            <option value="">Prefer not to say</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Cuddle Types Offered</label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {CUDDLE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="services"
                  value={type}
                  defaultChecked={selectedServices.includes(type)}
                  className="h-4 w-4 accent-spruce"
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Hours</label>
          <div className="grid gap-1.5">
            {hours.map(({ day, closed, openTime, closeTime }) => {
              const dayLabel = WEEK_DAYS.find((d) => d.day === day)?.label ?? "";
              return (
                <div
                  key={day}
                  className="grid grid-cols-[80px,auto,1fr,auto,1fr] items-center gap-2 border-t border-line pt-1.5 first:border-t-0 first:pt-0"
                >
                  <span className="text-xs font-medium">{dayLabel}</span>
                  <label className="flex items-center gap-1 text-[11px] text-stone2">
                    <input
                      type="checkbox"
                      name={`day_${day}_closed`}
                      defaultChecked={closed}
                      className="h-3.5 w-3.5 accent-spruce"
                    />
                    Off
                  </label>
                  <input
                    type="time"
                    name={`day_${day}_open`}
                    defaultValue={openTime ?? ""}
                    className="field py-1.5 text-xs"
                    aria-label={`${dayLabel} opens`}
                  />
                  <span className="text-center text-[10px] text-stone2">to</span>
                  <input
                    type="time"
                    name={`day_${day}_close`}
                    defaultValue={closeTime ?? ""}
                    className="field py-1.5 text-xs"
                    aria-label={`${dayLabel} closes`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {employee ? (
          <EmployeePhotoUploader employeeId={employee.id} photoUrl={employee.photoUrl} />
        ) : (
          <p className="text-xs text-stone2">Save this team member first, then add their photo.</p>
        )}

        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p className="text-sm text-spruce">{state.ok}</p>}
        <button className="btn-primary w-fit text-sm">{employee ? "Save Changes" : "Add Team Member"}</button>
      </form>

      {employee && (
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">
            Done Editing
          </button>
          <form action={removeEmployee}>
            <input type="hidden" name="employeeId" value={employee.id} />
            <button className="text-xs text-red-700 hover:underline">Remove From Team</button>
          </form>
        </div>
      )}
    </div>
  );
}
