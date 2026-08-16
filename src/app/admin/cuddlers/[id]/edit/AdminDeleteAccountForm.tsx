"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { adminDeleteCuddler } from "@/app/admin/actions";

export default function AdminDeleteAccountForm({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(adminDeleteCuddler, null as { error?: string } | null);

  return (
    <section className="card border border-red-200 p-6">
      <h2 className="font-display text-lg font-semibold text-red-800">Delete This Account</h2>
      <p className="mt-1 text-xs text-stone2">
        Permanently removes {name}'s listing, photos, and identity/certification documents, cancels
        any active subscription right away, and deletes their login. Can't be undone. Use this when
        a cuddler asks support to delete their account instead of doing it themselves.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-ghost mt-4 border-red-300 text-red-700 hover:border-red-500 hover:text-red-800"
        >
          Delete This Account
        </button>
      ) : (
        <form action={action} className="mt-4 grid gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="label" htmlFor="reason">Reason (Shown In Admin Activity Log)</label>
            <input id="reason" name="reason" className="field" placeholder="e.g. Requested by cuddler via email" />
          </div>
          <div>
            <label className="label" htmlFor="confirmText">
              Type <span className="font-semibold">DELETE</span> to confirm
            </label>
            <input id="confirmText" name="confirmText" required className="field" autoComplete="off" />
          </div>
          {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary bg-red-700 hover:bg-red-800">Permanently Delete Account</button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
