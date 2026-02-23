"use client";

import { useEffect, useState } from "react";

type GallerySliderProps = {
  images: string[];
  height: number;
  radius: number;
  imageFit?: "cover" | "contain";
  imageBorderColor?: string;
  imageBorderWidth?: number;
  imageShadow?: string;
  showDots?: boolean;
  arrowColor?: string;
  arrowBgColor?: string;
  dotActiveColor?: string;
  dotInactiveColor?: string;
  arrowVariant?: "chevron" | "angle" | "triangle";
  className?: string;
};

export default function GallerySlider({
  images,
  height,
  radius,
  imageFit = "cover",
  imageBorderColor = "transparent",
  imageBorderWidth = 0,
  imageShadow = "none",
  showDots = true,
  arrowColor = "var(--bp-ink)",
  arrowBgColor = "#ffffffd1",
  dotActiveColor = "var(--bp-ink)",
  dotInactiveColor = "var(--bp-muted)",
  arrowVariant = "chevron",
  className = "",
}: GallerySliderProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length === 0) {
      setCurrent(0);
      return;
    }
    if (current >= images.length) {
      setCurrent(images.length - 1);
    }
  }, [current, images.length]);

  if (images.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-[color:var(--bp-stroke)] text-sm text-[color:var(--bp-muted)] ${className}`}
        style={{ height }}
      >
        Нет фото для галереи.
      </div>
    );
  }

  const canSlide = images.length > 1;
  const prev = () => setCurrent((value) => (value - 1 + images.length) % images.length);
  const next = () => setCurrent((value) => (value + 1) % images.length);
  const leftArrow = arrowVariant === "triangle" ? "◀" : arrowVariant === "angle" ? "❮" : "‹";
  const rightArrow = arrowVariant === "triangle" ? "▶" : arrowVariant === "angle" ? "❯" : "›";

  return (
    <div className={`relative ${className}`}>
      <div
        className="relative overflow-hidden bg-[color:var(--bp-paper)]"
        style={{
          height,
          borderRadius: radius,
          borderColor: imageBorderColor,
          borderWidth: imageBorderWidth,
          borderStyle: imageBorderWidth > 0 ? "solid" : "none",
          boxShadow: imageShadow,
          boxSizing: "border-box",
        }}
      >
        <img
          src={images[current]}
          alt=""
          className="h-full w-full"
          style={{ objectFit: imageFit }}
        />

      </div>

      {canSlide && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-transparent text-xl text-[color:var(--bp-ink)] shadow-sm backdrop-blur"
            style={{ color: arrowColor, backgroundColor: arrowBgColor }}
            aria-label="Предыдущее фото"
            title="Предыдущее фото"
          >
            {leftArrow}
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-transparent text-xl text-[color:var(--bp-ink)] shadow-sm backdrop-blur"
            style={{ color: arrowColor, backgroundColor: arrowBgColor }}
            aria-label="Следующее фото"
            title="Следующее фото"
          >
            {rightArrow}
          </button>
        </>
      )}

      {showDots && canSlide && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrent(index)}
              className="h-2.5 w-2.5 rounded-full transition"
              style={{ backgroundColor: index === current ? dotActiveColor : dotInactiveColor }}
              aria-label={`Слайд ${index + 1}`}
              title={`Слайд ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
