import { useState } from "react";
import {
  COVER_LINE_OPTIONS,
  COVER_LINE_STEP_PX,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  bookingContentColumns,
  centeredGridRange,
  clampBlockColumns,
  formatCoverLineLabel,
} from "@/features/site-builder/crm/site-client-core";
import {
  CoverGridWidthControl,
  TildaBackgroundColorField,
} from "@/features/site-builder/crm/site-editor-panels";
import { normalizeBlockStyle, updateBlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../../runtime/contracts";
import type { PanelTheme } from "@/features/site-builder/crm/site-shell-theme";

function sectionButton(
  id: string,
  label: string,
  activePanelSectionId: string | null,
  panelTheme: PanelTheme,
  setActivePanelSectionId: CrmPanelCtx["setActivePanelSectionId"]
) {
  const active = activePanelSectionId === id;
  return (
    <button
      key={id}
      type="button"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setActivePanelSectionId(active ? null : id);
      }}
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
      style={{
        borderColor: active ? panelTheme.accent : panelTheme.border,
        backgroundColor: "transparent",
        color: active ? panelTheme.text : panelTheme.muted,
      }}
    >
      <span>{label}</span>
      <span className="text-sm leading-none">{active ? "‹" : "›"}</span>
    </button>
  );
}

function flatSelect(
  label: string,
  value: string,
  onChange: (value: string) => void,
  options: Array<{ value: string; label: string }>
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none", appearance: "none" }}
        >
          {options.map((option) => (
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

function MobileWidthIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="none" fillRule="evenodd" transform="translate(5 3)">
        <path d="M2.5.5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5.5" cy="11.5" fill="currentColor" r="1" />
      </g>
    </svg>
  );
}

function DesktopWidthIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="11" rx="1.8" />
        <path d="M9 20h6M12 16v4" />
      </g>
    </svg>
  );
}

export function BO001SettingsPanel(ctx: CrmPanelCtx) {
  const {
    block,
    activeTheme,
    panelTheme,
    activePanelSectionId,
    setActivePanelSectionId,
    getCoverWidthButtonRef,
    getCoverWidthPopoverRef,
    coverWidthModalOpen,
    setCoverWidthModalOpen,
    updateBlock,
  } = ctx;
  const coverWidthButtonRef = getCoverWidthButtonRef();
  const coverWidthPopoverRef = getCoverWidthPopoverRef();
  const [showDarkThemeAdvanced, setShowDarkThemeAdvanced] = useState(false);
  const [showMobileWidthControl, setShowMobileWidthControl] = useState(false);
  const [widthPopoverOpen, setWidthPopoverOpen] = useState<"desktop" | "mobile" | null>(null);
  const style = normalizeBlockStyle(block, activeTheme);
  const rawStyle = (block.data.style as Record<string, unknown>) ?? {};

  const updateStyle = (patch: Record<string, unknown>) => {
    updateBlock(block.id, (prev) => updateBlockStyle(prev, patch));
  };
  const readRaw = (key: string) => (typeof rawStyle[key] === "string" ? String(rawStyle[key]) : "");
  const contentColumnsFromRaw = (columns: number | null | undefined) =>
    bookingContentColumns(clampBlockColumns(columns ?? 12, "booking"));
  const applyBookingContentColumns = (contentColumns: number) => {
    const rawColumns = clampBlockColumns(contentColumns + 4, "booking");
    const visualColumns = bookingContentColumns(rawColumns);
    const range = centeredGridRange(visualColumns);
    updateStyle({
      useCustomWidth: true,
      blockWidthColumns: rawColumns,
      blockWidth: Math.round((visualColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
      gridStartColumn: range.start,
      gridEndColumn: range.end,
    });
  };
  const applyMobileBookingContentColumns = (contentColumns: number) => {
    updateStyle({ mobileBlockWidthColumns: clampBlockColumns(contentColumns + 4, "booking") });
  };

  const resolvedContentColumns = contentColumnsFromRaw(style.blockWidthColumns);
  const resolvedMobileContentColumns = contentColumnsFromRaw(style.mobileBlockWidthColumns ?? style.blockWidthColumns);
  const range = centeredGridRange(resolvedContentColumns);
  const mobileRange = centeredGridRange(resolvedMobileContentColumns);
  const marginTopLines = Math.max(0, Math.min(7, Math.round((style.marginTop / COVER_LINE_STEP_PX) * 2) / 2));
  const marginBottomLines = Math.max(0, Math.min(7, Math.round((style.marginBottom / COVER_LINE_STEP_PX) * 2) / 2));
  const lightSectionBg =
    readRaw("servicesSectionBackgroundFromLight") || readRaw("sectionBgLight") || readRaw("sectionBg") || "transparent";
  const darkSectionBg = readRaw("servicesSectionBackgroundFromDark") || readRaw("sectionBgDark") || "transparent";
  const lightBackgroundMode =
    style.servicesSectionBackgroundModeLight === "linear" || style.servicesSectionBackgroundModeLight === "radial"
      ? style.servicesSectionBackgroundModeLight
      : "solid";
  const darkBackgroundMode =
    style.servicesSectionBackgroundModeDark === "linear" || style.servicesSectionBackgroundModeDark === "radial"
      ? style.servicesSectionBackgroundModeDark
      : lightBackgroundMode;

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
          <div className="mt-2 flex items-center gap-2 border-b pb-2" style={{ borderColor: panelTheme.border }}>
            <button
              type="button"
              ref={coverWidthButtonRef}
              onClick={() => {
                setCoverWidthModalOpen((prev) => !(prev && widthPopoverOpen === "desktop"));
                setWidthPopoverOpen((prev) => (prev === "desktop" ? null : "desktop"));
              }}
              className="flex min-w-0 flex-1 items-center justify-between text-left text-sm"
            >
              <span>{resolvedContentColumns} колонок</span>
              <span className="text-sm leading-none">{coverWidthModalOpen && widthPopoverOpen === "desktop" ? "\u25B4" : "\u25BE"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMobileWidthControl((prev) => !prev);
                setCoverWidthModalOpen(false);
                setWidthPopoverOpen(null);
              }}
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                showMobileWidthControl ? "bg-[#2F8EEF] text-white" : "bg-[#d1d5db] text-white hover:bg-[#aeb4bd]"
              }`}
              title="Показать мобильную ширину блока"
              aria-label="Показать мобильную ширину блока"
            >
              <DesktopWidthIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {showMobileWidthControl || (coverWidthModalOpen && widthPopoverOpen === "mobile") ? (
            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                Моб. ширина блока
              </div>
              <div className="mt-2 flex items-center gap-2 border-b pb-2" style={{ borderColor: panelTheme.border }}>
                <button
                  type="button"
                  onClick={() => {
                    setCoverWidthModalOpen((prev) => !(prev && widthPopoverOpen === "mobile"));
                    setWidthPopoverOpen((prev) => (prev === "mobile" ? null : "mobile"));
                  }}
                  className="flex min-w-0 flex-1 items-center justify-between text-left text-sm"
                >
                  <span>{resolvedMobileContentColumns} колонок</span>
                  <span className="text-sm leading-none">{coverWidthModalOpen && widthPopoverOpen === "mobile" ? "\u25B4" : "\u25BE"}</span>
                </button>
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d1d5db] text-white">
                  <MobileWidthIcon className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ) : null}
          {coverWidthModalOpen && widthPopoverOpen === "desktop" ? (
            <div
              ref={coverWidthPopoverRef}
              className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
              style={{ backgroundColor: panelTheme.panel, borderColor: panelTheme.border }}
            >
              <CoverGridWidthControl
                start={range.start}
                end={range.end}
                onChange={(nextStart, nextEnd) => applyBookingContentColumns(nextEnd - nextStart + 1)}
                compact
              />
            </div>
          ) : null}
          {coverWidthModalOpen && widthPopoverOpen === "mobile" ? (
            <div
              ref={coverWidthPopoverRef}
              className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
              style={{ backgroundColor: panelTheme.panel, borderColor: panelTheme.border }}
            >
              <CoverGridWidthControl
                start={mobileRange.start}
                end={mobileRange.end}
                onChange={(nextStart, nextEnd) => applyMobileBookingContentColumns(nextEnd - nextStart + 1)}
                compact
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {sectionButton("typography", "Типографика", activePanelSectionId, panelTheme, setActivePanelSectionId)}
        {sectionButton("panels", "Панели и карточки", activePanelSectionId, panelTheme, setActivePanelSectionId)}
        {sectionButton("button", "Кнопки", activePanelSectionId, panelTheme, setActivePanelSectionId)}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {flatSelect(
          "Отступ сверху",
          String(marginTopLines),
          (value) => updateStyle({ marginTop: Math.round(Number(value) * COVER_LINE_STEP_PX) }),
          COVER_LINE_OPTIONS.map((value) => ({ value: String(value), label: formatCoverLineLabel(value) }))
        )}
        {flatSelect(
          "Отступ снизу",
          String(marginBottomLines),
          (value) => updateStyle({ marginBottom: Math.round(Number(value) * COVER_LINE_STEP_PX) }),
          COVER_LINE_OPTIONS.map((value) => ({ value: String(value), label: formatCoverLineLabel(value) }))
        )}
      </div>

      <TildaBackgroundColorField
        label="Цвет фона для всего блока"
        value={lightSectionBg}
        mode={lightBackgroundMode}
        secondValue={String(rawStyle.servicesSectionBackgroundToLight ?? lightSectionBg)}
        angle={Number(rawStyle.servicesSectionBackgroundAngleLight ?? 135)}
        radialStopA={Number(rawStyle.servicesSectionBackgroundStopALight ?? 0)}
        radialStopB={Number(rawStyle.servicesSectionBackgroundStopBLight ?? 100)}
        placeholder="#ffffff"
        onModeChange={(mode) => updateStyle({ servicesSectionBackgroundModeLight: mode })}
        onSecondChange={(value) => updateStyle({ servicesSectionBackgroundToLight: value })}
        onAngleChange={(value) => updateStyle({ servicesSectionBackgroundAngleLight: value })}
        onRadialStopAChange={(value) => updateStyle({ servicesSectionBackgroundStopALight: value })}
        onRadialStopBChange={(value) => updateStyle({ servicesSectionBackgroundStopBLight: value })}
        onChange={(value) =>
          updateStyle({
            sectionBgLight: value,
            sectionBg: value,
            servicesSectionBackgroundFromLight: value,
            servicesSectionBackgroundToLight:
              lightBackgroundMode === "solid" ? value : rawStyle.servicesSectionBackgroundToLight ?? value,
          })
        }
      />

      <button
        type="button"
        onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
        className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
        style={{
          borderColor: showDarkThemeAdvanced ? "var(--bp-save-close,var(--bp-accent))" : panelTheme.border,
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
          value={darkSectionBg}
          mode={darkBackgroundMode}
          secondValue={String(rawStyle.servicesSectionBackgroundToDark ?? darkSectionBg)}
          angle={Number(rawStyle.servicesSectionBackgroundAngleDark ?? rawStyle.servicesSectionBackgroundAngleLight ?? 135)}
          radialStopA={Number(rawStyle.servicesSectionBackgroundStopADark ?? rawStyle.servicesSectionBackgroundStopALight ?? 0)}
          radialStopB={Number(rawStyle.servicesSectionBackgroundStopBDark ?? rawStyle.servicesSectionBackgroundStopBLight ?? 100)}
          placeholder="#16181d"
          onModeChange={(mode) => updateStyle({ servicesSectionBackgroundModeDark: mode })}
          onSecondChange={(value) => updateStyle({ servicesSectionBackgroundToDark: value })}
          onAngleChange={(value) => updateStyle({ servicesSectionBackgroundAngleDark: value })}
          onRadialStopAChange={(value) => updateStyle({ servicesSectionBackgroundStopADark: value })}
          onRadialStopBChange={(value) => updateStyle({ servicesSectionBackgroundStopBDark: value })}
          onChange={(value) =>
            updateStyle({
              sectionBgDark: value,
              servicesSectionBackgroundFromDark: value,
              servicesSectionBackgroundToDark:
                darkBackgroundMode === "solid" ? value : rawStyle.servicesSectionBackgroundToDark ?? value,
            })
          }
        />
      ) : null}
    </div>
  );
}

