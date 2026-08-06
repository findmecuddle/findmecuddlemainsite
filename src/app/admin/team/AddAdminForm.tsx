"use client";

import { useFormState } from "react-dom";
import { createAdminAccount } from "@/app/admin/actions";

export default function AddAdminForm() {
  const [state, action] = useFormState(createAdminAccount, null as null | { error?: string; ok?: string });
  return (
    <form action={action} className="card grid gap-3 p-6">
      <h2 className="font-display text-lg font-semibold">Add a team member</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="name" required placeholder="Name" className="field" />
        <input name="email" type="email" required placeholder="Email" className="field" />
        <input name="password" type="password" required minLength={8} placeholder="Temporary password" className="field" />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="text-sm text-spruce">{state.ok}</p>}
      <button className="btn-primary w-fit">Add</button>
      <p className="text-xs text-stone2">
        They can log in at <code>/admin/login</code> right away with this email and password. Share it with
        them directly, since there's no invite email sent.
      </p>
    </form>
  );
}
