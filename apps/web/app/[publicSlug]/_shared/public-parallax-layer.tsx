"use client";

import { useEffect, useRef, useState } from "react";

type PublicParallaxLayerProps = {
  imageUrl: string;
  speed?: number;
  maxOffset?: number;
  scale?: number;
};

export default function PublicParallaxLayer({
  imageUrl,
  speed = 0.22,
  maxOffset = 140,
  scale = 1.12,
}: PublicParallaxLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let rafId: number | null = null;
    const update = () => {
      const layer = layerRef.current;
      const section = layer?.parentElement;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const sectionCenter = rect.top + rect.height / 2;
      const delta = sectionCenter - viewportCenter;
      const next = Math.max(-maxOffset, Math.min(maxOffset, delta * -speed));
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
  }, [maxOffset, speed]);

  return (
    <div
      ref={layerRef}
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transform: `translate3d(0, ${offset.toFixed(1)}px, 0) scale(${scale})`,
        transformOrigin: "center",
        willChange: "transform",
      }}
      aria-hidden="true"
    />
  );
}

