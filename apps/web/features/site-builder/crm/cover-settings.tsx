import {
  COVER_BACKGROUND_POSITION_VALUES,
  COVER_LINE_STEP_PX,
  DEFAULT_BLOCK_COLUMNS,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  centeredGridRange,
  clampBlockColumns,
  clampGridColumn,
} from "./site-client-core";
import {
  isValidColorValue,
  normalizeBlockStyle,
  updateBlockStyle,
  type BlockStyle,
} from "./site-renderer";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

export type CoverBackgroundMode = "solid" | "linear" | "radial";

type UpdateBlock = (
  id: string,
  updater: (block: SiteBlock) => SiteBlock,
  options?: { recordHistory?: boolean }
) => void;

type ResolveCoverSettingsArgs = {
  rightPanel: "content" | "settings" | null;
  selectedBlock: SiteBlock | null;
  activeTheme: SiteTheme;
  updateBlock: UpdateBlock;
};

export function resolveCoverSettings({
  rightPanel,
  selectedBlock,
  activeTheme,
  updateBlock,
}: ResolveCoverSettingsArgs) {
  const isCoverSettingsPanel = rightPanel === "settings" && selectedBlock?.type === "cover";
  const coverStyle = isCoverSettingsPanel && selectedBlock
    ? normalizeBlockStyle(selectedBlock, activeTheme)
    : null;
  const coverResolvedColumns = coverStyle
    ? clampBlockColumns(coverStyle.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, "cover")
    : DEFAULT_BLOCK_COLUMNS;
  const coverGridFallback = centeredGridRange(coverResolvedColumns);
  const coverGridStart = coverStyle?.gridStartColumn ?? coverGridFallback.start;
  const coverGridEnd = coverStyle?.gridEndColumn ?? coverGridFallback.end;
  const coverGridSpan = Math.max(1, coverGridEnd - coverGridStart + 1);
  const coverMarginTopLines = coverStyle
    ? Math.max(0, Math.min(7, Math.round((coverStyle.marginTop / COVER_LINE_STEP_PX) * 2) / 2))
    : 0;
  const coverMarginBottomLines = coverStyle
    ? Math.max(0, Math.min(7, Math.round((coverStyle.marginBottom / COVER_LINE_STEP_PX) * 2) / 2))
    : 0;
  const coverData =
    isCoverSettingsPanel && selectedBlock
      ? (selectedBlock.data as Record<string, unknown>)
      : null;
  const coverBackgroundMode: CoverBackgroundMode =
    coverData?.coverBackgroundMode === "linear" || coverData?.coverBackgroundMode === "radial"
      ? (coverData.coverBackgroundMode as CoverBackgroundMode)
      : "solid";
  const coverBackgroundModeDark: CoverBackgroundMode =
    coverData?.coverBackgroundModeDark === "linear" || coverData?.coverBackgroundModeDark === "radial"
      ? (coverData.coverBackgroundModeDark as CoverBackgroundMode)
      : coverBackgroundMode;
  const coverScrollEffect =
    coverData?.coverScrollEffect === "fixed" || coverData?.coverScrollEffect === "parallax"
      ? (coverData.coverScrollEffect as "fixed" | "parallax")
      : "none";
  const coverScrollHeightRaw =
    typeof coverData?.coverScrollHeight === "string" ? coverData.coverScrollHeight.trim() : "";
  const coverScrollHeight = /^(?:\d+(?:\.\d+)?)(?:px|vh)$/i.test(coverScrollHeightRaw)
    ? coverScrollHeightRaw
    : "900px";
  const pxMatch = coverScrollHeight.match(/^(\d+(?:\.\d+)?)px$/i);
  const coverScrollHeightPx = pxMatch ? Math.max(0, Math.round(Number(pxMatch[1]))) : 900;
  const coverFilterStartColorRaw =
    typeof coverData?.coverFilterStartColor === "string"
      ? coverData.coverFilterStartColor.trim()
      : "";
  const coverFilterStartColor =
    coverFilterStartColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverFilterStartColorRaw)
        ? coverFilterStartColorRaw
        : "#000000";
  const coverFilterEndColorRaw =
    typeof coverData?.coverFilterEndColor === "string"
      ? coverData.coverFilterEndColor.trim()
      : "";
  const coverFilterEndColor =
    coverFilterEndColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverFilterEndColorRaw)
        ? coverFilterEndColorRaw
        : "#0f0f0f";
  const coverFilterStartOpacity = Number.isFinite(Number(coverData?.coverFilterStartOpacity))
    ? Math.max(0, Math.min(100, Number(coverData?.coverFilterStartOpacity)))
    : 10;
  const coverFilterEndOpacity = Number.isFinite(Number(coverData?.coverFilterEndOpacity))
    ? Math.max(0, Math.min(100, Number(coverData?.coverFilterEndOpacity)))
    : 60;
  const coverFilterStartColorDarkRaw =
    typeof coverData?.coverFilterStartColorDark === "string"
      ? coverData.coverFilterStartColorDark.trim()
      : "";
  const coverFilterStartColorDark =
    coverFilterStartColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverFilterStartColorDarkRaw)
        ? coverFilterStartColorDarkRaw
        : coverFilterStartColor;
  const coverFilterEndColorDarkRaw =
    typeof coverData?.coverFilterEndColorDark === "string"
      ? coverData.coverFilterEndColorDark.trim()
      : "";
  const coverFilterEndColorDark =
    coverFilterEndColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverFilterEndColorDarkRaw)
        ? coverFilterEndColorDarkRaw
        : coverFilterEndColor;
  const coverFilterStartOpacityDark = Number.isFinite(Number(coverData?.coverFilterStartOpacityDark))
    ? Math.max(0, Math.min(100, Number(coverData?.coverFilterStartOpacityDark)))
    : coverFilterStartOpacity;
  const coverFilterEndOpacityDark = Number.isFinite(Number(coverData?.coverFilterEndOpacityDark))
    ? Math.max(0, Math.min(100, Number(coverData?.coverFilterEndOpacityDark)))
    : coverFilterEndOpacity;
  const coverArrow = coverData?.coverArrow === "down" ? "down" : "none";
  const coverArrowDark = coverData?.coverArrowDark === "down"
    ? "down"
    : coverData?.coverArrowDark === "none"
      ? "none"
      : coverArrow;
  const coverArrowColorRaw =
    typeof coverData?.coverArrowColor === "string"
      ? coverData.coverArrowColor.trim()
      : "";
  const coverArrowColor =
    coverArrowColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverArrowColorRaw)
        ? coverArrowColorRaw
        : "#ffffff";
  const coverArrowColorDarkRaw =
    typeof coverData?.coverArrowColorDark === "string"
      ? coverData.coverArrowColorDark.trim()
      : "";
  const coverArrowColorDark =
    coverArrowColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverArrowColorDarkRaw)
        ? coverArrowColorDarkRaw
        : coverArrowColor;
  const coverArrowAnimated = Boolean(coverData?.coverArrowAnimated);
  const coverBackgroundPositionRaw =
    typeof coverData?.coverBackgroundPosition === "string"
      ? coverData.coverBackgroundPosition.trim().toLowerCase()
      : "";
  const coverBackgroundPosition = COVER_BACKGROUND_POSITION_VALUES.has(coverBackgroundPositionRaw)
    ? coverBackgroundPositionRaw
    : "center center";
  const legacyInset20 = Boolean(coverData?.coverImageInset20);
  const coverImageInsetPx = Number.isFinite(Number(coverData?.coverImageInsetPx))
    ? Math.max(0, Math.min(120, Math.round(Number(coverData?.coverImageInsetPx))))
    : legacyInset20
      ? 20
      : 0;
  const coverImageRadiusPx = Number.isFinite(Number(coverData?.coverImageRadiusPx))
    ? Math.max(0, Math.min(120, Math.round(Number(coverData?.coverImageRadiusPx))))
    : 0;
  const coverFlipHorizontal = Boolean(coverData?.coverFlipHorizontal);
  const coverTextVerticalAlignRaw =
    typeof coverData?.coverContentVerticalAlign === "string"
      ? coverData.coverContentVerticalAlign.trim().toLowerCase()
      : "";
  const coverTextVerticalAlign: "top" | "center" | "bottom" =
    coverTextVerticalAlignRaw === "top" || coverTextVerticalAlignRaw === "bottom"
      ? coverTextVerticalAlignRaw
      : "center";
  const coverBackgroundFromRaw =
    typeof coverData?.coverBackgroundFrom === "string" ? coverData.coverBackgroundFrom.trim() : "";
  const coverBackgroundFrom = coverBackgroundFromRaw || String(coverStyle?.sectionBgLight ?? coverStyle?.sectionBg ?? "#ffffff");
  const coverBackgroundFromDarkRaw =
    typeof coverData?.coverBackgroundFromDark === "string"
      ? coverData.coverBackgroundFromDark.trim()
      : "";
  const coverBackgroundFromDark =
    coverBackgroundFromDarkRaw ||
    String(coverStyle?.sectionBgDark ?? coverBackgroundFrom ?? coverStyle?.sectionBgLight ?? "#ffffff");
  const coverBackgroundTo = String(coverData?.coverBackgroundTo ?? "");
  const coverBackgroundToDark = String(coverData?.coverBackgroundToDark ?? coverBackgroundTo);
  const coverBackgroundAngle = Number.isFinite(Number(coverData?.coverBackgroundAngle))
    ? Math.max(0, Math.min(360, Number(coverData?.coverBackgroundAngle)))
    : 135;
  const coverBackgroundAngleDark = Number.isFinite(Number(coverData?.coverBackgroundAngleDark))
    ? Math.max(0, Math.min(360, Number(coverData?.coverBackgroundAngleDark)))
    : coverBackgroundAngle;
  const coverBackgroundStopA = Number.isFinite(Number(coverData?.coverBackgroundStopA))
    ? Math.max(0, Math.min(100, Number(coverData?.coverBackgroundStopA)))
    : 0;
  const coverBackgroundStopADark = Number.isFinite(Number(coverData?.coverBackgroundStopADark))
    ? Math.max(0, Math.min(100, Number(coverData?.coverBackgroundStopADark)))
    : coverBackgroundStopA;
  const coverBackgroundStopB = Number.isFinite(Number(coverData?.coverBackgroundStopB))
    ? Math.max(0, Math.min(100, Number(coverData?.coverBackgroundStopB)))
    : 100;
  const coverBackgroundStopBDark = Number.isFinite(Number(coverData?.coverBackgroundStopBDark))
    ? Math.max(0, Math.min(100, Number(coverData?.coverBackgroundStopBDark)))
    : coverBackgroundStopB;
  const coverShowSecondaryButton = Boolean(coverData?.showSecondaryButton);
  const coverPrimaryButtonBorderColorRaw =
    typeof coverData?.coverPrimaryButtonBorderColor === "string"
      ? coverData.coverPrimaryButtonBorderColor.trim()
      : "";
  const coverPrimaryButtonBorderColor =
    coverPrimaryButtonBorderColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverPrimaryButtonBorderColorRaw && isValidColorValue(coverPrimaryButtonBorderColorRaw)
        ? coverPrimaryButtonBorderColorRaw
        : "transparent";
  const coverPrimaryButtonBorderColorDarkRaw =
    typeof coverData?.coverPrimaryButtonBorderColorDark === "string"
      ? coverData.coverPrimaryButtonBorderColorDark.trim()
      : "";
  const coverPrimaryButtonBorderColorDark =
    coverPrimaryButtonBorderColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverPrimaryButtonBorderColorDarkRaw && isValidColorValue(coverPrimaryButtonBorderColorDarkRaw)
        ? coverPrimaryButtonBorderColorDarkRaw
        : coverPrimaryButtonBorderColor;
  const coverPrimaryButtonHoverBgColorRaw =
    typeof coverData?.coverPrimaryButtonHoverBgColor === "string"
      ? coverData.coverPrimaryButtonHoverBgColor.trim()
      : "";
  const coverPrimaryButtonHoverBgColor =
    coverPrimaryButtonHoverBgColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverPrimaryButtonHoverBgColorRaw && isValidColorValue(coverPrimaryButtonHoverBgColorRaw)
        ? coverPrimaryButtonHoverBgColorRaw
        : "transparent";
  const coverPrimaryButtonHoverBgColorDarkRaw =
    typeof coverData?.coverPrimaryButtonHoverBgColorDark === "string"
      ? coverData.coverPrimaryButtonHoverBgColorDark.trim()
      : "";
  const coverPrimaryButtonHoverBgColorDark =
    coverPrimaryButtonHoverBgColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverPrimaryButtonHoverBgColorDarkRaw && isValidColorValue(coverPrimaryButtonHoverBgColorDarkRaw)
        ? coverPrimaryButtonHoverBgColorDarkRaw
        : coverPrimaryButtonHoverBgColor;
  const coverSecondaryButtonColorRaw =
    typeof coverData?.coverSecondaryButtonColor === "string"
      ? coverData.coverSecondaryButtonColor.trim()
      : "";
  const coverSecondaryButtonColor =
    coverSecondaryButtonColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonColorRaw && isValidColorValue(coverSecondaryButtonColorRaw)
        ? coverSecondaryButtonColorRaw
        : "transparent";
  const coverSecondaryButtonColorDarkRaw =
    typeof coverData?.coverSecondaryButtonColorDark === "string"
      ? coverData.coverSecondaryButtonColorDark.trim()
      : "";
  const coverSecondaryButtonColorDark =
    coverSecondaryButtonColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonColorDarkRaw && isValidColorValue(coverSecondaryButtonColorDarkRaw)
        ? coverSecondaryButtonColorDarkRaw
        : coverSecondaryButtonColor;
  const coverSecondaryButtonTextColorRaw =
    typeof coverData?.coverSecondaryButtonTextColor === "string"
      ? coverData.coverSecondaryButtonTextColor.trim()
      : "";
  const coverSecondaryButtonTextColor =
    coverSecondaryButtonTextColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonTextColorRaw && isValidColorValue(coverSecondaryButtonTextColorRaw)
        ? coverSecondaryButtonTextColorRaw
        : "#ffffff";
  const coverSecondaryButtonTextColorDarkRaw =
    typeof coverData?.coverSecondaryButtonTextColorDark === "string"
      ? coverData.coverSecondaryButtonTextColorDark.trim()
      : "";
  const coverSecondaryButtonTextColorDark =
    coverSecondaryButtonTextColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonTextColorDarkRaw && isValidColorValue(coverSecondaryButtonTextColorDarkRaw)
        ? coverSecondaryButtonTextColorDarkRaw
        : coverSecondaryButtonTextColor;
  const coverSecondaryButtonBorderColorRaw =
    typeof coverData?.coverSecondaryButtonBorderColor === "string"
      ? coverData.coverSecondaryButtonBorderColor.trim()
      : "";
  const coverSecondaryButtonBorderColor =
    coverSecondaryButtonBorderColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonBorderColorRaw && isValidColorValue(coverSecondaryButtonBorderColorRaw)
        ? coverSecondaryButtonBorderColorRaw
        : "#ffffff";
  const coverSecondaryButtonBorderColorDarkRaw =
    typeof coverData?.coverSecondaryButtonBorderColorDark === "string"
      ? coverData.coverSecondaryButtonBorderColorDark.trim()
      : "";
  const coverSecondaryButtonBorderColorDark =
    coverSecondaryButtonBorderColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonBorderColorDarkRaw && isValidColorValue(coverSecondaryButtonBorderColorDarkRaw)
        ? coverSecondaryButtonBorderColorDarkRaw
        : coverSecondaryButtonBorderColor;
  const coverSecondaryButtonHoverBgColorRaw =
    typeof coverData?.coverSecondaryButtonHoverBgColor === "string"
      ? coverData.coverSecondaryButtonHoverBgColor.trim()
      : "";
  const coverSecondaryButtonHoverBgColor =
    coverSecondaryButtonHoverBgColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonHoverBgColorRaw &&
          isValidColorValue(coverSecondaryButtonHoverBgColorRaw)
        ? coverSecondaryButtonHoverBgColorRaw
        : "transparent";
  const coverSecondaryButtonHoverBgColorDarkRaw =
    typeof coverData?.coverSecondaryButtonHoverBgColorDark === "string"
      ? coverData.coverSecondaryButtonHoverBgColorDark.trim()
      : "";
  const coverSecondaryButtonHoverBgColorDark =
    coverSecondaryButtonHoverBgColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonHoverBgColorDarkRaw &&
          isValidColorValue(coverSecondaryButtonHoverBgColorDarkRaw)
        ? coverSecondaryButtonHoverBgColorDarkRaw
        : coverSecondaryButtonHoverBgColor;
  const coverSecondaryButtonRadius = Number.isFinite(Number(coverData?.coverSecondaryButtonRadius))
    ? Math.max(0, Math.min(80, Math.round(Number(coverData?.coverSecondaryButtonRadius))))
    : (coverStyle?.buttonRadius ?? activeTheme.buttonRadius);

  const updateSelectedCoverStyle = (patch: Partial<BlockStyle>) => {
    if (!isCoverSettingsPanel || !selectedBlock) return;
    updateBlock(selectedBlock.id, (block) => updateBlockStyle(block, patch));
  };

  const updateSelectedCoverData = (patch: Record<string, unknown>) => {
    if (!isCoverSettingsPanel || !selectedBlock) return;
    updateBlock(selectedBlock.id, (block) => ({ ...block, data: { ...block.data, ...patch } }));
  };

  const applySelectedCoverGridRange = (nextStart: number, nextEnd: number) => {
    const safeStart = clampGridColumn(nextStart);
    const safeEnd = Math.max(safeStart, clampGridColumn(nextEnd));
    const nextColumns = Math.max(1, safeEnd - safeStart + 1);
    const nextWidth = Math.round((nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE);
    updateSelectedCoverStyle({
      useCustomWidth: true,
      blockWidth: nextWidth,
      blockWidthColumns: nextColumns,
      gridStartColumn: safeStart,
      gridEndColumn: safeEnd,
    });
  };

  return {
    isCoverSettingsPanel,
    coverStyle,
    coverData,
    coverGridStart,
    coverGridEnd,
    coverGridSpan,
    coverMarginTopLines,
    coverMarginBottomLines,
    coverBackgroundMode,
    coverBackgroundModeDark,
    coverScrollEffect,
    coverScrollHeightPx,
    coverFilterStartColor,
    coverFilterEndColor,
    coverFilterStartOpacity,
    coverFilterEndOpacity,
    coverFilterStartColorDark,
    coverFilterEndColorDark,
    coverFilterStartOpacityDark,
    coverFilterEndOpacityDark,
    coverArrow,
    coverArrowDark,
    coverArrowColor,
    coverArrowColorDark,
    coverArrowAnimated,
    coverBackgroundPosition,
    coverImageInsetPx,
    coverImageRadiusPx,
    coverFlipHorizontal,
    coverTextVerticalAlign,
    coverBackgroundFrom,
    coverBackgroundFromDark,
    coverBackgroundTo,
    coverBackgroundToDark,
    coverBackgroundAngle,
    coverBackgroundAngleDark,
    coverBackgroundStopA,
    coverBackgroundStopADark,
    coverBackgroundStopB,
    coverBackgroundStopBDark,
    coverShowSecondaryButton,
    coverPrimaryButtonBorderColor,
    coverPrimaryButtonBorderColorDark,
    coverPrimaryButtonHoverBgColor,
    coverPrimaryButtonHoverBgColorDark,
    coverSecondaryButtonColor,
    coverSecondaryButtonColorDark,
    coverSecondaryButtonTextColor,
    coverSecondaryButtonTextColorDark,
    coverSecondaryButtonBorderColor,
    coverSecondaryButtonBorderColorDark,
    coverSecondaryButtonHoverBgColor,
    coverSecondaryButtonHoverBgColorDark,
    coverSecondaryButtonRadius,
    updateSelectedCoverStyle,
    updateSelectedCoverData,
    applySelectedCoverGridRange,
  };
}

export function renderCoverFlatTextInput(
  label: string,
  value: string,
  onChange: (value: string) => void
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
      </div>
    </label>
  );
}

export function renderCoverFlatNumberInput(
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] bg-transparent pb-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange(
              Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : min
            );
          }}
          className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
      </div>
    </label>
  );
}
