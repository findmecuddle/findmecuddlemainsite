"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Rect = { left: number; top: number; width: number; height: number }; // all 0-1 fractions

const MIN_SIZE = 0.03; // smallest crop box, as a fraction of the image, to avoid a useless sliver

function clampRect(r: Rect): Rect {
  const width = Math.min(1, Math.max(MIN_SIZE, r.width));
  const height = Math.min(1, Math.max(MIN_SIZE, r.height));
  const left = Math.min(1 - width, Math.max(0, r.left));
  const top = Math.min(1 - height, Math.max(0, r.top));
  return { left, top, width, height };
}

export default function CropTool({
  photoUrl,
  cuddlerId,
  flagId,
  backHref,
}: {
  photoUrl: string;
  cuddlerId: string;
  flagId?: string;
  backHref: string;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ mode: "draw" | "move" | "resize"; handle?: string; startX: number; startY: number; startRect: Rect } | null>(null);

  function fracFromEvent(e: { clientX: number; clientY: number }) {
    const box = wrapRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    return { x, y };
  }

  function onWrapPointerDown(e: React.PointerEvent) {
    if (e.target !== wrapRef.current && (e.target as HTMLElement).dataset.role !== "image") return;
    const { x, y } = fracFromEvent(e);
    dragRef.current = { mode: "draw", startX: x, startY: y, startRect: { left: x, top: y, width: 0, height: 0 } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onBoxPointerDown(handle?: string) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      if (!rect) return;
      const { x, y } = fracFromEvent(e);
      dragRef.current = { mode: handle ? "resize" : "move", handle, startX: x, startY: y, startRect: rect };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = fracFromEvent(e);
    const dx = x - drag.startX;
    const dy = y - drag.startY;

    if (drag.mode === "draw") {
      const left = Math.min(drag.startX, x);
      const top = Math.min(drag.startY, y);
      const width = Math.abs(x - drag.startX);
      const height = Math.abs(y - drag.startY);
      setRect({ left, top, width, height });
    } else if (drag.mode === "move") {
      setRect(clampRect({ ...drag.startRect, left: drag.startRect.left + dx, top: drag.startRect.top + dy }));
    } else if (drag.mode === "resize") {
      const r = drag.startRect;
      let next: Rect = { ...r };
      if (drag.handle?.includes("e")) next.width = r.width + dx;
      if (drag.handle?.includes("s")) next.height = r.height + dy;
      if (drag.handle?.includes("w")) {
        next.left = r.left + dx;
        next.width = r.width - dx;
      }
      if (drag.handle?.includes("n")) {
        next.top = r.top + dy;
        next.height = r.height - dy;
      }
      setRect(clampRect(next));
    }
  }

  function onPointerUp() {
    if (dragRef.current?.mode === "draw" && rect) setRect(clampRect(rect));
    dragRef.current = null;
  }

  async function saveCrop() {
    if (!rect) {
      setError("Draw a crop box on the photo first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/crop-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuddlerId,
          flagId,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't save the crop.");
        setSaving(false);
        return;
      }
      router.push(backHref);
      router.refresh();
    } catch {
      setError("Couldn't save the crop. Check your connection and try again.");
      setSaving(false);
    }
  }

  const handles = ["nw", "ne", "sw", "se"] as const;
  const cursorFor: Record<(typeof handles)[number], string> = {
    nw: "nwse-resize",
    se: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
  };

  return (
    <div className="grid gap-4">
      <div
        ref={wrapRef}
        onPointerDown={onWrapPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative w-full select-none overflow-hidden rounded-card border border-line bg-porcelain"
        style={{ touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" data-role="image" draggable={false} className="block w-full" />
        {rect && (
          <div
            onPointerDown={onBoxPointerDown()}
            className="absolute cursor-move border-2 border-spruce bg-spruce/10"
            style={{
              left: `${rect.left * 100}%`,
              top: `${rect.top * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
            }}
          >
            {handles.map((h) => (
              <div
                key={h}
                onPointerDown={onBoxPointerDown(h)}
                className="absolute h-3 w-3 rounded-full border-2 border-spruce bg-white"
                style={{
                  cursor: cursorFor[h],
                  top: h.includes("n") ? -6 : undefined,
                  bottom: h.includes("s") ? -6 : undefined,
                  left: h.includes("w") ? -6 : undefined,
                  right: h.includes("e") ? -6 : undefined,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setRect(null)} className="btn-ghost text-sm">
          Clear Selection
        </button>
        <button type="button" onClick={saveCrop} disabled={!rect || saving} className="btn-primary text-sm disabled:opacity-50">
          {saving ? "Saving…" : "Save Crop"}
        </button>
      </div>
    </div>
  );
}
