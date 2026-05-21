import type { Dispatch, SetStateAction } from "react";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";
import type { EditorSection } from "./site-client-core";
import { COVER_LINE_OPTIONS, COVER_LINE_STEP_PX, formatCoverLineLabel } from "./site-client-core";
import { renderCoverFlatNumberInput } from "./cover-settings";
import { normalizeBlockStyle, updateBlockStyle } from "./site-renderer";
import type { PanelTheme } from "./site-shell-theme";

type UpdateBlock = (
  id: string,
  updater: (block: SiteBlock) => SiteBlock,
  options?: { recordHistory?: boolean }
) => void;

type SiteMenuSettingsPrimaryProps = {
  selectedBlock: SiteBlock;
  activeTheme: SiteTheme;
  panelTheme: PanelTheme;
  currentPanelSections: EditorSection[];
  setActivePanelSectionId: Dispatch<SetStateAction<string | null>>;
  coverDrawerKey: "slider" | "colors" | "typography" | "button" | "animation" | null;
  setCoverDrawerKey: Dispatch<
    SetStateAction<"slider" | "colors" | "typography" | "button" | "animation" | null>
  >;
  updateBlock: UpdateBlock;
};

export function SiteMenuSettingsPrimary({
  selectedBlock,
  activeTheme,
  panelTheme,
  currentPanelSections,
  setActivePanelSectionId,
  coverDrawerKey,
  setCoverDrawerKey,
  updateBlock,
}: SiteMenuSettingsPrimaryProps) {
  const data = (selectedBlock.data as Record<string, unknown>) ?? {};
  const style = normalizeBlockStyle(selectedBlock, activeTheme);
  const menuHeightRaw = Number(data.menuHeight);
  const menuHeightMin = selectedBlock.variant === "v1" ? 40 : 30;
  const menuHeight =
    Number.isFinite(menuHeightRaw) &&
    menuHeightRaw >= menuHeightMin &&
    menuHeightRaw <= 96
      ? Math.round(menuHeightRaw)
      : selectedBlock.variant === "v1"
        ? 64
        : 56;

  const updateData = (patch: Record<string, unknown>) => {
    updateBlock(selectedBlock.id, (prev) => ({
      ...prev,
      data: {
        ...(prev.data as Record<string, unknown>),
        ...patch,
      },
    }));
  };

  const applyMenuHeight = (value: number) => {
    updateData({ menuHeight: value });
  };
  const socialIconSizeRaw = Number(data.socialIconSize);
  const socialIconSize = Number.isFinite(socialIconSizeRaw)
    ? Math.max(24, Math.min(72, Math.round(socialIconSizeRaw)))
    : 40;

  const menuMarginTopLines = Math.max(
    0,
    Math.min(7, Math.round((style.marginTop / COVER_LINE_STEP_PX) * 2) / 2)
  );
  const menuMarginBottomLines = Math.max(
    0,
    Math.min(7, Math.round((style.marginBottom / COVER_LINE_STEP_PX) * 2) / 2)
  );

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      {renderCoverFlatNumberInput(
        "Высота меню",
        menuHeight,
        menuHeightMin,
        96,
        applyMenuHeight
      )}

      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        <div className="min-h-[32px] leading-4">Позиция меню</div>
        <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
          <select
            value={(data.position as string) ?? "static"}
            onChange={(event) => updateData({ position: event.target.value })}
            className="w-full appearance-none rounded-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
            style={{
              border: 0,
              borderRadius: 0,
              backgroundColor: "transparent",
              boxShadow: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
            }}
          >
            <option value="static">Статика</option>
            <option value="sticky">Фиксация при скролле</option>
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
            ▾
          </span>
        </div>
      </label>

      {renderCoverFlatNumberInput(
        "Размер иконок соцсетей",
        socialIconSize,
        24,
        72,
        (value) => updateData({ socialIconSize: value })
      )}

      <div className="space-y-3">
        {currentPanelSections
          .filter(
            (section) =>
              section.id === "colors" ||
              section.id === "typography" ||
              section.id === "button"
          )
          .sort((a, b) => {
            const order = ["colors", "typography", "button"];
            return order.indexOf(a.id) - order.indexOf(b.id);
          })
          .map((section) => {
            const drawerId = section.id as "colors" | "typography" | "button";
            const isActive = coverDrawerKey === drawerId;
            return (
              <button
                key={section.id}
                type="button"
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setActivePanelSectionId(null);
                  setCoverDrawerKey((prev) => (prev === drawerId ? null : drawerId));
                }}
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
                style={{
                  borderColor: isActive ? panelTheme.accent : panelTheme.border,
                  backgroundColor: panelTheme.panel,
                  color: isActive ? panelTheme.text : panelTheme.muted,
                }}
              >
                <span>{section.label}</span>
                <span className="text-xs">{isActive ? "‹" : "›"}</span>
              </button>
            );
          })}
      </div>

      <div className="space-y-3 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Отступ сверху
            <div className="relative mt-2">
              <select
                value={String(menuMarginTopLines)}
                onChange={(event) =>
                  updateBlock(selectedBlock.id, (prev) =>
                    updateBlockStyle(prev, {
                      marginTop: Math.round(Number(event.target.value) * COVER_LINE_STEP_PX),
                    })
                  )
                }
                className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                style={{
                  borderTop: "0",
                  borderLeft: "0",
                  borderRight: "0",
                  borderRadius: "0",
                  boxShadow: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  appearance: "none",
                }}
              >
                {COVER_LINE_OPTIONS.map((lineValue) => (
                  <option key={`menu-top-main-${lineValue}`} value={lineValue}>
                    {formatCoverLineLabel(lineValue)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
            </div>
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Отступ снизу
            <div className="relative mt-2">
              <select
                value={String(menuMarginBottomLines)}
                onChange={(event) =>
                  updateBlock(selectedBlock.id, (prev) =>
                    updateBlockStyle(prev, {
                      marginBottom: Math.round(Number(event.target.value) * COVER_LINE_STEP_PX),
                    })
                  )
                }
                className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                style={{
                  borderTop: "0",
                  borderLeft: "0",
                  borderRight: "0",
                  borderRadius: "0",
                  boxShadow: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  appearance: "none",
                }}
              >
                {COVER_LINE_OPTIONS.map((lineValue) => (
                  <option key={`menu-bottom-main-${lineValue}`} value={lineValue}>
                    {formatCoverLineLabel(lineValue)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}


