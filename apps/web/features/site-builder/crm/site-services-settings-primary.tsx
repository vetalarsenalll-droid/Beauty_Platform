import { useState, type RefObject } from "react";
import {
  COVER_LINE_OPTIONS,
  COVER_LINE_STEP_PX,
  DEFAULT_BLOCK_COLUMNS,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  centeredGridRange,
  clampBlockColumns,
  formatCoverLineLabel,
} from "@/features/site-builder/crm/site-client-core";
import type { PanelTheme } from "@/features/site-builder/crm/site-shell-theme";
import {
  CoverGridWidthControl,
  TildaBackgroundColorField,
} from "@/features/site-builder/crm/site-editor-panels";
import {
  normalizeBlockStyle,
  updateBlockStyle,
  type BlockStyle,
} from "@/features/site-builder/crm/site-renderer";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

type SiteServicesSettingsPrimaryProps = {
  block: SiteBlock;
  activeTheme: SiteTheme;
  panelTheme: PanelTheme;
  activePanelSectionId: string | null;
  coverWidthButtonRef: RefObject<HTMLButtonElement | null>;
  coverWidthPopoverRef: RefObject<HTMLDivElement | null>;
  coverWidthModalOpen: boolean;
  setCoverWidthModalOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setActivePanelSectionId: (value: string | null | ((prev: string | null) => string | null)) => void;
  updateBlock: (
    id: string,
    updater: (block: SiteBlock) => SiteBlock,
    options?: { recordHistory?: boolean }
  ) => void;
};

function renderSectionButton(
  label: string,
  sectionId: string,
  activePanelSectionId: string | null,
  panelTheme: PanelTheme,
  setActivePanelSectionId: SiteServicesSettingsPrimaryProps["setActivePanelSectionId"]
) {
  const isActive = activePanelSectionId === sectionId;
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        setActivePanelSectionId(isActive ? null : sectionId);
      }}
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
      style={{
        borderColor: isActive ? "#ff5a5f" : panelTheme.border,
        backgroundColor: "transparent",
        color: isActive ? panelTheme.text : panelTheme.muted,
      }}
    >
      <span>{label}</span>
      <span className="text-sm leading-none">{isActive ? "‹" : "›"}</span>
    </button>
  );
}

const TEXT_ALIGNMENT_OPTIONS = [
  { value: "left", label: "По левому краю" },
  { value: "center", label: "По центру" },
  { value: "right", label: "По правому краю" },
];

function renderTextAlignmentSelect(
  label: string,
  value: BlockStyle["textAlign"],
  onChange: (value: BlockStyle["textAlign"]) => void
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as BlockStyle["textAlign"])}
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
          {TEXT_ALIGNMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
          {"\u25BE"}
        </span>
      </div>
    </label>
  );
}

export function SiteServicesSettingsPrimary({
  block,
  activeTheme,
  panelTheme,
  activePanelSectionId,
  coverWidthButtonRef,
  coverWidthPopoverRef,
  coverWidthModalOpen,
  setCoverWidthModalOpen,
  setActivePanelSectionId,
  updateBlock,
}: SiteServicesSettingsPrimaryProps) {
  const [showDarkThemeAdvanced, setShowDarkThemeAdvanced] = useState(false);
  const style = normalizeBlockStyle(block, activeTheme);

  const updateStyle = (patch: Partial<BlockStyle>) => {
    updateBlock(block.id, (prev) => updateBlockStyle(prev, patch));
  };

  const applyGridColumns = (columns: number) => {
    const safeColumns = clampBlockColumns(columns, block.type);
    const range = centeredGridRange(safeColumns);
    const width = Math.round((safeColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE);
    updateStyle({
      useCustomWidth: true,
      blockWidth: width,
      blockWidthColumns: safeColumns,
      gridStartColumn: range.start,
      gridEndColumn: range.end,
    });
  };

  const readRaw = (key: string) => {
    const rawStyle = (block.data.style as Record<string, unknown>) ?? {};
    return typeof rawStyle[key] === "string" ? (rawStyle[key] as string) : "";
  };

  const resolvedColumns = clampBlockColumns(
    style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS,
    block.type
  );
  const resolvedWidthPx = Math.round((resolvedColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE);
  const range = centeredGridRange(resolvedColumns);
  const coverMarginTopLines = Math.round((style.marginTop / COVER_LINE_STEP_PX) * 2) / 2;
  const coverMarginBottomLines = Math.round((style.marginBottom / COVER_LINE_STEP_PX) * 2) / 2;

  const lightSectionBg = readRaw("sectionBgLight") || readRaw("sectionBg");
  const darkSectionBg = readRaw("sectionBgDark");

  const lightBackgroundMode =
    style.servicesSectionBackgroundModeLight === "linear" ||
    style.servicesSectionBackgroundModeLight === "radial"
      ? style.servicesSectionBackgroundModeLight
      : "solid";
  const darkBackgroundMode =
    style.servicesSectionBackgroundModeDark === "linear" ||
    style.servicesSectionBackgroundModeDark === "radial"
      ? style.servicesSectionBackgroundModeDark
      : lightBackgroundMode;
  const lightBackgroundTo = style.servicesSectionBackgroundToLight || lightSectionBg || "#ffffff";
  const darkBackgroundTo = style.servicesSectionBackgroundToDark || darkSectionBg || "#16181d";
  const lightBackgroundAngle = Number.isFinite(style.servicesSectionBackgroundAngleLight)
    ? Number(style.servicesSectionBackgroundAngleLight)
    : 135;
  const darkBackgroundAngle = Number.isFinite(style.servicesSectionBackgroundAngleDark)
    ? Number(style.servicesSectionBackgroundAngleDark)
    : lightBackgroundAngle;
  const lightBackgroundStopA = Number.isFinite(style.servicesSectionBackgroundStopALight)
    ? Number(style.servicesSectionBackgroundStopALight)
    : 0;
  const lightBackgroundStopB = Number.isFinite(style.servicesSectionBackgroundStopBLight)
    ? Number(style.servicesSectionBackgroundStopBLight)
    : 100;
  const darkBackgroundStopA = Number.isFinite(style.servicesSectionBackgroundStopADark)
    ? Number(style.servicesSectionBackgroundStopADark)
    : lightBackgroundStopA;
  const darkBackgroundStopB = Number.isFinite(style.servicesSectionBackgroundStopBDark)
    ? Number(style.servicesSectionBackgroundStopBDark)
    : lightBackgroundStopB;

  return (
    <div className="space-y-6 px-1 pb-8 pt-1">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Основные настройки
        </div>
        <div className="relative mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Ширина блока
          </div>
          <button
            type="button"
            ref={coverWidthButtonRef}
            onClick={() => setCoverWidthModalOpen((prev) => !prev)}
            className="mt-2 flex w-full items-center justify-between border-b pb-2 text-left text-sm"
            style={{ borderColor: panelTheme.border }}
          >
            <span>{resolvedColumns} колонок</span>
            <span className="text-sm leading-none">{coverWidthModalOpen ? "\u25B4" : "\u25BE"}</span>
          </button>
          {coverWidthModalOpen && (
            <div
              ref={coverWidthPopoverRef}
              className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
              style={{ backgroundColor: panelTheme.panel, borderColor: panelTheme.border }}
            >
              <CoverGridWidthControl
                start={range.start}
                end={range.end}
                onChange={(nextStart, nextEnd) =>
                  applyGridColumns(Math.max(1, nextEnd - nextStart + 1))
                }
                compact
              />
              <div className="mt-3 flex items-center justify-between text-sm text-[color:var(--bp-muted)]">
                <span>{resolvedWidthPx}</span>
                <span>px</span>
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4">
          {renderTextAlignmentSelect(
            "Выравнивание заголовка",
            style.textAlignHeading ?? style.textAlign ?? "left",
            (value) => updateStyle({ textAlignHeading: value })
          )}
          {renderTextAlignmentSelect(
            "Выравнивание описания",
            style.textAlignSubheading ?? style.textAlign ?? "left",
            (value) => updateStyle({ textAlignSubheading: value })
          )}
        </div>
      </div>

      <div className="space-y-3">
        {renderSectionButton(
          "Типографика",
          "typography",
          activePanelSectionId,
          panelTheme,
          setActivePanelSectionId
        )}
        {renderSectionButton(
          "Кнопка",
          "button",
          activePanelSectionId,
          panelTheme,
          setActivePanelSectionId
        )}
        {renderSectionButton(
          "Список услуг",
          "servicesList",
          activePanelSectionId,
          panelTheme,
          setActivePanelSectionId
        )}
        {renderSectionButton(
          "Фильтры, поиск и сортировка",
          "filters",
          activePanelSectionId,
          panelTheme,
          setActivePanelSectionId
        )}
        {renderSectionButton(
          "Страница услуги",
          "servicePage",
          activePanelSectionId,
          panelTheme,
          setActivePanelSectionId
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Отступ сверху
          <div className="relative mt-2">
            <select
              value={String(coverMarginTopLines)}
              onChange={(event) =>
                updateStyle({
                  marginTop: Math.round(Number(event.target.value) * COVER_LINE_STEP_PX),
                })
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
                <option key={`top-${lineValue}`} value={lineValue}>
                  {formatCoverLineLabel(lineValue)}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
              {"\u25BE"}
            </span>
          </div>
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Отступ снизу
          <div className="relative mt-2">
            <select
              value={String(coverMarginBottomLines)}
              onChange={(event) =>
                updateStyle({
                  marginBottom: Math.round(Number(event.target.value) * COVER_LINE_STEP_PX),
                })
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
                <option key={`bottom-${lineValue}`} value={lineValue}>
                  {formatCoverLineLabel(lineValue)}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
              {"\u25BE"}
            </span>
          </div>
        </label>
      </div>

      <TildaBackgroundColorField
        label="Цвет фона для всего блока"
        value={lightSectionBg || "#ffffff"}
        mode={lightBackgroundMode}
        secondValue={lightBackgroundTo}
        angle={lightBackgroundAngle}
        radialStopA={lightBackgroundStopA}
        radialStopB={lightBackgroundStopB}
        placeholder="#ffffff"
        onModeChange={(mode) => updateStyle({ servicesSectionBackgroundModeLight: mode })}
        onSecondChange={(value) => updateStyle({ servicesSectionBackgroundToLight: value })}
        onAngleChange={(value) => updateStyle({ servicesSectionBackgroundAngleLight: value })}
        onRadialStopAChange={(value) => updateStyle({ servicesSectionBackgroundStopALight: value })}
        onRadialStopBChange={(value) => updateStyle({ servicesSectionBackgroundStopBLight: value })}
        onChange={(value) => {
          updateStyle({
            sectionBgLight: value,
            sectionBg: value,
            blockBgLight: value,
            blockBg: value,
            servicesSectionBackgroundFromLight: value,
          });
        }}
      />

      <button
        type="button"
        onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
        className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
        style={{
          borderColor: showDarkThemeAdvanced ? "#ff5a5f" : panelTheme.border,
          backgroundColor: "transparent",
          color: showDarkThemeAdvanced ? panelTheme.text : panelTheme.muted,
        }}
      >
        <span className="inline-flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
          </svg>
          <span>Темная тема</span>
        </span>
        <span className="text-xs">{showDarkThemeAdvanced ? "▴" : "▾"}</span>
      </button>

      {showDarkThemeAdvanced ? (
        <TildaBackgroundColorField
          label="Цвет фона для всего блока"
          value={darkSectionBg || "#16181d"}
          mode={darkBackgroundMode}
          secondValue={darkBackgroundTo}
          angle={darkBackgroundAngle}
          radialStopA={darkBackgroundStopA}
          radialStopB={darkBackgroundStopB}
          placeholder="#16181d"
          onModeChange={(mode) => updateStyle({ servicesSectionBackgroundModeDark: mode })}
          onSecondChange={(value) => updateStyle({ servicesSectionBackgroundToDark: value })}
          onAngleChange={(value) => updateStyle({ servicesSectionBackgroundAngleDark: value })}
          onRadialStopAChange={(value) => updateStyle({ servicesSectionBackgroundStopADark: value })}
          onRadialStopBChange={(value) => updateStyle({ servicesSectionBackgroundStopBDark: value })}
          onChange={(value) => {
            updateStyle({
              sectionBgDark: value,
              blockBgDark: value,
              servicesSectionBackgroundFromDark: value,
            });
          }}
        />
      ) : null}
    </div>
  );
}
