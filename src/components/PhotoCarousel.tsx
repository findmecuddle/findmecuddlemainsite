"use client";

import { useEffect, useState } from "react";

type Photo = { url: string; w: number; h: number };

/** Auto-rotating photo display — a Monthly VIP perk for ads with more than one photo. */
export default function PhotoCarousel({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), 4000);
    return () => clearInterval(id);
  }, [photos.length]);

  if (photos.length === 0) return null;

  return (
    <div>
      <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-spruce-tint sm:h-80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[index].url} alt={`${alt} — photo ${index + 1}`} className="h-full w-full object-cover" />
        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
          Featured photos
        </span>
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-spruce" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
