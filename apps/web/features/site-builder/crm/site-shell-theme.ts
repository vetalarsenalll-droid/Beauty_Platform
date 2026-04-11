import type { SiteTheme } from "@/lib/site-builder";

export type PanelTheme = {
  surface: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  save: string;
  saveClose: string;
};

export function resolvePanelTheme(mode: SiteTheme["mode"]): PanelTheme {
  if (mode === "dark") {
    return {
      surface: "#14161a",
      panel: "#16181d",
      border: "#ffffff14",
      text: "#f2f3f5",
      muted: "#a1a5ad",
      accent: "#d3d6db",
      save: "#0f1012",
      saveClose: "#1a1c22",
    };
  }

  return {
    surface: "#ffffff",
    panel: "#ffffff",
    border: "#d9dde5",
    text: "#111827",
    muted: "#6b7280",
    accent: "#2563eb",
    save: "#000000",
    saveClose: "#ff5a5f",
  };
}

export function buildThemeStyle(activeTheme: SiteTheme): Record<string, string> {
  const globalBorderColor = activeTheme.borderColor?.trim() || "transparent";
  return {
    "--bp-accent": activeTheme.accentColor,
    "--bp-surface": activeTheme.surfaceColor,
    "--bp-paper": activeTheme.panelColor,
    "--bp-panel": activeTheme.panelColor,
    "--bp-ink": activeTheme.textColor,
    "--bp-muted": activeTheme.mutedColor,
    "--bp-stroke": globalBorderColor,
    "--site-accent": activeTheme.accentColor,
    "--site-surface": activeTheme.surfaceColor,
    "--site-panel": activeTheme.panelColor,
    "--site-text": activeTheme.textColor,
    "--site-muted": activeTheme.mutedColor,
    "--site-font-heading": activeTheme.fontHeading,
    "--site-font-body": activeTheme.fontBody,
    "--site-border": globalBorderColor,
    "--site-button": activeTheme.buttonColor,
    "--site-button-text": activeTheme.buttonTextColor,
    "--site-shadow-color": activeTheme.shadowColor,
    "--site-shadow-size": `${activeTheme.shadowSize}px`,
    "--site-radius": `${activeTheme.radius}px`,
    "--site-button-radius": `${activeTheme.buttonRadius}px`,
    "--site-gap": `${activeTheme.blockSpacing}px`,
    "--site-h1": `${activeTheme.headingSize}px`,
    "--site-h2": `${activeTheme.subheadingSize}px`,
    "--site-text-size": `${activeTheme.textSize}px`,
  };
}

