"use client";

import { useFormState } from "react-dom";
import { adminLogin } from "@/app/admin/actions";
import Turnstile from "@/components/Turnstile";

export default function AdminLoginPage() {
  const [state, action] = useFormState(adminLogin, null as null | { error?: string });
  return (
    <div className="container-page flex justify-center py-16">
      <form action={action} className="card w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-stone2">Moderate reviews, reports, and verification.</p>

        <div className="mt-6 grid gap-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="field" autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="field" />
          </div>
          <Turnstile />
          {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
          <button className="btn-primary w-full">Log in</button>
        </div>
      </form>
    </div>
  );
}
