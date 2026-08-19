"use client";

import { useCallback, useEffect, useState } from "react";

type Photo = { url: string; w: number; h: number };

/**
 * Wraps the profile photo display (VIP auto-rotating carousel, or the static horizontally
 * scrolling row for everyone else) with a click-to-expand lightbox — every tile is a button that
 * opens the same photo full-size in an overlay, with prev/next and Escape-to-close. This replaces
 * the old inline rendering in cuddlers/[slug]/page.tsx so the click/keyboard state can live in a
 * client component while the page itself stays a server component.
 */
export default function PhotoGallery({ photos, alt, vip }: { photos: Photo[]; alt: string; vip: boolean }) {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const isCarousel = vip && photos.length > 1;

  useEffect(() => {
    if (!isCarousel || lightboxIndex !== null) return;
    const id = setInterval(() => setCarouselIndex((i) => (i + 1) % photos.length), 4000);
    return () => clearInterval(id);
  }, [isCarousel, photos.length, lightboxIndex]);

  const close = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(() => setLightboxIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length)), [photos.length]);
  const next = useCallback(() => setLightboxIndex((i) => (i === null ? i : (i + 1) % photos.length)), [photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, close, prev, next]);

  if (photos.length === 0) return null;

  return (
    <div>
      {isCarousel ? (
        <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-spruce-tint sm:h-80">
          <button
            type="button"
            onClick={() => setLightboxIndex(carouselIndex)}
            className="block h-full w-full cursor-zoom-in"
            aria-label={`Expand photo ${carouselIndex + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[carouselIndex].url}
              alt={`${alt}, photo ${carouselIndex + 1}`}
              className="h-full w-full object-cover"
            />
          </button>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
            Featured photos
          </span>
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.map((p, i) => (
                <button
                  key={p.url}
                  type="button"
                  onClick={() => setCarouselIndex(i)}
                  aria-label={`Show photo ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === carouselIndex ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Every photo displays in the same fixed-size square tile (object-cover fits/crops it
        // visually to fill the frame) so photo galleries look consistent from one profile to the
        // next, regardless of what aspect ratio each original upload happens to be. This is
        // purely a display crop — the stored file itself is never touched. Row scrolls
        // horizontally if photos don't all fit — on mobile the tile width is viewport-relative
        // (not a fixed size) specifically so one photo nearly fills the screen with a deliberate
        // peek of the next one poking in from the right, signaling "swipe for more."
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setLightboxIndex(i)}
              aria-label={`Expand photo ${i + 1}`}
              className="aspect-square w-[78vw] max-w-80 shrink-0 cursor-zoom-in overflow-hidden rounded-2xl bg-spruce-tint sm:h-80 sm:w-80"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`${alt}, photo ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded photo"
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4"
              aria-label="Previous photo"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden="true">
                <path d="M12 4 6 10l6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightboxIndex].url}
            alt={`${alt}, photo ${lightboxIndex + 1}, expanded`}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4"
              aria-label="Next photo"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden="true">
                <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {photos.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
              {lightboxIndex + 1} / {photos.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
