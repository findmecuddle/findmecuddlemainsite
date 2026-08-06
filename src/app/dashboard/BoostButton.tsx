"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { boost } from "@/app/actions";
import { BOOST_COOLDOWN_HOURS, BOOST_MESSAGE_MAX_CHARS } from "@/lib/config";
import CountdownClock from "./CountdownClock";

export default function BoostButton({
  credits,
  boostedAt,
  boostMessage,
  live,
}: {
  credits: number;
  /** ISO timestamp of the most recent boost, if any — the boost stays active for BOOST_COOLDOWN_HOURS from here. */
  boostedAt: string | null;
  /** Promo line attached to the current/most recent boost, if any — see BOOST_MESSAGE_MAX_CHARS. */
  boostMessage?: string | null;
  live: boolean;
}) {
  const [state, action] = useFormState(
    async (_prev: null | { error?: string; ok?: string }, formData: FormData) => boost(formData),
    null as null | { error?: string; ok?: string }
  );
  const [message, setMessage] = useState("");

  // Ticks every second so the countdown (and the button re-enabling itself) updates live,
  // without needing a page refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const expiresAt = boostedAt ? new Date(boostedAt).getTime() + BOOST_COOLDOWN_HOURS * 3600_000 : null;
  const boostActive = !!expiresAt && expiresAt > now;
  // A second boost can't be started while the current one is still active — this mirrors the
  // same check the server enforces in the boost() action, just kept in sync live on screen.
  const canBoost = live && credits > 0 && !boostActive;

  return (
    <div className="mt-3">
      <form action={action}>
        {canBoost && (
          <div className="mb-2">
            <input
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, BOOST_MESSAGE_MAX_CHARS))}
              maxLength={BOOST_MESSAGE_MAX_CHARS}
              placeholder='Optional promo, e.g. "Today! 20% Off For Returning Clients!"'
              className="field text-sm"
            />
            <p className="mt-1 text-[11px] text-stone2">
              {message.length}/{BOOST_MESSAGE_MAX_CHARS}: shown with your Featured badge while the boost is active.
            </p>
          </div>
        )}
        <button className="btn-primary w-full disabled:opacity-50" disabled={!canBoost}>
          {boostActive ? "Boost Active" : "Boost Now"}
        </button>
      </form>
      {!live && <p className="mt-2 text-xs text-stone2">Go live first. Boosts only work on active listings.</p>}
      {live && boostActive && expiresAt && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gold">
            Boost active: <CountdownClock until={new Date(expiresAt).toISOString()} />
          </p>
          {boostMessage && <p className="mt-1 text-xs italic text-stone2">Showing: "{boostMessage}"</p>}
        </div>
      )}
      {live && !boostActive && credits === 0 && (
        <p className="mt-2 text-xs text-stone2">No credits left. Buy a pack below.</p>
      )}
      {state?.error && <p className="mt-2 text-xs text-red-700">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-xs text-spruce">{state.ok}</p>}
    </div>
  );
}
