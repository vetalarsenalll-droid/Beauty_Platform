"use client";

import { useEffect, useRef, useState } from "react";

type PublicParallaxLayerProps = {
  imageUrl: string;
  backgroundPosition?: string;
};

export default function PublicParallaxLayer({
  imageUrl,
  backgroundPosition = "center center",
}: PublicParallaxLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let baselineDelta: number | null = null;
    let rafId: number | null = null;
    const update = () => {
      const layer = layerRef.current;
      const section = layer?.parentElement;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const sectionCenter = rect.top + rect.height / 2;
      const delta = sectionCenter - viewportCenter;
      if (baselineDelta === null) {
        baselineDelta = delta;
      }
      const relativeDelta = delta - baselineDelta;
      const next = Math.max(-140, Math.min(140, relativeDelta * -0.22));
      setOffset(next);
    };
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const scale = 1 + Math.min(0.12, Math.abs(offset) / 1200);

  return (
    <div
      ref={layerRef}
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition,
        transform: `translate3d(0, ${offset.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`,
        transformOrigin: "center",
        willChange: "transform",
      }}
      aria-hidden="true"
    />
  );
}
