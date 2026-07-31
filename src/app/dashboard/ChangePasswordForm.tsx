"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { changePassword } from "@/app/actions";

export default function ChangePasswordForm() {
  const [state, action] = useFormState(changePassword, null as null | { error?: string; ok?: string });
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful change — don't leave the old/new passwords sitting in
  // the inputs once they're no longer needed.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <section className="card p-6">
      <h2 className="font-display text-lg font-semibold">Account</h2>
      <p className="mt-1 text-xs text-stone2">
        Change the password you use to log in. If you signed in with Google and have never set a
        password, leave "Current password" blank.
      </p>

      <form ref={formRef} action={action} className="mt-4 grid gap-3">
        <div>
          <label className="label" htmlFor="currentPassword">Current password</label>
          <input id="currentPassword" name="currentPassword" type="password" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">New password</label>
          <input id="newPassword" name="newPassword" type="password" required minLength={8} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="confirmNewPassword">Confirm new password</label>
          <input id="confirmNewPassword" name="confirmNewPassword" type="password" required minLength={8} className="field" />
        </div>
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p className="text-sm text-spruce">{state.ok}</p>}
        <button className="btn-ghost w-full sm:w-auto">Update Password</button>
      </form>

      <p className="mt-4 border-t border-line pt-4 text-xs text-stone2">
        Need help with something else? <a href="/contact" className="font-medium text-spruce hover:underline">Contact Support</a>
      </p>
    </section>
  );
}
