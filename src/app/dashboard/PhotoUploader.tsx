"use client";

import { useRef, useState, useTransition } from "react";
import type { ClientSafeCuddler } from "@/lib/auth";

type Slot = 1 | 2 | 3 | 4 | 5 | 6;
const ALL_SLOTS: Slot[] = [1, 2, 3, 4, 5, 6];

type PhotoFields = "id" | "photoUrl" | "photoUrl2" | "photoUrl3" | "photoUrl4" | "photoUrl5" | "photoUrl6" | "cardPhotoUrl";

export default function PhotoUploader({
  cuddler,
  maxPhotos,
  admin,
}: {
  cuddler: Pick<ClientSafeCuddler, PhotoFields>;
  /** 3 for weekly/monthly, 6 for Monthly VIP — see photoLimit() in lib/stripe.ts */
  maxPhotos: number;
  /** Present only when rendered from /admin/cuddlers/[id]/edit. Switches upload/remove/set-profile
   *  requests to the admin-authenticated routes (which take a cuddlerId and work on any account,
   *  not just the signed-in cuddler's own), and adds Flag/Crop/Undo Crop on the profile pic —
   *  same read/write access an admin already had, just alongside full photo editing now instead of
   *  a read-only grid. Undefined on the cuddler's own dashboard. */
  admin?: {
    flagPhotoAction: (formData: FormData) => void | Promise<void>;
    undoCropAction: (formData: FormData) => void | Promise<void>;
  };
}) {
  const slots = ALL_SLOTS.slice(0, maxPhotos);
  const [photos, setPhotos] = useState<Record<Slot, string | null>>({
    1: cuddler.photoUrl,
    2: cuddler.photoUrl2,
    3: cuddler.photoUrl3,
    4: cuddler.photoUrl4,
    5: cuddler.photoUrl5,
    6: cuddler.photoUrl6,
  });
  const [busy, setBusy] = useState<Slot | null>(null);
  const [errors, setErrors] = useState<Record<Slot, string | null>>({
    1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  });
  // Always allocate all 6 refs (fixed hook count) — only slots up to maxPhotos are rendered.
  const inputs = {
    1: useRef<HTMLInputElement>(null),
    2: useRef<HTMLInputElement>(null),
    3: useRef<HTMLInputElement>(null),
    4: useRef<HTMLInputElement>(null),
    5: useRef<HTMLInputElement>(null),
    6: useRef<HTMLInputElement>(null),
  };

  const photosApiBase = admin ? "/api/admin/photos" : "/api/photos";

  async function handleFile(slot: Slot, file: File) {
    setBusy(slot);
    setErrors((e) => ({ ...e, [slot]: null }));

    const form = new FormData();
    if (admin) form.set("cuddlerId", cuddler.id);
    form.set("slot", String(slot));
    form.set("file", file);

    try {
      const res = await fetch(photosApiBase, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [slot]: data.error || "Upload failed." }));
      } else {
        setPhotos((p) => ({ ...p, [slot]: data.url }));
      }
    } catch {
      setErrors((e) => ({ ...e, [slot]: "Upload failed. Check your connection and try again." }));
    } finally {
      setBusy(null);
      if (inputs[slot].current) inputs[slot].current.value = "";
    }
  }

  async function handleRemove(slot: Slot) {
    setBusy(slot);
    setErrors((e) => ({ ...e, [slot]: null }));
    try {
      const res = await fetch(photosApiBase, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(admin ? { cuddlerId: cuddler.id, slot } : { slot }),
      });
      if (res.ok) setPhotos((p) => ({ ...p, [slot]: null }));
    } finally {
      setBusy(null);
    }
  }

  // Swaps a photo into slot 1 (the "profile pic" shown on cards, homepage, and search) — whatever
  // was in slot 1 takes this slot's place, so nothing is lost. See .../set-profile/route.ts.
  async function handleMakeProfile(slot: Slot) {
    setBusy(slot);
    setErrors((e) => ({ ...e, [slot]: null }));
    try {
      const res = await fetch(`${photosApiBase}/set-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(admin ? { cuddlerId: cuddler.id, slot } : { slot }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors((e) => ({ ...e, [slot]: data.error || "Couldn't set profile pic." }));
      } else {
        setPhotos((p) => ({ ...p, 1: data.slot1.url, [slot]: data.swappedSlot.url }));
      }
    } catch {
      setErrors((e) => ({ ...e, [slot]: "Couldn't set profile pic. Check your connection and try again." }));
    } finally {
      setBusy(null);
    }
  }

  // Flag/Undo Crop (admin only) — plain server action calls, not <form> submissions, since these
  // buttons live inside the cuddler's own outer listing-update <form> in admin mode and browsers
  // silently break nested forms.
  const [flaggedSlots, setFlaggedSlots] = useState<Set<number>>(new Set());
  const [flagPending, startFlagTransition] = useTransition();
  function handleFlag(slot: number) {
    if (!admin) return;
    const fd = new FormData();
    fd.set("cuddlerId", cuddler.id);
    fd.set("slot", String(slot));
    startFlagTransition(async () => {
      await admin.flagPhotoAction(fd);
      setFlaggedSlots((prev) => new Set(prev).add(slot));
    });
  }

  const [cardCropCleared, setCardCropCleared] = useState(false);
  const [undoPending, startUndoTransition] = useTransition();
  function handleUndoCrop() {
    if (!admin) return;
    const fd = new FormData();
    fd.set("cuddlerId", cuddler.id);
    startUndoTransition(async () => {
      await admin.undoCropAction(fd);
      setCardCropCleared(true);
    });
  }

  return (
    <div>
      <label className="label">Photos (up to {maxPhotos} — HD required, 1280×720 minimum)</label>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {slots.map((slot) => {
          const url = photos[slot];
          return (
            <div key={slot} className="grid gap-1">
              <div className="aspect-square overflow-hidden rounded-xl border border-line bg-spruce-tint">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={`Photo ${slot}`} className="h-full w-full object-cover" />
                ) : (
                  <button
                    type="button"
                    disabled={busy === slot}
                    onClick={() => inputs[slot].current?.click()}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-stone2 hover:text-spruce disabled:opacity-50"
                  >
                    <span className="text-2xl">+</span>
                    <span>{busy === slot ? "Uploading…" : "Add Photo"}</span>
                  </button>
                )}
              </div>
              <input
                ref={inputs[slot]}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(slot, f);
                }}
              />
              {url && (
                <div className="flex flex-wrap items-center justify-between gap-x-2 text-[11px]">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === slot}
                      onClick={() => inputs[slot].current?.click()}
                      className="text-stone2 hover:text-spruce disabled:opacity-50"
                    >
                      {busy === slot ? "…" : "Change"}
                    </button>
                    <button
                      type="button"
                      disabled={busy === slot}
                      onClick={() => handleRemove(slot)}
                      className="text-stone2 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                  {slot === 1 ? (
                    <span className="font-medium text-spruce">Profile pic</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === slot}
                      onClick={() => handleMakeProfile(slot)}
                      className="text-stone2 hover:text-spruce disabled:opacity-50"
                    >
                      Set as profile pic
                    </button>
                  )}
                </div>
              )}
              {url && admin && (
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    disabled={flagPending || flaggedSlots.has(slot)}
                    onClick={() => handleFlag(slot)}
                    className="text-stone2 hover:text-red-700 disabled:opacity-50"
                  >
                    {flaggedSlots.has(slot) ? "Flagged" : "Flag"}
                  </button>
                  {slot === 1 && (
                    <a href={`/admin/crop-photo?cuddlerId=${cuddler.id}`} className="text-stone2 hover:text-spruce">
                      Crop
                    </a>
                  )}
                  {slot === 1 && cuddler.cardPhotoUrl && !cardCropCleared && (
                    <button
                      type="button"
                      disabled={undoPending}
                      onClick={handleUndoCrop}
                      className="text-stone2 hover:text-red-700 disabled:opacity-50"
                    >
                      Undo Crop
                    </button>
                  )}
                </div>
              )}
              {errors[slot] && <p className="text-[11px] text-red-700">{errors[slot]}</p>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-stone2">
        Change or Remove a photo anytime, not just when you first sign up. Photo 1 is the profile pic, the one
        shown on cards and search results. Use Set As Profile Pic on any other photo to switch which one that is.
      </p>
      <p className="mt-2 text-xs text-stone2">
        JPEG, PNG, or WebP · under 8MB · minimum 1280×720 resolution. Photos save immediately, no need to hit
        "Save Changes" for these. Use real, current, professional photos of the cuddler. AI-generated or stock
        photos aren't allowed and may be removed (see Terms).
        {maxPhotos < 6 && " Monthly VIP unlocks up to 6 rotating photos."}
      </p>
    </div>
  );
}
