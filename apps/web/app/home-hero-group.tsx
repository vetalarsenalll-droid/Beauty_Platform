"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { HeroSlide } from "@/lib/marketplace-hero";
import HomeHeroSlider from "./home-hero-slider";

type HeroSlideView = HeroSlide & { url: string };

type HomeHeroGroupProps = {
  mainSlides: HeroSlideView[];
  sideTopSlides: HeroSlideView[];
  sideBottomSlides: HeroSlideView[];
  intervalMs: number;
  showDotsMain: boolean;
  showDotsSide: boolean;
  pauseOnHover: boolean;
};

function HeroDots({
  total,
  activeIndex,
  intervalMs,
  paused,
  onSelect,
}: {
  total: number;
  activeIndex: number;
  intervalMs: number;
  paused: boolean;
  onSelect: (index: number) => void;
}) {
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    setProgressKey((prev) => prev + 1);
  }, [activeIndex, intervalMs]);

  const dots = useMemo(() => Array.from({ length: total }, (_, i) => i), [total]);

  if (total <= 1) return null;

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      {dots.map((dot) => {
        const active = dot === activeIndex;
        return (
          <button
            key={dot}
            type="button"
            onClick={() => onSelect(dot)}
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
                  animationPlayState: paused ? "paused" : "running",
                }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default function HomeHeroGroup({
  mainSlides,
  sideTopSlides,
  sideBottomSlides,
  intervalMs,
  showDotsMain,
  showDotsSide,
  pauseOnHover,
}: HomeHeroGroupProps) {
  const mainTotal = mainSlides.length;
  const sideTotal = Math.max(sideTopSlides.length, sideBottomSlides.length);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (mainTotal <= 1 || intervalMs <= 0 || paused) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % mainTotal);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [mainTotal, intervalMs, paused]);

  useEffect(() => {
    if (mainTotal > 0 && index >= mainTotal) setIndex(0);
  }, [index, mainTotal]);

  const mainIndex = mainTotal ? index % mainTotal : 0;
  const sideIndex = sideTotal ? index % sideTotal : 0;

  return (
    <section
      className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"
      style={{
        "--hero-compact-h": "190px",
        "--hero-compact-gap": "16px",
      } as CSSProperties}
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
    >
      <HomeHeroSlider
        slides={mainSlides}
        variant="large"
        intervalMs={intervalMs}
        showDots={showDotsMain}
        pauseOnHover={false}
        currentIndex={mainIndex}
        onIndexChange={setIndex}
        paused={paused}
        disableAuto
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:grid-rows-2">
        <HomeHeroSlider
          slides={sideTopSlides}
          variant="compact"
          intervalMs={intervalMs}
          showDots={false}
          pauseOnHover={false}
          currentIndex={sideIndex}
          onIndexChange={setIndex}
          paused={paused}
          disableAuto
        />
        <HomeHeroSlider
          slides={sideBottomSlides}
          variant="compact"
          intervalMs={intervalMs}
          showDots={false}
          pauseOnHover={false}
          currentIndex={sideIndex}
          onIndexChange={setIndex}
          paused={paused}
          disableAuto
        />
        {showDotsSide ? (
          <div className="col-span-2 lg:col-span-1">
            <HeroDots
              total={sideTotal}
              activeIndex={sideIndex}
              intervalMs={intervalMs}
              paused={paused}
              onSelect={setIndex}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
