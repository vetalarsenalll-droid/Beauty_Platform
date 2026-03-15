"use client";

import { useEffect, useMemo, useState } from "react";
import type { HeroSlide } from "@/lib/marketplace-hero";

type HomeHeroSliderProps = {
  slides: HeroSlide[];
  variant: "large" | "compact";
  intervalMs?: number;
  showDots?: boolean;
  pauseOnHover?: boolean;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  paused?: boolean;
  disableAuto?: boolean;
};

export default function HomeHeroSlider({
  slides,
  variant,
  intervalMs = 6000,
  showDots = true,
  pauseOnHover = true,
  currentIndex,
  onIndexChange,
  paused,
  disableAuto = false,
}: HomeHeroSliderProps) {
  const total = slides.length;
  const isControlled = typeof currentIndex === "number";
  const [pausedInternal, setPausedInternal] = useState(false);
  const [indexInternal, setIndexInternal] = useState(0);
  const effectivePaused = paused ?? pausedInternal;

  const index = isControlled ? (currentIndex ?? 0) : indexInternal;
  const setIndex = (next: number) => {
    if (isControlled) {
      onIndexChange?.(next);
    } else {
      setIndexInternal(next);
    }
  };

  useEffect(() => {
    if (isControlled || disableAuto) return;
    if (total <= 1 || effectivePaused || intervalMs <= 0) return;
    const id = window.setInterval(() => {
      setIndexInternal((prev) => (prev + 1) % total);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isControlled, disableAuto, total, intervalMs, effectivePaused]);

  useEffect(() => {
    if (!isControlled && indexInternal >= total) setIndexInternal(0);
  }, [indexInternal, total, isControlled]);

  const [progressKey, setProgressKey] = useState(0);
  useEffect(() => {
    setProgressKey((prev) => prev + 1);
  }, [index, intervalMs]);
  const dots = useMemo(() => Array.from({ length: total }, (_, i) => i), [total]);
  const safeIndex = total ? ((index % total) + total) % total : 0;
  const slide = slides[safeIndex];

  if (!slide) return null;

  const isCompact = variant === "compact";
  const heightStyle = isCompact
    ? "var(--hero-compact-h, 190px)"
    : "calc(var(--hero-compact-h, 190px) * 2 + var(--hero-compact-gap, 16px))";

  return (
    <div className="relative flex flex-col gap-3">
      <a
        href={slide.url ?? "#"}
        className="group relative overflow-hidden rounded-[28px] border border-[color:var(--bp-stroke)] shadow-[var(--bp-shadow)]"
        style={{
          backgroundImage: `url(${slide.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          height: heightStyle,
        }}
        onMouseEnter={() => pauseOnHover && paused === undefined && setPausedInternal(true)}
        onMouseLeave={() => pauseOnHover && paused === undefined && setPausedInternal(false)}
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
          <div className={isCompact ? "text-base font-semibold" : "text-4xl font-semibold leading-tight"}>
            {slide.title}
          </div>
          {slide.subtitle ? (
            <div className={isCompact ? "text-xs text-white/90" : "text-lg text-white/90"}>
              {slide.subtitle}
            </div>
          ) : null}
          {slide.description ? (
            <p className={isCompact ? "text-[11px] text-white/85" : "text-sm text-white/85"}>
              {slide.description}
            </p>
          ) : null}
          {slide.ctaLabel ? (
            <div className={isCompact ? "mt-auto" : "mt-auto flex flex-wrap items-center gap-3"}>
              <span
                className={
                  isCompact
                    ? "inline-flex items-center rounded-2xl border border-white/30 bg-white/10 px-3 py-2 text-[11px] font-semibold text-white"
                    : "inline-flex items-center rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-[color:var(--bp-ink)]"
                }
              >
                {slide.ctaLabel}
              </span>
            </div>
          ) : null}
        </div>
      </a>
      {showDots && total > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2">
          {dots.map((dot) => {
            const active = dot === safeIndex;
            return (
              <button
                key={dot}
                type="button"
                onClick={() => setIndex(dot)}
                className={`relative h-2 overflow-hidden rounded-full transition ${
                  active ? "w-10 bg-[color:var(--bp-stroke)]" : "w-2 bg-[color:var(--bp-stroke)]"
                }`}
                aria-label={`Слайд ${dot + 1}`}
              >
                {active ? (
                  <span
                    key={`${progressKey}-${dot}`}
                    className="absolute inset-0 origin-left rounded-full bg-[color:var(--bp-accent)]"
                    style={{
                      animationName: "bp-slide-progress",
                      animationDuration: `${intervalMs}ms`,
                      animationTimingFunction: "linear",
                      animationFillMode: "forwards",
                      animationPlayState: effectivePaused ? "paused" : "running",
                    }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
