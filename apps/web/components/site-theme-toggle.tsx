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
    "--site-client-card-bg": palette.clientCardBg,
    "--site-client-button": palette.clientButtonColor,
    "--site-client-button-text": palette.clientButtonTextColor,
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
  const storageKey = "site-theme-mode";
  const cookieKey = "site-theme-mode";
  const getCookieMode = () => {
    if (typeof document === "undefined") return null;
    const match = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${cookieKey}=`));
    if (!match) return null;
    const value = decodeURIComponent(match.split("=")[1] ?? "");
    return value === "light" || value === "dark" ? value : null;
  };
  const getStoredMode = () => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark") return stored;
    return getCookieMode();
  };
  const [currentMode, setCurrentMode] = useState<"light" | "dark">(mode);
  const lightVars = useMemo(() => paletteToVars(lightPalette), [lightPalette]);
  const darkVars = useMemo(() => paletteToVars(darkPalette), [darkPalette]);

  const applyMode = (nextMode: "light" | "dark") => {
    const target =
      document.getElementById(targetId) ?? document.documentElement;
    const vars = nextMode === "dark" ? darkVars : lightVars;
    Object.entries(vars).forEach(([key, value]) => {
      target.style.setProperty(key, value);
    });
    const suffix = nextMode === "dark" ? "dark" : "light";
    const clientCard = target.style
      .getPropertyValue(`--site-client-card-bg-${suffix}`)
      .trim();
    const clientButton = target.style
      .getPropertyValue(`--site-client-button-${suffix}`)
      .trim();
    const clientButtonText = target.style
      .getPropertyValue(`--site-client-button-text-${suffix}`)
      .trim();
    const siteRadius = target.style.getPropertyValue(`--site-radius-${suffix}`).trim();
    const siteButtonRadius = target.style
      .getPropertyValue(`--site-button-radius-${suffix}`)
      .trim();
    if (clientCard) target.style.setProperty("--site-client-card-bg", clientCard);
    if (clientButton) target.style.setProperty("--site-client-button", clientButton);
    if (clientButtonText) target.style.setProperty("--site-client-button-text", clientButtonText);
    if (siteRadius) target.style.setProperty("--site-radius", siteRadius);
    if (siteButtonRadius) target.style.setProperty("--site-button-radius", siteButtonRadius);
    target.setAttribute("data-site-theme", nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, nextMode);
      document.cookie = `${cookieKey}=${nextMode}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new CustomEvent("site-theme-change", { detail: { mode: nextMode } }));
    }
  };

  useEffect(() => {
    const stored = getStoredMode();
    if (stored && stored !== currentMode) {
      setCurrentMode(stored);
      applyMode(stored);
      return;
    }
    applyMode(currentMode);
  }, [currentMode, darkVars, lightVars, targetId]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        setCurrentMode(event.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const nextMode = currentMode === "dark" ? "light" : "dark";
        applyMode(nextMode);
        setCurrentMode(nextMode);
      }}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]"
      aria-label="Переключить тему"
      title="Переключить тему"
    >
      {currentMode === "dark" ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12.741 20.917a9.389 9.389 0 0 1-1.395-.105a9.141 9.141 0 0 1-1.465-17.7a1.177 1.177 0 0 1 1.21.281a1.273 1.273 0 0 1 .325 1.293a8.112 8.112 0 0 0-.353 2.68a8.266 8.266 0 0 0 4.366 6.857a7.628 7.628 0 0 0 3.711.993a1.242 1.242 0 0 1 .994 1.963a9.148 9.148 0 0 1-7.393 3.738ZM10.261 4.05a.211.211 0 0 0-.065.011a8.137 8.137 0 1 0 9.131 12.526a.224.224 0 0 0 .013-.235a.232.232 0 0 0-.206-.136a8.619 8.619 0 0 1-4.188-1.116a9.274 9.274 0 0 1-4.883-7.7a9.123 9.123 0 0 1 .4-3.008a.286.286 0 0 0-.069-.285a.184.184 0 0 0-.133-.057Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </g>
        </svg>
      )}
    </button>
  );
}
