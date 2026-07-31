"use client";

import { useRef, useState } from "react";

// Simplified single-slot version of PhotoUploader.tsx — an employee gets exactly one photo, no
// slot picker needed. Only rendered once an employee actually has an id (see EmployeeCard.tsx) —
// the upload endpoint needs a real employeeId to attach the file to.
export default function EmployeePhotoUploader({
  employeeId,
  photoUrl,
}: {
  employeeId: string;
  photoUrl: string | null;
}) {
  const [url, setUrl] = useState(photoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("employeeId", employeeId);
    form.set("file", file);
    try {
      const res = await fetch("/api/employee-photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Upload failed.");
      else setUrl(data.url);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/employee-photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      if (res.ok) setUrl(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">Photo (HD required, 1280×720 minimum — real photos only, no AI-generated)</label>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-spruce-tint">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-stone2 hover:text-spruce disabled:opacity-50"
            >
              <span className="text-xl">+</span>
              <span>{busy ? "…" : "Add"}</span>
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {url && (
          <button type="button" disabled={busy} onClick={handleRemove} className="btn-ghost text-xs">
            {busy ? "…" : "Remove Photo"}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
