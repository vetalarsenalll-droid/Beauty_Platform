"use client";

import { useEffect, useMemo, useState } from "react";
import type { HeroSlide } from "@/lib/marketplace-hero";

type HomeHeroSliderProps = {
  slides: HeroSlide[];
  variant: "large" | "compact";
};

function useAutoAdvance(total: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (total <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, 6000);
    return () => window.clearInterval(id);
  }, [total]);

  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [index, total]);

  return { index, setIndex };
}

export default function HomeHeroSlider({ slides, variant }: HomeHeroSliderProps) {
  const total = slides.length;
  const { index, setIndex } = useAutoAdvance(total);
  const dots = useMemo(() => Array.from({ length: total }, (_, i) => i), [total]);
  const slide = slides[index];

  if (!slide) return null;

  const isCompact = variant === "compact";
  const heightClass = isCompact
    ? "h-[190px]"
    : "h-[calc(2*190px+16px)]";

  return (
    <div className="flex flex-col gap-3">
      <a
        href={slide.url ?? "#"}
        className={`group relative overflow-hidden rounded-[28px] border border-[color:var(--bp-stroke)] shadow-[var(--bp-shadow)] ${heightClass}`}
        style={{
          backgroundImage: `url(${slide.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className={`absolute inset-0 ${
            isCompact
              ? "bg-gradient-to-br from-black/70 via-black/35 to-black/10"
              : "bg-gradient-to-r from-black/70 via-black/35 to-black/5"
          }`}
        />
        <div className="relative z-10 flex h-full flex-col gap-3 p-6 text-white">
          {slide.tag ? (
            <span className="w-fit rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]">
              {slide.tag}
            </span>
          ) : null}
          <div className={isCompact ? "text-lg font-semibold" : "text-4xl font-semibold leading-tight"}>
            {slide.title}
          </div>
          {slide.subtitle ? (
            <div className={isCompact ? "text-sm text-white/90" : "text-lg text-white/90"}>
              {slide.subtitle}
            </div>
          ) : null}
          {slide.description ? (
            <p className={isCompact ? "text-xs text-white/85" : "text-sm text-white/85"}>
              {slide.description}
            </p>
          ) : null}
          {!isCompact && slide.ctaLabel ? (
            <div className="mt-auto flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-[color:var(--bp-ink)]">
                {slide.ctaLabel}
              </span>
              {slide.badge ? (
                <span className="inline-flex items-center rounded-2xl border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white">
                  {slide.badge}
                </span>
              ) : null}
            </div>
          ) : slide.badge ? (
            <span className="inline-flex w-fit items-center rounded-2xl border border-white/30 bg-white/10 px-4 py-2 text-[11px] font-semibold text-white">
              {slide.badge}
            </span>
          ) : null}
        </div>
      </a>
      {total > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {dots.map((dot) => (
            <button
              key={dot}
              type="button"
              onClick={() => setIndex(dot)}
              className={`h-2 w-2 rounded-full transition ${
                dot === index ? "bg-[color:var(--bp-accent)]" : "bg-[color:var(--bp-stroke)]"
              }`}
              aria-label={`Слайд ${dot + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
