import type { ReactNode } from "react";
import type { SiteTheme } from "@/lib/site-builder";
import type { PanelTheme } from "./site-shell-theme";
import type { CssVars } from "./site-client-core";

type SiteRightPanelFrameProps = {
  rightPanel: "content" | "settings" | null;
  isRightPanelVisible: boolean;
  activeThemeMode: SiteTheme["mode"];
  floatingPanelsTop: number;
  panelTheme: PanelTheme;
  panelTitle: string;
  saving: string | null;
  onSave: () => void;
  onSaveAndClose: () => void;
  onSurfaceClick: () => void;
  children: ReactNode;
};

export function SiteRightPanelFrame({
  rightPanel,
  isRightPanelVisible,
  activeThemeMode,
  floatingPanelsTop,
  panelTheme,
  panelTitle,
  saving,
  onSave,
  onSaveAndClose,
  onSurfaceClick,
  children,
}: SiteRightPanelFrameProps) {
  if (!rightPanel) return null;

  return (
    <aside
      className={`fixed z-[220] overflow-y-auto overflow-x-visible border shadow-[var(--bp-shadow)] transition-all duration-[220ms] ease-out [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
        isRightPanelVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
      } ${
        activeThemeMode === "dark"
          ? "[&_input]:border-[#2b2b2b] [&_input]:bg-[color:var(--bp-surface)] [&_input]:text-[#f3f4f6] [&_select]:border-[#2b2b2b] [&_select]:bg-[color:var(--bp-surface)] [&_select]:text-[#f3f4f6] [&_textarea]:border-[#2b2b2b] [&_textarea]:bg-[color:var(--bp-surface)] [&_textarea]:text-[#f3f4f6] [&_option]:bg-[color:var(--bp-surface)] [&_option]:text-[#f3f4f6]"
          : ""
      }`}
      style={{
        top: floatingPanelsTop,
        bottom: 0,
        left: 0,
        width: rightPanel === "content" ? "min(820px, 56vw)" : "360px",
        borderColor: panelTheme.border,
        backgroundColor: panelTheme.surface,
        color: panelTheme.text,
        accentColor: panelTheme.accent,
        colorScheme: activeThemeMode,
        "--bp-paper": panelTheme.panel,
        "--bp-surface": panelTheme.surface,
        "--bp-stroke": panelTheme.border,
        "--bp-ink": panelTheme.text,
        "--bp-muted": panelTheme.muted,
        "--bp-accent": panelTheme.accent,
        "--bp-save-close": panelTheme.saveClose,
        "--input-bg": activeThemeMode === "dark" ? panelTheme.surface : "#ffffff",
        "--text": panelTheme.text,
        "--border": panelTheme.border,
        "--muted": panelTheme.muted,
      } as CssVars}
    >
      <div
        className="sticky top-0 z-20 border-b"
        style={{ borderColor: panelTheme.border, backgroundColor: panelTheme.surface }}
      >
        <div className="grid grid-cols-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving === "public"}
            className="h-12 px-3 text-xs font-medium whitespace-nowrap text-white disabled:opacity-60"
            style={{ backgroundColor: panelTheme.save }}
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onSaveAndClose}
            disabled={saving === "public"}
            className="h-12 px-3 text-xs font-medium whitespace-nowrap text-white disabled:opacity-60"
            style={{ backgroundColor: panelTheme.saveClose }}
          >
            Сохранить и закрыть
          </button>
        </div>
        <div className="border-t px-4 py-3" style={{ borderColor: panelTheme.border }}>
          <div className="text-sm font-semibold" style={{ color: panelTheme.text }}>
            {panelTitle}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3 pb-12" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </aside>
  );
}

