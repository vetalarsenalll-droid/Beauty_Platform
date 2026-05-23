import { useState } from "react";
import {
  COVER_LINE_OPTIONS,
  COVER_LINE_STEP_PX,
  DEFAULT_BLOCK_COLUMNS,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  centeredGridRange,
  clampBlockColumns,
  clampGridColumn,
  formatCoverLineLabel,
} from "@/features/site-builder/crm/site-client-core";
import { CoverGridWidthControl, TildaBackgroundColorField } from "@/features/site-builder/crm/site-editor-panels";
import { normalizeBlockStyle, type BlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../runtime/contracts";
import {
  DarkThemeToggle,
  FlatSelect,
  SectionButton,
  rawStyle,
  readRawString,
  updateStyle,
} from "../runtime/ui/flat-panel-helpers";

function backgroundMode(value: unknown): "solid" | "linear" | "radial" {
  return value === "linear" || value === "radial" ? value : "solid";
}

function marginLines(value: number) {
  return Math.max(0, Math.min(7, Math.round((value / COVER_LINE_STEP_PX) * 2) / 2));
}

function applyGridRange(ctx: CrmPanelCtx, nextStart: number, nextEnd: number) {
  const safeStart = clampGridColumn(nextStart);
  const safeEnd = Math.max(safeStart, clampGridColumn(nextEnd));
  const nextColumns = Math.max(1, safeEnd - safeStart + 1);
  updateStyle(ctx, {
    useCustomWidth: true,
    blockWidthColumns: nextColumns,
    blockWidth: Math.round((nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
    gridStartColumn: safeStart,
    gridEndColumn: safeEnd,
  });
}

export function ProfileSettingsPanel(ctx: CrmPanelCtx) {
  const [showDarkTheme, setShowDarkTheme] = useState(false);
  const [widthPopoverOpen, setWidthPopoverOpen] = useState(false);
  const style = normalizeBlockStyle(ctx.block, ctx.activeTheme);
  const raw = rawStyle(ctx);
  const panelBorder = ctx.panelTheme.border;
  const panel = ctx.panelTheme.panel;
  const panelText = ctx.panelTheme.text;
  const panelMuted = ctx.panelTheme.muted;
  const buttonSectionId = ctx.currentPanelSections.some((section) => section.id === "buttons")
    ? "buttons"
    : "button";
  const columns = clampBlockColumns(style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, ctx.block.type);
  const fallback = centeredGridRange(columns);
  const gridStart = clampGridColumn(style.gridStartColumn ?? fallback.start);
  const gridEnd = Math.max(gridStart, clampGridColumn(style.gridEndColumn ?? fallback.end));
  const lightMode = backgroundMode(raw.servicesSectionBackgroundModeLight);
  const darkMode = backgroundMode(raw.servicesSectionBackgroundModeDark ?? raw.servicesSectionBackgroundModeLight);
  const lightBg = readRawString(ctx, "servicesSectionBackgroundFromLight", style.sectionBgLight || "#ffffff");
  const darkBg = readRawString(ctx, "servicesSectionBackgroundFromDark", style.sectionBgDark || "#16181d");

  return (
    <div className="space-y-6 px-1 pb-8 pt-1">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Ширина блока
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setWidthPopoverOpen((prev) => !prev)}
            className="mt-2 flex w-full items-center justify-between border-b pb-2 text-left text-sm"
            style={{ borderColor: panelBorder }}
          >
            <span>{Math.max(1, gridEnd - gridStart + 1)} колонок</span>
            <span className="text-sm leading-none">{widthPopoverOpen ? "^" : "v"}</span>
          </button>
          {widthPopoverOpen && (
            <div
              className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
              style={{ backgroundColor: panel, borderColor: panelBorder }}
            >
              <CoverGridWidthControl
                start={gridStart}
                end={gridEnd}
                onChange={(nextStart, nextEnd) => applyGridRange(ctx, nextStart, nextEnd)}
                compact
              />
            </div>
          )}
        </div>
      </div>

      <FlatSelect
        label="Выравнивание"
        value={style.textAlign ?? "left"}
        options={[
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ]}
        onChange={(value) =>
          updateStyle(ctx, {
            textAlign: value as BlockStyle["textAlign"],
            textAlignHeading: value as BlockStyle["textAlign"],
            textAlignSubheading: value as BlockStyle["textAlign"],
          })
        }
      />

      <div className="space-y-3">
        {ctx.currentPanelSections.some((section) => section.id === "typography") && (
          <SectionButton id="typography" label="Типографика" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "colors") && (
          <SectionButton id="colors" label="Цвета" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "button" || section.id === "buttons") && (
          <SectionButton id={buttonSectionId} label="Кнопка" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "reviews") && (
          <SectionButton id="reviews" label="Отзывы" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FlatSelect
          label="Отступ сверху"
          value={String(marginLines(style.marginTop))}
          options={COVER_LINE_OPTIONS.map((value) => ({ value: String(value), label: formatCoverLineLabel(value) }))}
          onChange={(value) => updateStyle(ctx, { marginTop: Math.round(Number(value) * COVER_LINE_STEP_PX) })}
        />
        <FlatSelect
          label="Отступ снизу"
          value={String(marginLines(style.marginBottom))}
          options={COVER_LINE_OPTIONS.map((value) => ({ value: String(value), label: formatCoverLineLabel(value) }))}
          onChange={(value) => updateStyle(ctx, { marginBottom: Math.round(Number(value) * COVER_LINE_STEP_PX) })}
        />
      </div>

      <TildaBackgroundColorField
        label="Цвет фона для всего блока"
        value={lightBg}
        mode={lightMode}
        secondValue={String(raw.servicesSectionBackgroundToLight ?? lightBg)}
        angle={Number(raw.servicesSectionBackgroundAngleLight ?? 135)}
        radialStopA={Number(raw.servicesSectionBackgroundStopALight ?? 0)}
        radialStopB={Number(raw.servicesSectionBackgroundStopBLight ?? 100)}
        placeholder="#ffffff"
        onModeChange={(mode) => updateStyle(ctx, { servicesSectionBackgroundModeLight: mode })}
        onSecondChange={(value) => updateStyle(ctx, { servicesSectionBackgroundToLight: value })}
        onAngleChange={(value) => updateStyle(ctx, { servicesSectionBackgroundAngleLight: value })}
        onRadialStopAChange={(value) => updateStyle(ctx, { servicesSectionBackgroundStopALight: value })}
        onRadialStopBChange={(value) => updateStyle(ctx, { servicesSectionBackgroundStopBLight: value })}
        onChange={(value) =>
          updateStyle(ctx, {
            sectionBgLight: value,
            sectionBg: value,
            servicesSectionBackgroundFromLight: value,
            servicesSectionBackgroundToLight:
              lightMode === "solid" ? value : String(raw.servicesSectionBackgroundToLight ?? value),
          })
        }
      />

      <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
      {showDarkTheme && (
        <TildaBackgroundColorField
          label="Цвет фона для всего блока"
          value={darkBg}
          mode={darkMode}
          secondValue={String(raw.servicesSectionBackgroundToDark ?? darkBg)}
          angle={Number(raw.servicesSectionBackgroundAngleDark ?? raw.servicesSectionBackgroundAngleLight ?? 135)}
          radialStopA={Number(raw.servicesSectionBackgroundStopADark ?? raw.servicesSectionBackgroundStopALight ?? 0)}
          radialStopB={Number(raw.servicesSectionBackgroundStopBDark ?? raw.servicesSectionBackgroundStopBLight ?? 100)}
          placeholder="#16181d"
          onModeChange={(mode) => updateStyle(ctx, { servicesSectionBackgroundModeDark: mode })}
          onSecondChange={(value) => updateStyle(ctx, { servicesSectionBackgroundToDark: value })}
          onAngleChange={(value) => updateStyle(ctx, { servicesSectionBackgroundAngleDark: value })}
          onRadialStopAChange={(value) => updateStyle(ctx, { servicesSectionBackgroundStopADark: value })}
          onRadialStopBChange={(value) => updateStyle(ctx, { servicesSectionBackgroundStopBDark: value })}
          onChange={(value) =>
            updateStyle(ctx, {
              sectionBgDark: value,
              servicesSectionBackgroundFromDark: value,
              servicesSectionBackgroundToDark:
                darkMode === "solid" ? value : String(raw.servicesSectionBackgroundToDark ?? value),
            })
          }
        />
      )}
    </div>
  );
}
