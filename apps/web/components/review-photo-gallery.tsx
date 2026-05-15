"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { UnoptimizedImage } from "@/components/unoptimized-image";

type ReviewPhotoGalleryProps = {
  urls: string[];
  cardRadius?: number;
  borderColor?: string;
  gridClassName?: string;
};

export default function ReviewPhotoGallery({
  urls,
  cardRadius = 12,
  borderColor = "var(--review-card-border)",
  gridClassName = "mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4",
}: ReviewPhotoGalleryProps) {
  const photos = urls.filter(Boolean).slice(0, 8);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<0 | 1 | 2 | 3>(0);

  const activeUrl = activeIndex == null ? null : photos[activeIndex] ?? null;
  const canNavigate = photos.length > 1;
  const zoomScale = zoomLevel === 0 ? 1 : zoomLevel === 1 ? 1.35 : zoomLevel === 2 ? 1.8 : 2.35;

  useEffect(() => {
    if (!activeUrl) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (zoomLevel > 0) {
          setZoomLevel(0);
          return;
        }
        setActiveIndex(null);
      }
      if (event.key === "ArrowRight" && canNavigate) {
        setZoomLevel(0);
        setActiveIndex((current) => (current == null || current >= photos.length - 1 ? 0 : current + 1));
      }
      if (event.key === "ArrowLeft" && canNavigate) {
        setZoomLevel(0);
        setActiveIndex((current) => (current == null || current <= 0 ? photos.length - 1 : current - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeUrl, canNavigate, photos.length, zoomLevel]);

  if (photos.length === 0) return null;

  const thumbnailStyle: CSSProperties = {
    borderColor,
    borderRadius: Math.min(cardRadius, 12),
  };

  return (
    <>
      <div className={gridClassName}>
        {photos.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            className="group aspect-square overflow-hidden border text-left outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-black/20"
            style={thumbnailStyle}
            onClick={() => {
              setActiveIndex(index);
              setZoomLevel(0);
            }}
            aria-label="Открыть фотографию отзыва"
          >
            <UnoptimizedImage src={url} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>

      {activeUrl ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => {
              setActiveIndex(null);
              setZoomLevel(0);
            }}
            className="fixed right-8 top-6 z-[410] text-5xl font-light leading-none text-slate-800 opacity-80 transition hover:opacity-100"
            aria-label="Закрыть"
          >
            ×
          </button>

          <div className="fixed right-24 top-8 z-[410] flex items-center gap-4">
            <button
              type="button"
              onClick={() => setZoomLevel((current) => (current <= 0 ? 0 : ((current - 1) as 0 | 1 | 2 | 3)))}
              className="text-4xl leading-none text-slate-800 opacity-80 transition hover:opacity-100 disabled:opacity-30"
              disabled={zoomLevel === 0}
              aria-label="Уменьшить"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((current) => (current >= 3 ? 3 : ((current + 1) as 0 | 1 | 2 | 3)))}
              className="text-4xl leading-none text-slate-800 opacity-80 transition hover:opacity-100 disabled:opacity-30"
              disabled={zoomLevel === 3}
              aria-label="Увеличить"
            >
              +
            </button>
          </div>

          {canNavigate ? (
            <button
              type="button"
              onClick={() => {
                setZoomLevel(0);
                setActiveIndex((current) => (current == null || current <= 0 ? photos.length - 1 : current - 1));
              }}
              className="fixed left-8 top-1/2 z-[410] -translate-y-1/2 text-6xl leading-none text-slate-800 opacity-60 transition hover:opacity-90"
              aria-label="Предыдущая фотография"
            >
              ‹
            </button>
          ) : null}

          <div className="flex h-[calc(100vh-112px)] w-[min(92vw,1280px)] items-center justify-center overflow-hidden">
            <UnoptimizedImage
              src={activeUrl}
              alt=""
              className="max-h-full max-w-full cursor-zoom-in object-contain transition-transform duration-150"
              style={{
                transform: `scale(${zoomScale})`,
                cursor: zoomLevel >= 3 ? "zoom-out" : "zoom-in",
              }}
              onClick={() => setZoomLevel((current) => (current >= 3 ? 0 : ((current + 1) as 0 | 1 | 2 | 3)))}
              draggable={false}
            />
          </div>

          {canNavigate ? (
            <button
              type="button"
              onClick={() => {
                setZoomLevel(0);
                setActiveIndex((current) => (current == null || current >= photos.length - 1 ? 0 : current + 1));
              }}
              className="fixed right-8 top-1/2 z-[410] -translate-y-1/2 text-6xl leading-none text-slate-800 opacity-60 transition hover:opacity-90"
              aria-label="Следующая фотография"
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
