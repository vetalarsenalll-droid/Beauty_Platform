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
      onMouseDown={() => onSurfaceClick()}
      className={`fixed z-[220] overflow-y-auto overflow-x-visible border shadow-[var(--bp-shadow)] transition-all duration-[220ms] ease-out [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
        isRightPanelVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
      } ${
        activeThemeMode === "dark"
          ? "[&_input]:border-[#2b2b2b] [&_input]:bg-transparent [&_input]:text-[#f3f4f6] [&_input]:[color-scheme:dark] [&_select]:border-[#2b2b2b] [&_select]:bg-transparent [&_select]:text-[#f3f4f6] [&_select]:[color-scheme:dark] [&_textarea]:border-[#2b2b2b] [&_textarea]:bg-transparent [&_textarea]:text-[#f3f4f6] [&_textarea]:[color-scheme:dark] [&_option]:bg-[color:var(--bp-paper)] [&_option]:text-[#f3f4f6]"
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
        "--input-bg": activeThemeMode === "dark" ? "transparent" : "#ffffff",
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
        <div
          className="cursor-pointer border-t px-4 py-3"
          style={{ borderColor: panelTheme.border }}
          onClick={onSurfaceClick}
        >
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

