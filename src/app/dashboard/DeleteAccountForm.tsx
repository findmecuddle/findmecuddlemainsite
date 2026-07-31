"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { deleteAccount } from "@/app/actions";

export default function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(deleteAccount, null as null | { error?: string });

  return (
    <section className="card border border-red-200 p-6">
      <h2 className="font-display text-lg font-semibold text-red-800">Delete Account</h2>
      <p className="mt-1 text-xs text-stone2">
        Permanently delete your account. This removes your listing, photos, and license document,
        cancels any active subscription right away, and can't be undone.
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost mt-4 border-red-300 text-red-700 hover:border-red-500 hover:text-red-800">
          Delete My Account
        </button>
      ) : (
        <form action={action} className="mt-4 grid gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-800">
            Your subscription ends immediately, not at the end of your current billing period — any
            days you've already paid for but haven't used are forfeited, with no refund or proration.
          </p>
          <div>
            <label className="label" htmlFor="deletePassword">Confirm your password</label>
            <input id="deletePassword" name="password" type="password" className="field" />
            <p className="mt-1 text-[11px] text-stone2">Leave blank if you signed in with Google.</p>
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
