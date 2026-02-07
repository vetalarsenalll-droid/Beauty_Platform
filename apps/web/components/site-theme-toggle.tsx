"use client";

import { useEffect, useMemo, useState } from "react";
import type { SiteThemePalette } from "@/lib/site-builder";

type SiteThemeToggleProps = {
  mode: "light" | "dark";
  lightPalette: SiteThemePalette;
  darkPalette: SiteThemePalette;
  targetId?: string;
};

const paletteToVars = (palette: SiteThemePalette) => {
  const gradient = palette.gradientEnabled
    ? `linear-gradient(${palette.gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${palette.gradientFrom}, ${palette.gradientTo})`
    : "none";

  return {
    "--bp-accent": palette.accentColor,
    "--bp-surface": palette.surfaceColor,
    "--bp-panel": palette.panelColor,
    "--bp-ink": palette.textColor,
    "--bp-muted": palette.mutedColor,
    "--bp-stroke": palette.borderColor,
    "--site-accent": palette.accentColor,
    "--site-surface": palette.surfaceColor,
    "--site-panel": palette.panelColor,
    "--site-text": palette.textColor,
    "--site-muted": palette.mutedColor,
    "--site-font-heading": palette.fontHeading,
    "--site-font-body": palette.fontBody,
    "--site-border": palette.borderColor,
    "--site-button": palette.buttonColor,
    "--site-button-text": palette.buttonTextColor,
    "--site-shadow-color": palette.shadowColor,
    "--site-shadow-size": `${palette.shadowSize}px`,
    "--site-radius": `${palette.radius}px`,
    "--site-button-radius": `${palette.buttonRadius}px`,
    "--site-gap": `${palette.blockSpacing}px`,
    "--site-h1": `${palette.headingSize}px`,
    "--site-h2": `${palette.subheadingSize}px`,
    "--site-text-size": `${palette.textSize}px`,
    "--site-gradient": gradient,
  } as const;
};

export default function SiteThemeToggle({
  mode,
  lightPalette,
  darkPalette,
  targetId = "public-site-root",
}: SiteThemeToggleProps) {
  const [currentMode, setCurrentMode] = useState<"light" | "dark">(mode);
  const lightVars = useMemo(() => paletteToVars(lightPalette), [lightPalette]);
  const darkVars = useMemo(() => paletteToVars(darkPalette), [darkPalette]);

  useEffect(() => {
    const target =
      document.getElementById(targetId) ?? document.documentElement;
    const vars = currentMode === "dark" ? darkVars : lightVars;
    Object.entries(vars).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });
    target.setAttribute("data-site-theme", currentMode);
  }, [currentMode, darkVars, lightVars, targetId]);

  return (
    <button
      type="button"
      onClick={() =>
        setCurrentMode((prev) => (prev === "dark" ? "light" : "dark"))
      }
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--site-border)] bg-[color:var(--bp-panel)] text-[color:var(--bp-ink)]"
      aria-label="Переключить тему"
      title="Переключить тему"
    >
      {currentMode === "dark" ? "D" : "L"}
    </button>
  );
}
