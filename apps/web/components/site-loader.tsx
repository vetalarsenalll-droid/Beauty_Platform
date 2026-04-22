"use client";

import type { CSSProperties } from "react";
import type { SiteLoaderConfig } from "@/lib/site-builder";

const dotDelays = ["0ms", "120ms", "240ms"];

export default function SiteLoader({
  config,
  className = "",
}: {
  config: SiteLoaderConfig;
  className?: string;
}) {
  const size = Math.max(16, config.size);
  const maxThickness = Math.max(2, Math.floor(size / 6));
  const thickness = Math.min(maxThickness, Math.max(1, config.thickness));
  const speedMs = Math.max(300, config.speedMs);
  const duration = `${speedMs}ms`;

  if (config.visual === "dots") {
    const dotSize = Math.max(4, Math.round(size / 4 + config.thickness / 2));
    const dotGap = Math.max(2, Math.round(config.thickness / 2));
    return (
      <div className={`inline-flex items-center justify-center ${className}`} style={{ gap: dotGap }}>
        {dotDelays.map((_, idx) => (
          <span
            key={idx}
            className="inline-block rounded-full"
            style={
              {
                width: dotSize,
                height: dotSize,
                backgroundColor: config.color,
                animationName: "site-loader-wave",
                animationDuration: duration,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationDelay: `${Math.round((speedMs / 3) * idx)}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }

  if (config.visual === "pulse") {
    return (
      <span
        className={`relative inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={
            {
              borderWidth: thickness,
              borderStyle: "solid",
              borderColor: config.color,
              animationName: "site-loader-pulse-ring",
              animationDuration: duration,
              animationTimingFunction: "ease-out",
              animationIterationCount: "infinite",
            } as CSSProperties
          }
        />
        <span
          className="rounded-full"
          style={{
            width: Math.max(4, Math.round(size * 0.34)),
            height: Math.max(4, Math.round(size * 0.34)),
            backgroundColor: config.color,
            animationName: "site-loader-pulse-core",
            animationDuration: duration,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
          }}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-block rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        borderWidth: thickness,
        borderStyle: "solid",
        borderTopColor: "transparent",
        borderRightColor: config.color,
        borderBottomColor: config.color,
        borderLeftColor: config.color,
        animation: `spin ${duration} linear infinite`,
      }}
    />
  );
}
