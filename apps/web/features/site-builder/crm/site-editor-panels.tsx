import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  BLOCK_LABELS,
  BLOCK_VARIANTS,
  type BlockType,
  type SiteBlock,
  type SitePageKey,
  type SiteTheme,
} from "@/lib/site-builder";
import type {
  SiteBranding as Branding,
  SiteEditorAccountProfile as AccountProfile,
  SiteLocationItem as LocationItem,
  SitePromoItem as PromoItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
} from "@/features/site-builder/shared/site-data";
import {
  BOOKING_MAX_PRESET,
  BOOKING_MIN_PRESET,
  COVER_BACKGROUND_POSITION_OPTIONS,
  COVER_LINE_OPTIONS,
  COVER_LINE_STEP_PX,
  DEFAULT_BLOCK_COLUMNS,
  FONT_WEIGHTS,
  GRID_MAX_COLUMN,
  GRID_MIN_COLUMN,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  PAGE_KEYS,
  PAGE_LABELS,
  SOCIAL_LABELS,
  THEME_FONTS,
  bookingColumnsFromPreset,
  bookingPresetFromColumns,
  centeredGridRange,
  clamp01,
  clampBlockColumns,
  clampGridColumn,
  formatCoverLineLabel,
  hexToRgbaString,
  isSystemBlockType,
  parseBackdropColor,
  variantsLabel,
} from "./site-client-core";
import type {
  CoverBackgroundMode,
  CssVars,
  CurrentEntity,
  EditorSection,
  MobileViewportKey,
} from "./site-client-core";
import {
  BlockPreview,
  CoverImageEditor,
  EntityListEditor,
  FieldText,
  FieldTextarea,
  FlatCheckbox,
  SliderTrack,
  TildaInlineNumberField,
  type BlockStyle,
  isValidColorValue,
  normalizeBlockStyle,
  updateBlockStyle,
} from "./site-renderer";
export function ColorField({
  label,
  value,
  onChange,
  placeholder,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) {
    const EMPTY_COLOR_LABEL = "Цвет не выбран";
    const normalized = value?.trim() ?? "";
    const isTransparent = normalized.toLowerCase() === "transparent";
    const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
    const placeholderValue = typeof placeholder === "string" ? placeholder : "";
    const placeholderHex =
      typeof placeholderValue === "string" &&
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(placeholderValue)
        ? placeholderValue
        : "";
    const displayValue = isTransparent
      ? EMPTY_COLOR_LABEL
      : normalized === ""
        ? placeholderValue || "#ffffff"
        : normalized;
    const colorValue = isHex
      ? normalized
      : isTransparent
        ? "#ffffff"
        : placeholderHex || "#ffffff";
  return (
    <label className="text-sm">
      {label}
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2">
        <input
          type="color"
          value={colorValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-6 rounded"
        />
        <input
          type="text"
          value={displayValue}
          onChange={(event) => {
            const next = event.target.value;
            const lowered = next.trim().toLowerCase();
            if (lowered === "transparent" || lowered === EMPTY_COLOR_LABEL.toLowerCase()) {
              onChange("transparent");
              return;
            }
            if (next.trim() === "") {
              onChange("transparent");
              return;
            }
            onChange(next);
          }}
          onFocus={(event) => event.currentTarget.select()}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs text-[color:var(--bp-ink)] outline-none selection:bg-[color:var(--bp-accent)] selection:text-[color:var(--bp-paper)]"
        />
      </div>
    </label>
  );
}

export function TildaInlineColorField({
  label,
  value,
  onChange,
  onClear,
  placeholder = "#ffffff",
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const EMPTY_COLOR_LABEL = "Цвет не выбран";
  const normalized = value?.trim() ?? "";
  const isTransparent = normalized.toLowerCase() === "transparent";
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
  const displayValue = isTransparent ? EMPTY_COLOR_LABEL : normalized || placeholder;
  const colorValue = isHex ? normalized : placeholder;
  const transparencyPattern = {
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb), linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb)",
    backgroundPosition: "0 0, 4px 4px",
    backgroundSize: "8px 8px",
  } as const;
  return (
    <label className={`${compact ? "" : "mb-3 "}block`}>
      <div className="min-h-[32px] text-[11px] font-semibold uppercase tracking-[0.15em] leading-4 text-[color:var(--bp-muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--bp-stroke)]">
          <div
            className="absolute inset-[2px] rounded-full"
            style={isTransparent ? transparencyPattern : { backgroundColor: colorValue }}
          />
          <input
            type="color"
            value={colorValue}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <input
          type="text"
          value={displayValue}
          onChange={(event) => {
            const next = event.target.value;
            const lowered = next.trim().toLowerCase();
            if (lowered === "transparent" || lowered === EMPTY_COLOR_LABEL.toLowerCase()) {
              onChange("transparent");
              return;
            }
            if (next.trim() === "") {
              onChange("transparent");
              return;
            }
            onChange(next);
          }}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-sm text-[color:var(--bp-ink)] font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
            aria-label="Сбросить цвет"
            title="Сбросить цвет"
          >
            ×
          </button>
        )}
      </div>
    </label>
  );
}

export function TildaBackgroundColorField({
  label,
  value,
  mode = "solid",
  secondValue = "",
  angle = 135,
  radialStopA = 0,
  radialStopB = 100,
  onModeChange,
  onSecondChange,
  onAngleChange,
  onRadialStopAChange,
  onRadialStopBChange,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  mode?: CoverBackgroundMode;
  secondValue?: string;
  angle?: number;
  radialStopA?: number;
  radialStopB?: number;
  onModeChange?: (value: CoverBackgroundMode) => void;
  onSecondChange?: (value: string) => void;
  onAngleChange?: (value: number) => void;
  onRadialStopAChange?: (value: number) => void;
  onRadialStopBChange?: (value: number) => void;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const EMPTY_COLOR_LABEL = "Цвет не выбран";
  const normalized = value?.trim() ?? "";
  const isTransparent = normalized.toLowerCase() === "transparent";
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
  const placeholderValue = typeof placeholder === "string" ? placeholder : "";
  const placeholderHex =
    typeof placeholderValue === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(placeholderValue)
      ? placeholderValue
      : "";
  const displayValue = isTransparent
    ? EMPTY_COLOR_LABEL
    : normalized === ""
      ? placeholderValue || "#ffffff"
      : normalized;
  const colorValue = isHex
    ? normalized
    : isTransparent
      ? "#ffffff"
      : placeholderHex || "#ffffff";
  const normalizedSecond = secondValue?.trim() ?? "";
  const secondIsHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalizedSecond);
  const secondColorValue = secondIsHex ? normalizedSecond : colorValue;
  const secondIsTransparent = normalizedSecond.toLowerCase() === "transparent";
  const transparencyPattern = {
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb), linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb)",
    backgroundPosition: "0 0, 4px 4px",
    backgroundSize: "8px 8px",
  } as const;
  const radialStopAPct = Math.max(0, Math.min(100, Math.round(radialStopA)));
  const radialStopBPct = Math.max(0, Math.min(100, Math.round(radialStopB)));
  const leftPct = Math.min(radialStopAPct, radialStopBPct);
  const rightPct = Math.max(radialStopAPct, radialStopBPct);
  const leftColor = radialStopAPct <= radialStopBPct ? colorValue : secondColorValue;
  const rightColor = radialStopAPct <= radialStopBPct ? secondColorValue : colorValue;
  const radialTrackRef = useRef<HTMLDivElement | null>(null);
  const radialDragRef = useRef<"stopA" | "stopB" | null>(null);
  const [activeRadialThumb, setActiveRadialThumb] = useState<"stopA" | "stopB" | null>(null);

  const clampPct = (value: number) => Math.max(0, Math.min(100, value));
  const resolvePercentFromClientX = (clientX: number) => {
    const rect = radialTrackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return clampPct(((clientX - rect.left) / rect.width) * 100);
  };
  const applyRadialPercent = (target: "stopA" | "stopB", percent: number) => {
    const nextPercent = clampPct(percent);
    if (target === "stopA") {
      onRadialStopAChange?.(Math.round(nextPercent));
      return;
    }
    onRadialStopBChange?.(Math.round(nextPercent));
  };
  const startRadialDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    forcedTarget?: "stopA" | "stopB"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const startPercent = resolvePercentFromClientX(event.clientX);
    const target =
      forcedTarget ??
      (Math.abs(startPercent - radialStopAPct) <= Math.abs(startPercent - radialStopBPct)
        ? "stopA"
        : "stopB");
    radialDragRef.current = target;
    setActiveRadialThumb(target);
    applyRadialPercent(target, startPercent);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    const handleMove = (nextEvent: PointerEvent) => {
      const dragTarget = radialDragRef.current;
      if (!dragTarget) return;
      const nextPercent = resolvePercentFromClientX(nextEvent.clientX);
      applyRadialPercent(dragTarget, nextPercent);
    };
    const handleUp = () => {
      radialDragRef.current = null;
      setActiveRadialThumb(null);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={mode}
          onChange={(event) => onModeChange?.(event.target.value as CoverBackgroundMode)}
          className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-sm normal-case tracking-normal text-[color:var(--bp-ink)] shadow-none outline-none focus:ring-0"
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
          <option value="solid">Сплошной цвет</option>
          <option value="linear">Линейный градиент</option>
          <option value="radial">Радиальный градиент</option>
        </select>
        <span className="pointer-events-none text-sm leading-none text-[color:var(--bp-ink)]">▾</span>
      </div>
      <div className="mt-2 flex items-center gap-2 bg-transparent">
        <div
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--bp-stroke)]"
          style={isTransparent ? transparencyPattern : { backgroundColor: "var(--bp-paper)" }}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundColor: isTransparent ? "transparent" : colorValue }}
          />
          <input
            type="color"
            value={colorValue}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <input
          type="text"
          value={displayValue}
          onChange={(event) => {
            const next = event.target.value;
            const lowered = next.trim().toLowerCase();
            if (lowered === "transparent" || lowered === EMPTY_COLOR_LABEL.toLowerCase()) {
              onChange("transparent");
              return;
            }
            if (next.trim() === "") {
              onChange("transparent");
              return;
            }
            onChange(next);
          }}
          onFocus={(event) => event.currentTarget.select()}
          placeholder={placeholder}
          className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-sm text-[color:var(--bp-ink)] shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, boxShadow: "none" }}
        />
        <button
          type="button"
          onClick={() => onChange("transparent")}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
          aria-label="Сбросить цвет"
          title="Сбросить цвет"
        >
          ×
        </button>
      </div>
      {mode !== "solid" && (
        <div className="mt-2 flex items-center gap-2 bg-transparent">
          <div
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--bp-stroke)]"
            style={secondIsTransparent ? transparencyPattern : { backgroundColor: "var(--bp-paper)" }}
          >
            <div
              className="absolute inset-0"
              style={{ backgroundColor: secondIsTransparent ? "transparent" : secondColorValue }}
            />
            <input
              type="color"
              value={secondColorValue}
              onChange={(event) => onSecondChange?.(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
          <input
            type="text"
            value={normalizedSecond || secondColorValue}
            onChange={(event) => onSecondChange?.(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            placeholder={placeholder}
            className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-sm text-[color:var(--bp-ink)] shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:outline-none focus:ring-0"
            style={{ border: 0, boxShadow: "none" }}
          />
          <button
            type="button"
            onClick={() => onSecondChange?.(colorValue)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
            aria-label="Сбросить второй цвет"
            title="Сбросить второй цвет"
          >
            ×
          </button>
        </div>
      )}
      {mode === "linear" && (
        <div className="mt-2">
          <div className="mb-1 text-xs text-[color:var(--bp-muted)]">Угол {Math.round(angle)}</div>
          <div className="relative h-5">
            <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--bp-stroke)]" />
            <div
              className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, (Math.round(angle) / 360) * 100))}%`,
                backgroundColor: "#ff5a5f",
              }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
              style={{
                left: `${Math.max(0, Math.min(100, (Math.round(angle) / 360) * 100))}%`,
                backgroundColor: "#ff5a5f",
              }}
            />
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={Math.round(angle)}
              onChange={(event) => onAngleChange?.(Number(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
        </div>
      )}
      {mode === "radial" && (
        <div className="mt-2">
          <div className="mb-1 text-xs text-[color:var(--bp-muted)]">
            Цвет 1: {radialStopAPct}% · Цвет 2: {radialStopBPct}%
          </div>
          <div
            ref={radialTrackRef}
            className="relative h-6 cursor-pointer touch-none"
            onPointerDown={(event) => startRadialDrag(event)}
          >
            <div
              className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
              style={{
                background: `linear-gradient(to right, ${leftColor} 0%, ${leftColor} ${leftPct}%, ${rightColor} ${rightPct}%, ${rightColor} 100%)`,
              }}
            />
            <div
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white shadow-sm ${
                activeRadialThumb === "stopA" ? "border-[#2563eb]" : "border-white"
              }`}
              style={{ left: `${radialStopAPct}%`, backgroundColor: colorValue }}
              onPointerDown={(event) => startRadialDrag(event, "stopA")}
            />
            <div
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white shadow-sm ${
                activeRadialThumb === "stopB" ? "border-[#2563eb]" : "border-white"
              }`}
              style={{ left: `${radialStopBPct}%`, backgroundColor: secondColorValue }}
              onPointerDown={(event) => startRadialDrag(event, "stopB")}
            />
          </div>
        </div>
      )}
      <div className="mt-1 border-b border-[color:var(--bp-stroke)]" />
    </label>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-sm"
      />
    </label>
  );
}

export function CoverGridWidthControl({
  start,
  end,
  onChange,
  compact = false,
}: {
  start: number;
  end: number;
  onChange: (nextStart: number, nextEnd: number) => void;
  compact?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const span = Math.max(1, end - start + 1);

  const columnFromClientX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return start;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const column = Math.round(ratio * (GRID_MAX_COLUMN - GRID_MIN_COLUMN)) + GRID_MIN_COLUMN;
    return clampGridColumn(column);
  }, [start]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (event: PointerEvent) => {
      const nextColumn = columnFromClientX(event.clientX);
      if (dragging === "start") {
        onChange(Math.min(nextColumn, end), end);
        return;
      }
      onChange(start, Math.max(nextColumn, start));
    };
    const handleUp = () => setDragging(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [columnFromClientX, dragging, onChange, start, end]);

  const startCenterPercent = ((start - 0.5) / MAX_BLOCK_COLUMNS) * 100;
  const endCenterPercent = ((end - 0.5) / MAX_BLOCK_COLUMNS) * 100;

  return (
    <div className={`${compact ? "" : "rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3"}`}>
      {!compact ? (
        <>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Ширина блока
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>{span} колонок</span>
            <select
              value={String(span)}
              onChange={(event) => {
                const nextSpan = Math.max(1, Math.min(12, Number(event.target.value)));
                const centered = centeredGridRange(nextSpan);
                onChange(centered.start, centered.end);
              }}
              className="rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-2 py-1 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      <div
        ref={trackRef}
        className={`relative ${compact ? "mt-0" : "mt-3"}`}
      >
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: 12 }, (_, index) => {
            const col = index + 1;
            const selected = col >= start && col <= end;
            return (
              <div
                key={col}
                className={`${compact ? "h-14" : "h-12"} rounded-sm ${
                  selected ? "bg-[#ff5a5f]" : "bg-[#c6cbd3]"
                }`}
              />
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Левая граница"
          className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9ca3af] bg-white shadow"
          style={{ left: `${startCenterPercent}%` }}
          onPointerDown={(event) => {
            event.preventDefault();
            setDragging("start");
          }}
        />
        <button
          type="button"
          aria-label="Правая граница"
          className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9ca3af] bg-white shadow"
          style={{ left: `${endCenterPercent}%` }}
          onPointerDown={(event) => {
            event.preventDefault();
            setDragging("end");
          }}
        />
      </div>
    </div>
  );
}

export function BlockEditor({
  block,
  accountName,
  branding,
  accountProfile,
  locations,
  services,
  specialists,
  promos,
  activeSectionId,
  onChange,
}: {
  block: SiteBlock;
  accountName: string;
  branding: Branding;
  accountProfile: AccountProfile;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];
  activeSectionId: string;
  onChange: (next: SiteBlock) => void;
}) {
  type SocialKey =
    | "website"
    | "instagram"
    | "whatsapp"
    | "telegram"
    | "max"
    | "vk"
    | "viber"
    | "pinterest"
    | "facebook"
    | "tiktok"
    | "youtube"
    | "twitter"
    | "dzen"
    | "ok";

  const updateData = (patch: Record<string, unknown>) => {
    onChange({ ...block, data: { ...block.data, ...patch } });
  };
  const inSection = (...ids: string[]) =>
    ids.length === 0 || ids.includes(activeSectionId) || activeSectionId === "main";

  const variantOptions = BLOCK_VARIANTS[block.type];
  const resolveSocialHrefByKey = (key: SocialKey): string | null => {
    const rawValue =
      key === "website"
        ? accountProfile.websiteUrl
        : key === "instagram"
          ? accountProfile.instagramUrl
          : key === "whatsapp"
            ? accountProfile.whatsappUrl
            : key === "telegram"
              ? accountProfile.telegramUrl
              : key === "max"
                ? accountProfile.maxUrl
                : key === "vk"
                  ? accountProfile.vkUrl
                  : key === "viber"
                    ? accountProfile.viberUrl
                    : key === "pinterest"
                      ? accountProfile.pinterestUrl
                      : key === "facebook"
                        ? accountProfile.facebookUrl
                        : key === "tiktok"
                          ? accountProfile.tiktokUrl
                          : key === "youtube"
                            ? accountProfile.youtubeUrl
                            : key === "twitter"
                              ? accountProfile.twitterUrl
                              : key === "dzen"
                                ? accountProfile.dzenUrl
                                : accountProfile.okUrl;
    const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!trimmed) return null;
    return trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  };
  const availableSecondarySources = (Object.keys(SOCIAL_LABELS) as SocialKey[]).filter(
    (key) => Boolean(resolveSocialHrefByKey(key))
  );
  const secondaryButtonSource = (block.data.secondaryButtonSource as string) ?? "auto";
  const selectedSecondarySourceMissing =
    secondaryButtonSource !== "auto" &&
    !(availableSecondarySources as string[]).includes(secondaryButtonSource);
  const [coverSlideUploadingById, setCoverSlideUploadingById] = useState<Record<string, boolean>>(
    {}
  );
  const [coverSlideUploadErrorById, setCoverSlideUploadErrorById] = useState<
    Record<string, string>
  >({});
  const [openButtonPageSelectSlideId, setOpenButtonPageSelectSlideId] = useState<string | null>(
    null
  );

  return (
    <div className="space-y-6 [&_input:not([type='checkbox']):not([type='range'])]:!rounded-none [&_input:not([type='checkbox']):not([type='range'])]:!border-0 [&_input:not([type='checkbox']):not([type='range'])]:!border-b [&_input:not([type='checkbox']):not([type='range'])]:!border-[color:var(--bp-stroke)] [&_input:not([type='checkbox']):not([type='range'])]:!bg-transparent [&_input:not([type='checkbox']):not([type='range'])]:!px-0 [&_input:not([type='checkbox']):not([type='range'])]:!py-1 [&_input:not([type='checkbox']):not([type='range'])]:!shadow-none [&_input:not([type='checkbox']):not([type='range'])]:!outline-none [&_input:not([type='checkbox']):not([type='range'])]:focus:!ring-0 [&_input:not([type='checkbox']):not([type='range'])]:focus:!outline-none [&_input:not([type='checkbox']):not([type='range'])]:focus-visible:!outline-none [&_textarea]:!rounded-none [&_textarea]:!border-0 [&_textarea]:!border-b [&_textarea]:!border-[color:var(--bp-stroke)] [&_textarea]:!bg-transparent [&_textarea]:!px-0 [&_textarea]:!py-1 [&_textarea]:!shadow-none [&_textarea]:!outline-none [&_textarea]:focus:!ring-0 [&_textarea]:focus:!outline-none [&_textarea]:focus-visible:!outline-none [&_select]:!rounded-none [&_select]:!border-0 [&_select]:!border-b [&_select]:!border-[color:var(--bp-stroke)] [&_select]:!bg-transparent [&_select]:!px-0 [&_select]:!py-1 [&_select]:!shadow-none [&_select]:!outline-none [&_select]:focus:!ring-0 [&_select]:focus:!outline-none [&_select]:focus-visible:!outline-none">
      {(variantOptions.length > 1 && block.type !== "loader" && inSection("main", "structure")) && (
        <label className="block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Вариант
          </div>
          <select
            value={block.variant}
            onChange={(event) => {
              const nextVariant = event.target.value as "v1" | "v2" | "v3" | "v4" | "v5";
              let nextBlock: SiteBlock = {
                ...block,
                variant: nextVariant,
              };
              if (block.type === "cover" && nextVariant === "v2") {
                const nextData = { ...(block.data as Record<string, unknown>) };
                const nextStyle =
                  typeof nextData.style === "object" && nextData.style ? nextData.style : {};
                nextData.align = "center";
                nextData.style = {
                  ...nextStyle,
                  textAlign: "center",
                  textAlignHeading: "center",
                  textAlignSubheading: "center",
                };
                nextBlock = {
                  ...nextBlock,
                  data: nextData,
                };
              }
              onChange(nextBlock);
            }}
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            {variantOptions.map((variant) => (
              <option key={variant} value={variant}>
                {variantsLabel[variant]}
              </option>
            ))}
          </select>
        </label>
      )}

      {block.type === "menu" && (
        <>
          {inSection("brand") && (
            <>
              <div className="space-y-2">
                <div>
                  <FlatCheckbox
                    checked={block.data.showLogo !== false}
                    onChange={(checked) => updateData({ showLogo: checked })}
                    label="Показывать логотип"
                  />
                </div>
                <div>
                  <FlatCheckbox
                    checked={block.data.showCompanyName !== false}
                    onChange={(checked) => updateData({ showCompanyName: checked })}
                    label="Показывать название компании"
                  />
                </div>
              </div>
              <FieldText
                label="Название компании"
                value={(block.data.accountTitle as string) ?? accountName}
                onChange={(value) => updateData({ accountTitle: value })}
              />
            </>
          )}
          {inSection("structure") && (
            <>
              <div>
                <FlatCheckbox
                  checked={block.data.showOnAllPages !== false}
                  onChange={(checked) => updateData({ showOnAllPages: checked })}
                  label="Показывать на всех страницах"
                />
              </div>
              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Позиция меню
                </div>
                <select
                  value={(block.data.position as string) ?? "static"}
                  onChange={(event) => updateData({ position: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="static">Статика</option>
                  <option value="sticky">Фиксация при скролле</option>
                </select>
              </label>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Пункты меню
                </div>
                {PAGE_KEYS.map((key) => {
                  const items = Array.isArray(block.data.menuItems)
                    ? (block.data.menuItems as SitePageKey[])
                    : [];
                  const checked = items.includes(key);
                  return (
                    <div key={key}>
                      <FlatCheckbox
                        checked={checked}
                        onChange={(nextChecked) => {
                          const next = nextChecked
                            ? [...items, key]
                            : items.filter((item) => item !== key);
                          updateData({ menuItems: next });
                        }}
                        label={PAGE_LABELS[key]}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {inSection("actions") && (
            <>
              <div>
                <FlatCheckbox
                  checked={Boolean(block.data.showButton)}
                  onChange={(checked) => updateData({ showButton: checked })}
                  label="Показывать кнопку записи"
                />
              </div>
              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Действие кнопки
                </div>
                <select
                  value={(block.data.ctaMode as string) ?? "booking"}
                  onChange={(event) => updateData({ ctaMode: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="booking">Запись</option>
                  <option value="phone">Телефон</option>
                </select>
              </label>
              <FieldText
                label="Телефон для кнопки"
                value={(block.data.phoneOverride as string) ?? ""}
                onChange={(value) => updateData({ phoneOverride: value })}
              />
              <FieldText
                label="Текст кнопки"
                value={(block.data.buttonText as string) ?? "Записаться"}
                onChange={(value) => updateData({ buttonText: value })}
              />
            </>
          )}
          {inSection("extras") && (
            <>
              <div className="space-y-2">
                <div>
                  <FlatCheckbox
                    checked={Boolean(block.data.showSearch)}
                    onChange={(checked) => updateData({ showSearch: checked })}
                    label="Показывать поиск"
                  />
                </div>
                <div>
                  <FlatCheckbox
                    checked={Boolean(block.data.showAccount)}
                    onChange={(checked) => updateData({ showAccount: checked })}
                    label="Иконка входа"
                  />
                </div>
                <div>
                  <FlatCheckbox
                    checked={Boolean(block.data.showThemeToggle)}
                    onChange={(checked) => updateData({ showThemeToggle: checked })}
                    label="Переключатель темы"
                  />
                </div>
                <div>
                  <FlatCheckbox
                    checked={Boolean(block.data.showSocials)}
                    onChange={(checked) => updateData({ showSocials: checked })}
                    label="Показывать соцсети"
                  />
                </div>
              </div>
              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Соцсети
                </div>
                <select
                  value={(block.data.socialsMode as string) ?? "auto"}
                  onChange={(event) => updateData({ socialsMode: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="auto">Из профиля аккаунта</option>
                  <option value="custom">Ввести вручную</option>
                </select>
              </label>
              {Boolean(block.data.showSocials) && (
                <label className="block">
                  {(() => {
                    const socialIconSize = Number.isFinite(
                      Number((block.data as Record<string, unknown>).socialIconSize)
                    )
                      ? Number((block.data as Record<string, unknown>).socialIconSize)
                      : 40;
                    const min = 24;
                    const max = 72;
                    const pct =
                      ((Math.max(min, Math.min(max, Math.round(socialIconSize))) - min) /
                        (max - min)) *
                      100;
                    return (
                      <>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                          Размер иконок соцсетей
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                          {Math.max(min, Math.min(max, Math.round(socialIconSize)))}px
                        </div>
                        <div className="relative mt-2 h-5">
                          <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--bp-stroke)]" />
                          <div
                            className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, pct))}%`,
                              backgroundColor: "#ff5a5f",
                            }}
                          />
                          <div
                            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
                            style={{
                              left: `${Math.max(0, Math.min(100, pct))}%`,
                              backgroundColor: "#ff5a5f",
                            }}
                          />
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={1}
                            value={Math.max(min, Math.min(max, Math.round(socialIconSize)))}
                            onChange={(event) =>
                              updateData({ socialIconSize: Number(event.target.value) })
                            }
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </div>
                      </>
                    );
                  })()}
                </label>
              )}
            </>
          )}
          {inSection("extras") && block.data.socialsMode === "custom" && (
            <div className="space-y-3">
              {(Object.keys(SOCIAL_LABELS) as SocialKey[]).map((key) => {
                const socials = (block.data.socialsCustom as Record<string, string>) ?? {};
                return (
                  <FieldText
                    key={key}
                    label={SOCIAL_LABELS[key]}
                    value={socials[key] ?? ""}
                    onChange={(value) =>
                      updateData({
                        socialsCustom: {
                          ...socials,
                          [key]: value,
                        },
                      })
                    }
                  />
                );
              })}
            </div>
          )}

        </>
      )}

      {block.type === "cover" && (
        <>
          {inSection("text", "main") && (
            block.variant === "v2" ? (
              <div className="space-y-3">
                {(() => {
                  const rawSlides = Array.isArray(block.data.coverSlides)
                    ? (block.data.coverSlides as Array<Record<string, unknown>>)
                    : [];
                  const slides =
                    rawSlides.length > 0
                      ? rawSlides
                      : [
                          {
                            id: "slide-1",
                            title: "Красота без компромиссов",
                            description:
                              "Запишитесь на любимую услугу в удобное время и доверяйте себя профессионалам.",
                            buttonText: "Подробнее",
                            buttonPage: "booking",
                            buttonHref: "",
                            imageUrl: "",
                          },
                        ];
                  const updateSlides = (nextSlides: Array<Record<string, unknown>>) =>
                    updateData({ coverSlides: nextSlides });
                  const addSlide = () => {
                    const slideId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    updateSlides([
                      ...slides,
                      {
                        id: slideId,
                        title: "Новый слайд",
                        description: "Добавьте описание слайда",
                        buttonText: "Подробнее",
                        buttonPage: "booking",
                        buttonHref: "",
                        imageUrl: "",
                      },
                    ]);
                  };
                  return (
                    <>
                      {slides.map((slide, index) => {
                        const slideId = String(slide.id ?? `slide-${index + 1}`);
                        const updateSlide = (patch: Record<string, unknown>) => {
                          const next = [...slides];
                          next[index] = { ...next[index], ...patch };
                          updateSlides(next);
                        };
                        const moveSlide = (dir: -1 | 1) => {
                          const target = index + dir;
                          if (target < 0 || target >= slides.length) return;
                          const next = [...slides];
                          [next[index], next[target]] = [next[target], next[index]];
                          updateSlides(next);
                        };
                        const removeSlide = () => {
                          if (slides.length <= 1) return;
                          updateSlides(slides.filter((_, slideIndex) => slideIndex !== index));
                        };
                        const uploadSlideImage = async (file: File) => {
                          setCoverSlideUploadingById((prev) => ({ ...prev, [slideId]: true }));
                          setCoverSlideUploadErrorById((prev) => ({ ...prev, [slideId]: "" }));
                          try {
                            const formData = new FormData();
                            formData.append("type", "siteCover");
                            formData.append("file", file);
                            const response = await fetch("/api/v1/crm/account/media", {
                              method: "POST",
                              body: formData,
                            });
                            const payload = await response.json().catch(() => null);
                            if (!response.ok || typeof payload?.data?.url !== "string") {
                              const message =
                                typeof payload?.error?.message === "string"
                                  ? payload.error.message
                                  : "Не удалось загрузить изображение.";
                              setCoverSlideUploadErrorById((prev) => ({
                                ...prev,
                                [slideId]: message,
                              }));
                              return;
                            }
                            updateSlide({ imageUrl: payload.data.url });
                          } catch {
                            setCoverSlideUploadErrorById((prev) => ({
                              ...prev,
                              [slideId]: "Не удалось загрузить изображение.",
                            }));
                          } finally {
                            setCoverSlideUploadingById((prev) => ({ ...prev, [slideId]: false }));
                          }
                        };
                        const isUploading = Boolean(coverSlideUploadingById[slideId]);
                        const uploadError = coverSlideUploadErrorById[slideId] ?? "";
                        const imageUrl = String(slide.imageUrl ?? "").trim();
                        const imageFileName = imageUrl
                          ? imageUrl.split("?")[0]?.split("/").pop() ?? imageUrl
                          : "";
                        return (
                          <div
                            key={slideId}
                            className="space-y-3 rounded-xl border border-[color:var(--bp-stroke)] p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--bp-muted)]">
                                Карточка #{index + 1}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => moveSlide(-1)}
                                  className="rounded-md border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                                  disabled={index === 0}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSlide(1)}
                                  className="rounded-md border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                                  disabled={index === slides.length - 1}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={removeSlide}
                                  className="rounded-md border border-[color:var(--bp-stroke)] px-2 py-1 text-xs text-red-600"
                                  disabled={slides.length <= 1}
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                            <FieldText
                              label="Заголовок"
                              value={String(slide.title ?? "")}
                              onChange={(value) => updateSlide({ title: value })}
                            />
                            <FieldTextarea
                              label="Описание"
                              value={String(slide.description ?? "")}
                              onChange={(value) => updateSlide({ description: value })}
                            />
                            <FieldText
                              label="Текст кнопки"
                              value={String(slide.buttonText ?? "Подробнее")}
                              onChange={(value) => updateSlide({ buttonText: value })}
                            />
                            <label className="block text-sm">
                              Страница кнопки
                              {(() => {
                                const buttonPageValue = String(slide.buttonPage ?? "");
                                const selectedLabel =
                                  !buttonPageValue
                                    ? "Не выбрано"
                                    : PAGE_KEYS.includes(buttonPageValue as SitePageKey)
                                      ? PAGE_LABELS[buttonPageValue as SitePageKey]
                                      : buttonPageValue.startsWith("location:")
                                        ? locations.find(
                                            (location) =>
                                              `location:${location.id}` === buttonPageValue
                                          )?.name ?? "Локация"
                                        : buttonPageValue.startsWith("specialist:")
                                          ? specialists.find(
                                              (specialist) =>
                                                `specialist:${specialist.id}` === buttonPageValue
                                            )?.name ?? "Специалист"
                                          : buttonPageValue.startsWith("service:")
                                            ? services.find(
                                                (service) =>
                                                  `service:${service.id}` === buttonPageValue
                                              )?.name ?? "Услуга"
                                            : "Не выбрано";
                                const isOpen = openButtonPageSelectSlideId === slideId;
                                const selectButtonClass =
                                  "mt-2 flex h-8 w-full items-center justify-between rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 text-left";
                                const optionClass =
                                  "block w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--bp-surface)]";
                                return (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenButtonPageSelectSlideId((prev) =>
                                          prev === slideId ? null : slideId
                                        )
                                      }
                                      className={selectButtonClass}
                                    >
                                      <span className="truncate">{selectedLabel}</span>
                                      <span className="text-xs text-[color:var(--bp-muted)]">▾</span>
                                    </button>
                                    {isOpen ? (
                                      <div className="absolute z-[40] mt-1 w-full rounded-none border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] shadow-lg">
                                        <div className="max-h-72 overflow-y-auto py-1 [scrollbar-width:thin] [scrollbar-color:#ff5a5f_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#ff5a5f] [&::-webkit-scrollbar-track]:bg-transparent">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              updateSlide({ buttonPage: null, buttonHref: "" });
                                              setOpenButtonPageSelectSlideId(null);
                                            }}
                                            className={optionClass}
                                          >
                                            Не выбрано
                                          </button>
                                          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">
                                            Страницы
                                          </div>
                                          {PAGE_KEYS.map((key) => (
                                            <button
                                              key={`${slideId}-page-${key}`}
                                              type="button"
                                              onClick={() => {
                                                updateSlide({ buttonPage: key, buttonHref: "" });
                                                setOpenButtonPageSelectSlideId(null);
                                              }}
                                              className={optionClass}
                                            >
                                              {PAGE_LABELS[key]}
                                            </button>
                                          ))}
                                          {locations.length > 0 ? (
                                            <>
                                              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">
                                                Локации
                                              </div>
                                              {locations.map((location) => (
                                                <button
                                                  key={`${slideId}-location-${location.id}`}
                                                  type="button"
                                                  onClick={() => {
                                                    updateSlide({
                                                      buttonPage: `location:${location.id}`,
                                                      buttonHref: "",
                                                    });
                                                    setOpenButtonPageSelectSlideId(null);
                                                  }}
                                                  className={optionClass}
                                                >
                                                  {location.name}
                                                </button>
                                              ))}
                                            </>
                                          ) : null}
                                          {specialists.length > 0 ? (
                                            <>
                                              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">
                                                Специалисты
                                              </div>
                                              {specialists.map((specialist) => (
                                                <button
                                                  key={`${slideId}-specialist-${specialist.id}`}
                                                  type="button"
                                                  onClick={() => {
                                                    updateSlide({
                                                      buttonPage: `specialist:${specialist.id}`,
                                                      buttonHref: "",
                                                    });
                                                    setOpenButtonPageSelectSlideId(null);
                                                  }}
                                                  className={optionClass}
                                                >
                                                  {specialist.name}
                                                </button>
                                              ))}
                                            </>
                                          ) : null}
                                          {services.length > 0 ? (
                                            <>
                                              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">
                                                Услуги
                                              </div>
                                              {services.map((service) => (
                                                <button
                                                  key={`${slideId}-service-${service.id}`}
                                                  type="button"
                                                  onClick={() => {
                                                    updateSlide({
                                                      buttonPage: `service:${service.id}`,
                                                      buttonHref: "",
                                                    });
                                                    setOpenButtonPageSelectSlideId(null);
                                                  }}
                                                  className={optionClass}
                                                >
                                                  {service.name}
                                                </button>
                                              ))}
                                            </>
                                          ) : null}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </label>
                            <div className="space-y-2">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                                Изображение
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-[#111827] px-5 py-2 text-sm font-medium text-white">
                                  <input
                                    type="file"
                                    accept="image/*,.heic,.heif"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (!file) return;
                                      void uploadSlideImage(file);
                                      event.currentTarget.value = "";
                                    }}
                                  />
                                  {isUploading ? "Загрузка..." : "Загрузить файл"}
                                </label>
                              </div>
                              {imageUrl ? (
                                <div className="flex items-center gap-3 py-1">
                                  <img src={imageUrl} alt="" className="h-20 w-32 rounded-md object-cover" />
                                  <div className="min-w-0 flex-1 text-xs text-[color:var(--bp-muted)]">
                                    <div className="truncate">{imageFileName}</div>
                                  </div>
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => updateSlide({ imageUrl: "" })}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        updateSlide({ imageUrl: "" });
                                      }
                                    }}
                                    className="inline-flex cursor-pointer items-center justify-center text-[color:var(--bp-ink)]"
                                    aria-label="Удалить изображение"
                                  >
                                    <svg
                                      viewBox="0 0 448 512"
                                      className="h-4 w-4"
                                      fill="currentColor"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path d="M166.2-16c-13.3 0-25.3 8.3-30 20.8L120 48H24C10.7 48 0 58.7 0 72s10.7 24 24 24h400c13.3 0 24-10.7 24-24s-10.7-24-24-24h-96L311.8 4.8c-4.7-12.5-16.6-20.8-30-20.8zM32 144v304c0 35.3 28.7 64 64 64h256c35.3 0 64-28.7 64-64V144h-48v304c0 8.8-7.2 16-16 16H96c-8.8 0-16-7.2-16-16V144zm160 72c0-13.3-10.7-24-24-24s-24 10.7-24 24v176c0 13.3 10.7 24 24 24s24-10.7 24-24zm112 0c0-13.3-10.7-24-24-24s-24 10.7-24 24v176c0 13.3 10.7 24 24 24s24-10.7 24-24z" />
                                    </svg>
                                  </span>
                                </div>
                              ) : (
                                <div className="rounded-md border border-dashed border-[color:var(--bp-stroke)] px-3 py-4 text-center text-xs text-[color:var(--bp-muted)]">
                                  Изображение не выбрано
                                </div>
                              )}
                              {uploadError ? (
                                <div className="text-xs text-[#c2410c]">{uploadError}</div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={addSlide}
                        className="w-full rounded-lg border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-medium"
                      >
                        Добавить слайд
                      </button>
                    </>
                  );
                })()}
              </div>
            ) : (
              <>
                <FieldText
                  label="Заголовок"
                  value={(block.data.title as string) ?? ""}
                  onChange={(value) => updateData({ title: value })}
                />
                <FieldText
                  label="Подзаголовок"
                  value={(block.data.subtitle as string) ?? ""}
                  onChange={(value) => updateData({ subtitle: value })}
                />
                <FieldTextarea
                  label="Описание"
                  value={(block.data.description as string) ?? ""}
                  onChange={(value) => updateData({ description: value })}
                />
              </>
            )
          )}
          {inSection("actions", "main") && block.variant !== "v2" && (
            <>
              <div className="grid grid-cols-[auto,1fr] items-end gap-4">
                <FlatCheckbox
                  checked={Boolean(block.data.showButton)}
                  onChange={(checked) => updateData({ showButton: checked })}
                  label="Показывать кнопку записи"
                />
                <FieldText
                  label="Текст кнопки"
                  value={(block.data.buttonText as string) ?? ""}
                  onChange={(value) => updateData({ buttonText: value })}
                />
              </div>
              <FlatCheckbox
                checked={Boolean(block.data.showSecondaryButton)}
                onChange={(checked) => updateData({ showSecondaryButton: checked })}
                label="Показывать вторую кнопку (соцсети)"
              />
              {Boolean(block.data.showSecondaryButton) && (
                <>
                  <FieldText
                    label="Текст второй кнопки"
                    value={(block.data.secondaryButtonText as string) ?? "Наши соцсети"}
                    onChange={(value) => updateData({ secondaryButtonText: value })}
                  />
                  <label className="block">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                      Ссылка второй кнопки
                    </div>
                    <select
                      value={secondaryButtonSource}
                      onChange={(event) =>
                        updateData({ secondaryButtonSource: event.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                    >
                      <option value="auto">Авто (первая доступная)</option>
                      {selectedSecondarySourceMissing && (
                        <option value={secondaryButtonSource}>
                          {secondaryButtonSource} (не заполнено в профиле)
                        </option>
                      )}
                      {availableSecondarySources.map((key) => (
                        <option key={key} value={key}>
                          {SOCIAL_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {availableSecondarySources.length === 0 && (
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      В профиле аккаунта нет заполненных ссылок для второй кнопки.
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {inSection("media", "main") && (
            block.variant === "v2" ? (
              <div />
            ) : (
              <CoverImageEditor
                data={block.data}
                branding={branding}
                onChange={updateData}
              />
            )
          )}
        </>
      )}

      {block.type === "about" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldTextarea
            label="Текст"
            value={(block.data.text as string) ?? ""}
            onChange={(value) => updateData({ text: value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showContacts)}
              onChange={(event) => updateData({ showContacts: event.target.checked })}
            />
            Показывать контакты из профиля
          </label>
        </>
      )}

      {block.type === "loader" && (
        <>
          {(() => {
            const parsed = parseBackdropColor(block.data.backdropColor);
            const backdropHex =
              typeof block.data.backdropHex === "string" && block.data.backdropHex
                ? (block.data.backdropHex as string)
                : parsed.hex;
            const backdropOpacity =
              Number.isFinite(Number(block.data.backdropOpacity))
                ? clamp01(Number(block.data.backdropOpacity))
                : parsed.alpha;
            const updateBackdrop = (hex: string, alpha: number) =>
              updateData({
                backdropHex: hex,
                backdropOpacity: alpha,
                backdropColor: hexToRgbaString(hex, alpha),
              });

            return (
              <>
          <label className="text-sm">
            Вид лоадера
            <select
              value={block.variant}
              onChange={(event) =>
                onChange({
                  ...block,
                  variant: event.target.value as "v1" | "v2" | "v3" | "v4" | "v5",
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="v1">Вращающийся круг</option>
              <option value="v2">Точки (волна)</option>
              <option value="v3">Пульсирующий круг</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.enabled !== false}
              onChange={(event) => updateData({ enabled: event.target.checked })}
            />
            Включить лоадер
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.showPageOverlay !== false}
              onChange={(event) => updateData({ showPageOverlay: event.target.checked })}
            />
            Показывать на сайте
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.showBookingInline !== false}
              onChange={(event) => updateData({ showBookingInline: event.target.checked })}
            />
            Показывать в онлайн-записи
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.backdropEnabled)}
              onChange={(event) => updateData({ backdropEnabled: event.target.checked })}
            />
            Затемнять фон под лоадером
          </label>
          <ColorField
            label="Цвет затемнения"
            value={backdropHex}
            placeholder="#111827"
            onChange={(value) => updateBackdrop(value, backdropOpacity)}
          />
          <label className="text-sm">
            Прозрачность затемнения: {Math.round(backdropOpacity * 100)}%
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(backdropOpacity * 100)}
              onChange={(event) =>
                updateBackdrop(backdropHex, Number(event.target.value) / 100)
              }
              className="mt-2 w-full"
            />
          </label>
          <ColorField
            label="Цвет лоадера"
            value={(block.data.color as string) ?? "#111827"}
            placeholder="#111827"
            onChange={(value) => updateData({ color: value })}
          />
          <label className="text-sm">
            Размер: {Number(block.data.size ?? 36)} px
            <input
              type="range"
              min={16}
              max={120}
              step={2}
              value={Number(block.data.size ?? 36)}
              onChange={(event) => updateData({ size: Number(event.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm">
            Скорость анимации: {Number(block.data.speedMs ?? 900)} мс
            <input
              type="range"
              min={300}
              max={4000}
              step={50}
              value={Number(block.data.speedMs ?? 900)}
              onChange={(event) => updateData({ speedMs: Number(event.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.fixedDurationEnabled)}
              onChange={(event) => updateData({ fixedDurationEnabled: event.target.checked })}
            />
            Фиксированное время показа лоадера
          </label>
          <label className="text-sm">
            Время показа: {Number(block.data.fixedDurationSec ?? 1)} сек
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              disabled={!Boolean(block.data.fixedDurationEnabled)}
              value={Number(block.data.fixedDurationSec ?? 1)}
              onChange={(event) =>
                updateData({ fixedDurationSec: Number(event.target.value) })
              }
              className="mt-2 w-full disabled:opacity-40"
            />
          </label>
          <label className="text-sm">
            Толщина: {Number(block.data.thickness ?? 3)} px
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={Number(block.data.thickness ?? 3)}
              onChange={(event) => updateData({ thickness: Number(event.target.value) })}
              className="mt-2 w-full"
            />
          </label>
              </>
            );
          })()}
        </>
      )}

      {block.type === "locations" && (
        <>
          <EntityListEditor
            block={block}
            items={locations.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.showAddress !== false}
              onChange={(event) => updateData({ showAddress: event.target.checked })}
            />
            Показывать адрес
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.showPhone !== false}
              onChange={(event) => updateData({ showPhone: event.target.checked })}
            />
            Показывать телефон
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showContacts)}
              onChange={(event) => updateData({ showContacts: event.target.checked })}
            />
            Показывать соцсети аккаунта
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showButton)}
              onChange={(event) => updateData({ showButton: event.target.checked })}
            />
            Показывать кнопку записи
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.buttonText as string) ?? ""}
            onChange={(value) => updateData({ buttonText: value })}
          />

        </>
      )}

      {block.type === "services" && (
        <>
          <EntityListEditor
            block={block}
            items={services.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />
          <label className="text-sm">
            Карточек в ряд
            <select
              value={String(block.data.cardsPerRow ?? 3)}
              onChange={(event) =>
                updateData({
                  cardsPerRow: Number(event.target.value),
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>
          <label className="text-sm">
            Фильтр по локации
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Фильтр по специалисту
            <select
              value={String(block.data.specialistId ?? "")}
              onChange={(event) =>
                updateData({
                  specialistId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {specialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showPrice)}
              onChange={(event) => updateData({ showPrice: event.target.checked })}
            />
            Показывать цену
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showDuration)}
              onChange={(event) =>
                updateData({ showDuration: event.target.checked })
              }
            />
            Показывать длительность
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showButton)}
              onChange={(event) => updateData({ showButton: event.target.checked })}
            />
            Показывать кнопку записи
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.buttonText as string) ?? ""}
            onChange={(value) => updateData({ buttonText: value })}
          />

        </>
      )}

      {block.type === "specialists" && (
        <>
          <EntityListEditor
            block={block}
            items={specialists.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />
          <label className="text-sm">
            Локация для записи
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showButton)}
              onChange={(event) => updateData({ showButton: event.target.checked })}
            />
            Показывать кнопку записи
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.buttonText as string) ?? ""}
            onChange={(value) => updateData({ buttonText: value })}
          />

        </>
      )}

      {block.type === "promos" && (
        <EntityListEditor
          block={block}
          items={promos.map((item) => ({ id: item.id, label: item.name }))}
          onChange={updateData}
        />
      )}
      {block.type === "works" && (
        <>
          <FieldText
            label="Заголовок блока"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Источник работ
            <select
              value={(block.data.source as string) ?? "locations"}
              onChange={(event) => updateData({ source: event.target.value })}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="locations">Локации</option>
              <option value="specialists">Специалисты</option>
              <option value="services">Услуги</option>
            </select>
          </label>
          <label className="text-sm">
            Количество слайдов
            <input
              type="number"
              min={1}
              max={30}
              value={Number(block.data.maxSlides ?? 12)}
              onChange={(event) =>
                updateData({
                  maxSlides: event.target.value ? Number(event.target.value) : 12,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            />
          </label>
          <EntityListEditor
            block={block}
            showTitleFields={false}
            showUseCurrent={true}
            items={
              (block.data.source as string) === "services"
                ? services.map((item) => ({ id: item.id, label: item.name }))
                : (block.data.source as string) === "specialists"
                  ? specialists.map((item) => ({ id: item.id, label: item.name }))
                  : locations.map((item) => ({ id: item.id, label: item.name }))
            }
            onChange={updateData}
          />
        </>
      )}

      {block.type === "reviews" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Количество отзывов
            <input
              type="number"
              min={1}
              max={24}
              value={Number(block.data.limit ?? 6)}
              onChange={(event) =>
                updateData({
                  limit: event.target.value ? Number(event.target.value) : 6,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            />
          </label>
        </>
      )}

      {block.type === "contacts" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Локация для контактов
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

            {block.type === "aisha" && (
        <>
          <FieldText
            label="Заголовок виджета"
            value={(block.data.title as string) ?? "AI-ассистент записи"}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Имя ассистента"
            value={(block.data.assistantName as string) ?? "Ассистент"}
            onChange={(value) => updateData({ assistantName: value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.enabled !== false}
              onChange={(event) => updateData({ enabled: event.target.checked })}
            />
            {"Показывать AI-ассистента на сайте"}
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.label as string) ?? "AI-ассистент"}
            onChange={(value) => updateData({ label: value })}
          />
        </>
      )}

      {block.type !== "menu" &&
        block.type !== "cover" &&
        block.type !== "about" &&
        block.type !== "loader" &&
        !isSystemBlockType(block.type) &&
        block.type !== "works" &&
        block.type !== "reviews" &&
        block.type !== "contacts" &&
        block.type !== "aisha" && (
          <>
            <FieldText
              label="Заголовок"
              value={(block.data.title as string) ?? ""}
              onChange={(value) => updateData({ title: value })}
            />
            <FieldText
              label="Подзаголовок"
              value={(block.data.subtitle as string) ?? ""}
              onChange={(value) => updateData({ subtitle: value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(block.data.showButton)}
                onChange={(event) =>
                  updateData({ showButton: event.target.checked })
                }
              />
              Показывать кнопку записи
            </label>
            <FieldText
              label="Текст кнопки"
              value={(block.data.buttonText as string) ?? "Записаться"}
              onChange={(value) => updateData({ buttonText: value })}
            />
          </>
        )}
    </div>
  );
}

export function BlockStyleEditor({
  block,
  theme,
  activeSectionId,
  onChange,
}: {
  block: SiteBlock;
  theme: SiteTheme;
  activeSectionId: string;
  onChange: (next: SiteBlock) => void;
}) {
  const style = normalizeBlockStyle(block, theme);
  const resolvedBlockColumns = clampBlockColumns(
    style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS,
    block.type
  );
  const bookingPreset = bookingPresetFromColumns(resolvedBlockColumns);
  const rawStyle = (block.data.style as Record<string, unknown>) ?? {};
  const readRaw = (key: string) =>
    typeof rawStyle[key] === "string" ? (rawStyle[key] as string) : "";
  const toDisplay = (value: string) => value;
  const toStore = (value: string) =>
    value.trim() === "" || value.trim().toLowerCase() === "transparent"
      ? "transparent"
      : value.trim();
  const toStoreMenuLightBg = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "transparent") {
      return "transparent";
    }
    return trimmed;
  };
  const toStoreMenuDarkBg = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "transparent") {
      return "transparent";
    }
    return trimmed;
  };
  const lightSectionBg = readRaw("sectionBgLight") || readRaw("sectionBg");
  const darkSectionBg = readRaw("sectionBgDark");
  const lightBlockBg = readRaw("blockBgLight") || readRaw("blockBg");
  const darkBlockBg = readRaw("blockBgDark");
  const lightSubBlockBg = readRaw("subBlockBgLight") || readRaw("subBlockBg");
  const darkSubBlockBg = readRaw("subBlockBgDark");
  const lightBorderColor = readRaw("borderColorLight") || readRaw("borderColor");
  const darkBorderColor = readRaw("borderColorDark");
  const lightButtonColor = readRaw("buttonColorLight") || readRaw("buttonColor");
  const darkButtonColor = readRaw("buttonColorDark");
  const lightButtonTextColor =
    readRaw("buttonTextColorLight") || readRaw("buttonTextColor");
  const darkButtonTextColor = readRaw("buttonTextColorDark");
  const lightTextColor = readRaw("textColorLight") || readRaw("textColor");
  const darkTextColor = readRaw("textColorDark");
  const lightMutedColor = readRaw("mutedColorLight") || readRaw("mutedColor");
  const darkMutedColor = readRaw("mutedColorDark");
  const lightAssistantBubbleColor =
    readRaw("assistantBubbleColorLight") || readRaw("assistantBubbleColor");
  const darkAssistantBubbleColor = readRaw("assistantBubbleColorDark");
  const lightAssistantTextColor =
    readRaw("assistantTextColorLight") || readRaw("assistantTextColor");
  const darkAssistantTextColor = readRaw("assistantTextColorDark");
  const lightClientBubbleColor =
    readRaw("clientBubbleColorLight") || readRaw("clientBubbleColor");
  const darkClientBubbleColor = readRaw("clientBubbleColorDark");
  const lightClientTextColor =
    readRaw("clientTextColorLight") || readRaw("clientTextColor");
  const darkClientTextColor = readRaw("clientTextColorDark");
  const lightHeaderBgColor = readRaw("headerBgColorLight") || readRaw("headerBgColor");
  const darkHeaderBgColor = readRaw("headerBgColorDark");
  const lightHeaderTextColor =
    readRaw("headerTextColorLight") || readRaw("headerTextColor");
  const darkHeaderTextColor = readRaw("headerTextColorDark");
  const lightQuickReplyButtonColor =
    readRaw("quickReplyButtonColorLight") || readRaw("quickReplyButtonColor");
  const darkQuickReplyButtonColor = readRaw("quickReplyButtonColorDark");
  const lightQuickReplyTextColor =
    readRaw("quickReplyTextColorLight") || readRaw("quickReplyTextColor");
  const darkQuickReplyTextColor = readRaw("quickReplyTextColorDark");
  const update = (patch: Partial<BlockStyle>) => {
    onChange(updateBlockStyle(block, patch));
  };
  const updateCoverData = (patch: Record<string, unknown>) => {
    onChange({
      ...block,
      data: {
        ...(block.data as Record<string, unknown>),
        ...patch,
      },
    });
  };
  const applyGridRange = (nextStart: number, nextEnd: number) => {
    const safeStart = clampGridColumn(nextStart);
    const safeEnd = Math.max(safeStart, clampGridColumn(nextEnd));
    const nextColumns = Math.max(1, safeEnd - safeStart + 1);
    const nextWidth = Math.round((nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE);
    update({
      useCustomWidth: true,
      blockWidth: nextWidth,
      blockWidthColumns: nextColumns,
      gridStartColumn: safeStart,
      gridEndColumn: safeEnd,
    });
  };
  const inSection = (...ids: string[]) =>
    ids.length === 0 || ids.includes(activeSectionId);
  const coverData = (block.data as Record<string, unknown>) ?? {};
  const resolveCoverTextColorInput = (raw: unknown, fallback: string) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return fallback;
    if (isValidColorValue(value)) return value;
    return fallback;
  };
  const coverSubtitleColorInput = resolveCoverTextColorInput(
    coverData.coverSubtitleColor,
    "#ffffff"
  );
  const coverDescriptionColorInput = resolveCoverTextColorInput(
    coverData.coverDescriptionColor,
    "#ffffff"
  );
  const renderFlatSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ value: string; label: string }>
  ) => (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{
            borderTop: 0,
            borderLeft: 0,
            borderRight: 0,
            borderBottom: 0,
            borderRadius: 0,
            boxShadow: "none",
            backgroundColor: "transparent",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        >
          {options.map((option) => (
            <option key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
          ▾
        </span>
      </div>
    </label>
  );
  const renderFlatNumber = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void
  ) => (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] bg-transparent pb-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full rounded-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            appearance: "auto",
          }}
        />
        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      {inSection("layout") && block.type === "menu" && (
        <>
          {(() => {
            const minMenuHeight = block.variant === "v1" ? 40 : 30;
            const currentMenuHeight = Number.isFinite(
              Number((block.data as Record<string, unknown>).menuHeight)
            )
              ? Number((block.data as Record<string, unknown>).menuHeight)
              : block.variant === "v1"
                ? 64
                : 56;
            const menuHeight = Math.max(
              minMenuHeight,
              Math.min(96, Math.round(currentMenuHeight))
            );
            const pct =
              ((menuHeight - minMenuHeight) / (96 - minMenuHeight)) * 100;
            return (
              <div className="mt-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Высота меню
                </div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                  {menuHeight}px
                </div>
                <div className="relative mt-2 h-5">
                  <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--bp-stroke)]" />
                  <div
                    className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, pct))}%`,
                      backgroundColor: "#ff5a5f",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
                    style={{
                      left: `${Math.max(0, Math.min(100, pct))}%`,
                      backgroundColor: "#ff5a5f",
                    }}
                  />
                  <input
                    type="range"
                    min={minMenuHeight}
                    max={96}
                    step={1}
                    value={menuHeight}
                    onChange={(event) =>
                      onChange({
                        ...block,
                        data: {
                          ...block.data,
                          menuHeight: Number(event.target.value),
                        },
                      })
                    }
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
              </div>
            );
          })()}

          {(() => {
            const menuMarginTopLines = Math.max(
              0,
              Math.min(
                7,
                Math.round((style.marginTop / COVER_LINE_STEP_PX) * 2) / 2
              )
            );
            const menuMarginBottomLines = Math.max(
              0,
              Math.min(
                7,
                Math.round((style.marginBottom / COVER_LINE_STEP_PX) * 2) / 2
              )
            );
            return (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Отступ сверху
                  <div className="relative mt-2">
                    <select
                      value={String(menuMarginTopLines)}
                      onChange={(event) =>
                        update({
                          marginTop: Math.round(
                            Number(event.target.value) * COVER_LINE_STEP_PX
                          ),
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
                        <option key={`menu-top-${lineValue}`} value={lineValue}>
                          {formatCoverLineLabel(lineValue)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                      ▾
                    </span>
                  </div>
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Отступ снизу
                  <div className="relative mt-2">
                    <select
                      value={String(menuMarginBottomLines)}
                      onChange={(event) =>
                        update({
                          marginBottom: Math.round(
                            Number(event.target.value) * COVER_LINE_STEP_PX
                          ),
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
                        <option key={`menu-bottom-${lineValue}`} value={lineValue}>
                          {formatCoverLineLabel(lineValue)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                      ▾
                    </span>
                  </div>
                </label>
              </div>
            );
          })()}
        </>
      )}
      {inSection("layout") && block.type !== "aisha" && block.type !== "menu" && (
        <label className="text-sm">
          Отступ сверху: {style.marginTop}px
          <input
            type="range"
            min={0}
            max={120}
            step={2}
            value={style.marginTop}
            onChange={(event) => update({ marginTop: Number(event.target.value) })}
            className="mt-2 w-full"
          />
        </label>
      )}
      {inSection("layout") && block.type !== "aisha" && block.type !== "menu" && (
        <label className="text-sm">
          Отступ снизу: {style.marginBottom}px
          <input
            type="range"
            min={0}
            max={120}
            step={2}
            value={style.marginBottom}
            onChange={(event) => update({ marginBottom: Number(event.target.value) })}
            className="mt-2 w-full"
          />
        </label>
      )}
      {inSection("layout") && block.type === "booking" && (
      <label className="text-sm">
        {`Ширина контейнера: ${bookingPreset}`}
        <input
          type="range"
          min={BOOKING_MIN_PRESET}
          max={BOOKING_MAX_PRESET}
          step={1}
          value={bookingPreset}
          onChange={(event) => {
            const nextColumns = bookingColumnsFromPreset(Number(event.target.value));
            const nextWidth = Math.round(
              (nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE
            );
            update({
              useCustomWidth: true,
              blockWidth: nextWidth,
              blockWidthColumns: nextColumns,
            });
          }}
          className="mt-2 w-full"
        />
      </label>
      )}
      {inSection("layout") && block.type === "cover" && (
      <CoverGridWidthControl
        start={style.gridStartColumn ?? centeredGridRange(resolvedBlockColumns).start}
        end={style.gridEndColumn ?? centeredGridRange(resolvedBlockColumns).end}
        onChange={applyGridRange}
      />
      )}
      {inSection("layout") && block.type === "cover" && (
        <div className="grid grid-cols-2 gap-3">
          {renderFlatSelect(
            "Позиция текста",
            style.textAlign ?? "left",
            (value) =>
              update({
                textAlign:
                  value === "center" || value === "right" ? value : "left",
                textAlignHeading:
                  value === "center" || value === "right" ? value : "left",
                textAlignSubheading:
                  value === "center" || value === "right" ? value : "left",
              }),
            [
              { value: "left", label: "Слева" },
              { value: "center", label: "По центру" },
              { value: "right", label: "Справа" },
            ]
          )}
          {renderFlatSelect(
            "Позиция по вертикали",
            typeof coverData.coverContentVerticalAlign === "string"
              ? String(coverData.coverContentVerticalAlign)
              : "center",
            (value) =>
              updateCoverData({
                coverContentVerticalAlign:
                  value === "top" || value === "bottom" ? value : "center",
              }),
            [
              { value: "top", label: "Сверху" },
              { value: "center", label: "По центру" },
              { value: "bottom", label: "Снизу" },
            ]
          )}
        </div>
      )}
      {inSection("layout") && block.type !== "menu" && block.type !== "booking" && block.type !== "aisha" && block.type !== "cover" && (
      <>
        <div className="text-sm">
          Ширина блока: {Math.max(1, (style.gridEndColumn ?? 12) - (style.gridStartColumn ?? 1) + 1)}/12
        </div>
        <label className="text-sm">
          Левая граница сетки: {style.gridStartColumn ?? centeredGridRange(resolvedBlockColumns).start}
          <input
            type="range"
            min={GRID_MIN_COLUMN}
            max={style.gridEndColumn ?? GRID_MAX_COLUMN}
            step={1}
            value={style.gridStartColumn ?? centeredGridRange(resolvedBlockColumns).start}
            onChange={(event) => {
              const nextStart = clampGridColumn(Number(event.target.value));
              const currentEnd = style.gridEndColumn ?? centeredGridRange(resolvedBlockColumns).end;
              const nextEnd = Math.max(nextStart, currentEnd);
              applyGridRange(nextStart, nextEnd);
            }}
            className="mt-2 w-full"
          />
        </label>
        <label className="text-sm">
          Правая граница сетки: {style.gridEndColumn ?? centeredGridRange(resolvedBlockColumns).end}
          <input
            type="range"
            min={style.gridStartColumn ?? GRID_MIN_COLUMN}
            max={GRID_MAX_COLUMN}
            step={1}
            value={style.gridEndColumn ?? centeredGridRange(resolvedBlockColumns).end}
            onChange={(event) => {
              const currentStart = style.gridStartColumn ?? centeredGridRange(resolvedBlockColumns).start;
              const nextEnd = clampGridColumn(Number(event.target.value));
              const safeEnd = Math.max(currentStart, nextEnd);
              applyGridRange(currentStart, safeEnd);
            }}
            className="mt-2 w-full"
          />
          {block.type === "works" && block.variant === "v2" && (
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
              В варианте 2 сетка регулирует ширину и смещение текста поверх галереи.
            </div>
          )}
        </label>
      </>
      )}
      {block.type === "cover" && inSection("layout") && (
        <label className="text-sm">
          Высота изображения: {Number(block.data.coverHeight ?? 100)}vh
          <input
            type="range"
            min={60}
            max={140}
            step={1}
            value={Number(block.data.coverHeight ?? 100)}
            onChange={(event) =>
              onChange({
                ...block,
                data: {
                  ...block.data,
                  coverHeight: Number(event.target.value),
                },
              })
            }
            className="mt-2 w-full"
          />
        </label>
      )}
      {inSection("layout") && block.type !== "works" && block.type !== "cover" && block.type !== "aisha" && block.type !== "menu" && (
      <label className="text-sm">
        Радиус блока: {style.radius ?? theme.radius}px
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={style.radius ?? theme.radius}
          onChange={(event) => update({ radius: Number(event.target.value) })}
          className="mt-2 w-full"
        />
      </label>
      )}
      {inSection("layout") && block.type !== "aisha" && block.type !== "menu" && (
      <label className="text-sm">
        Радиус кнопки: {style.buttonRadius ?? theme.buttonRadius}px
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={style.buttonRadius ?? theme.buttonRadius}
          onChange={(event) =>
            update({ buttonRadius: Number(event.target.value) })
          }
          className="mt-2 w-full"
        />
      </label>
      )}
      {inSection("layout") && block.type === "aisha" && (
      <>
        <label className="text-sm">
          {"Отступ снизу:"} {Number(block.data.offsetBottomPx ?? 16)}px
          <input type="range" min={8} max={64} step={1} value={Number(block.data.offsetBottomPx ?? 16)} onChange={(event) => onChange({ ...block, data: { ...block.data, offsetBottomPx: Number(event.target.value) } })} className="mt-2 w-full" />
        </label>
        <label className="text-sm">
          {"Отступ справа:"} {Number(block.data.offsetRightPx ?? 16)}px
          <input type="range" min={8} max={160} step={1} value={Number(block.data.offsetRightPx ?? 16)} onChange={(event) => onChange({ ...block, data: { ...block.data, offsetRightPx: Number(event.target.value) } })} className="mt-2 w-full" />
        </label>
      </>
      )}
      {/* menu layout is rendered выше в одном блоке */}
      {block.type === "works" && inSection("layout") && (
        <>
          <label className="text-sm">
            Высота галереи: {Number(block.data.galleryHeight ?? 550)}px
            <input
              type="range"
              min={220}
              max={900}
              step={10}
              value={Number(block.data.galleryHeight ?? 550)}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    galleryHeight: Number(event.target.value),
                  },
                })
              }
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm">
            Радиус скругления изображений: {Number(block.data.imageRadius ?? 0)}px
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={Number(block.data.imageRadius ?? 0)}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    imageRadius: Number(event.target.value),
                  },
                })
              }
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm">
            Масштабирование изображения
            <select
              value={String(block.data.imageFit ?? "cover")}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    imageFit: event.target.value === "contain" ? "contain" : "cover",
                  },
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="cover">Заполнять область</option>
              <option value="contain">Вписывать в область</option>
            </select>
          </label>
          <label className="text-sm">
            Стиль стрелок
            <select
              value={
                block.data.arrowVariant === "angle" || block.data.arrowVariant === "triangle"
                  ? String(block.data.arrowVariant)
                  : "chevron"
              }
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    arrowVariant:
                      event.target.value === "angle" || event.target.value === "triangle"
                        ? event.target.value
                        : "chevron",
                  },
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="chevron">Классические</option>
              <option value="angle">Угловые</option>
              <option value="triangle">Треугольные</option>
            </select>
          </label>
        </>
      )}
      {inSection("colors") && (
        <div className="space-y-4">
          {block.type === "menu" && (
            <>
              {(() => {
                const data = block.data as Record<string, unknown>;
                const modeRaw =
                  typeof data.menuBlockBackgroundMode === "string"
                    ? data.menuBlockBackgroundMode
                    : "";
                const mode: CoverBackgroundMode =
                  modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
                return (
                  <TildaBackgroundColorField
                    label="Цвет блока"
                    value={String(data.menuBlockBackgroundFrom ?? lightBlockBg ?? "")}
                    mode={mode}
                    secondValue={String(data.menuBlockBackgroundTo ?? "")}
                    angle={Number(data.menuBlockBackgroundAngle ?? 135)}
                    radialStopA={Number(data.menuBlockBackgroundStopA ?? 0)}
                    radialStopB={Number(data.menuBlockBackgroundStopB ?? 100)}
                    placeholder={theme.panelColor}
                    onModeChange={(nextMode) =>
                      updateCoverData({ menuBlockBackgroundMode: nextMode })
                    }
                    onSecondChange={(value) =>
                      updateCoverData({ menuBlockBackgroundTo: value })
                    }
                    onAngleChange={(value) =>
                      updateCoverData({ menuBlockBackgroundAngle: value })
                    }
                    onRadialStopAChange={(value) =>
                      updateCoverData({ menuBlockBackgroundStopA: value })
                    }
                    onRadialStopBChange={(value) =>
                      updateCoverData({ menuBlockBackgroundStopB: value })
                    }
                    onChange={(value) => {
                      update({
                        blockBgLight: toStoreMenuLightBg(value),
                        blockBg: toStoreMenuLightBg(value),
                        gradientEnabled: false,
                        gradientEnabledLight: false,
                        gradientEnabledDark: false,
                      });
                      updateCoverData({ menuBlockBackgroundFrom: value });
                    }}
                  />
                );
              })()}

              {(() => {
                const data = block.data as Record<string, unknown>;
                const modeRaw =
                  typeof data.menuSectionBackgroundMode === "string"
                    ? data.menuSectionBackgroundMode
                    : "";
                const mode: CoverBackgroundMode =
                  modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
                return (
                  <TildaBackgroundColorField
                    label="Цвет фона для всего блока"
                    value={String(data.menuSectionBackgroundFrom ?? lightSectionBg ?? "")}
                    mode={mode}
                    secondValue={String(data.menuSectionBackgroundTo ?? "")}
                    angle={Number(data.menuSectionBackgroundAngle ?? 135)}
                    radialStopA={Number(data.menuSectionBackgroundStopA ?? 0)}
                    radialStopB={Number(data.menuSectionBackgroundStopB ?? 100)}
                    placeholder="#ffffff"
                    onModeChange={(nextMode) =>
                      updateCoverData({ menuSectionBackgroundMode: nextMode })
                    }
                    onSecondChange={(value) =>
                      updateCoverData({ menuSectionBackgroundTo: value })
                    }
                    onAngleChange={(value) =>
                      updateCoverData({ menuSectionBackgroundAngle: value })
                    }
                    onRadialStopAChange={(value) =>
                      updateCoverData({ menuSectionBackgroundStopA: value })
                    }
                    onRadialStopBChange={(value) =>
                      updateCoverData({ menuSectionBackgroundStopB: value })
                    }
                    onChange={(value) => {
                      update({
                        sectionBgLight: toStore(value),
                        sectionBg: toStore(value),
                      });
                      updateCoverData({ menuSectionBackgroundFrom: value });
                    }}
                  />
                );
              })()}
            </>
          )}

          {block.type === "menu" ? (
            <div className="space-y-3">
              <TildaInlineColorField
                label="Цвет подблока"
                value={toDisplay(lightSubBlockBg)}
                placeholder={theme.panelColor}
                onChange={(value) =>
                  update({
                    subBlockBgLight: toStore(value),
                    subBlockBg: toStore(value),
                  })
                }
                onClear={() =>
                  update({
                    subBlockBgLight: toStore("transparent"),
                    subBlockBg: toStore("transparent"),
                  })
                }
              />
              <TildaInlineColorField
                label="Цвет обводки"
                value={toDisplay(lightBorderColor)}
                placeholder={theme.borderColor}
                onChange={(value) =>
                  update({
                    borderColorLight: toStore(value),
                    borderColor: toStore(value),
                  })
                }
                onClear={() =>
                  update({
                    borderColorLight: toStore("transparent"),
                    borderColor: toStore("transparent"),
                  })
                }
              />
              <TildaInlineColorField
                label="Заголовок"
                value={toDisplay(lightTextColor)}
                placeholder={theme.textColor}
                onChange={(value) =>
                  update({ textColorLight: toStore(value), textColor: toStore(value) })
                }
                onClear={() =>
                  update({
                    textColorLight: toStore("transparent"),
                    textColor: toStore("transparent"),
                  })
                }
              />
              <TildaInlineColorField
                label="Текст"
                value={toDisplay(lightMutedColor)}
                placeholder={theme.mutedColor}
                onChange={(value) =>
                  update({
                    mutedColorLight: toStore(value),
                    mutedColor: toStore(value),
                  })
                }
                onClear={() =>
                  update({
                    mutedColorLight: toStore("transparent"),
                    mutedColor: toStore("transparent"),
                  })
                }
              />
              <TildaInlineColorField
                label="Тень"
                value={style.shadowColor || theme.shadowColor}
                placeholder={theme.shadowColor}
                onChange={(value) => update({ shadowColor: value })}
                onClear={() => update({ shadowColor: "transparent" })}
              />
              <TildaInlineNumberField
                label="Размер тени"
                value={style.shadowSize ?? theme.shadowSize}
                min={0}
                max={40}
                onChange={(value) => update({ shadowSize: value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <ColorField
                label={block.type === "booking" ? "Фон страницы" : "Фон блока"}
                value={toDisplay(block.type === "aisha" ? lightBlockBg : lightSectionBg)}
                placeholder={theme.panelColor}
                onChange={(value) =>
                  update(
                    block.type === "aisha"
                      ? {
                          blockBgLight: toStore(value),
                          blockBg: toStore(value),
                        }
                      : block.type === "works"
                        ? {
                            sectionBgLight: toStore(value),
                            sectionBg: toStore(value),
                            blockBgLight: toStore(value),
                            blockBg: toStore(value),
                          }
                        : block.type === "booking"
                          ? {
                              sectionBgLight: toStore(value),
                              sectionBg: toStore(value),
                            }
                          : {
                              sectionBgLight: toStore(value),
                              sectionBg: toStore(value),
                            }
                  )
                }
              />
        {block.type === "booking" && (
          <ColorField
            label="Фон блока"
            value={toDisplay(lightBlockBg)}
            placeholder={theme.panelColor}
            onChange={(value) =>
              update({
                blockBgLight: toStore(value),
                blockBg: toStore(value),
              })
            }
          />
        )}
        {block.type === "booking" && (
          <ColorField
            label="Цвет подблока"
            value={toDisplay(lightSubBlockBg)}
            placeholder={theme.panelColor}
            onChange={(value) =>
              update({
                subBlockBgLight: toStore(value),
                subBlockBg: toStore(value),
              })
            }
          />
        )}
        <ColorField
          label="Цвет обводки"
          value={toDisplay(lightBorderColor)}
          placeholder={theme.borderColor}
          onChange={(value) =>
            update({
              borderColorLight: toStore(value),
              borderColor: toStore(value),
            })
          }
        />
        <ColorField
          label="Цвет кнопки"
          value={toDisplay(lightButtonColor)}
          placeholder={theme.buttonColor}
          onChange={(value) =>
            update({
              buttonColorLight: toStore(value),
              buttonColor: toStore(value),
            })
          }
        />
        <ColorField
          label="Текст кнопки"
          value={toDisplay(lightButtonTextColor)}
          placeholder={theme.buttonTextColor}
          onChange={(value) =>
            update({
              buttonTextColorLight: toStore(value),
              buttonTextColor: toStore(value),
            })
          }
        />
        <ColorField
          label="Текст"
          value={toDisplay(lightTextColor)}
          placeholder={theme.textColor}
          onChange={(value) =>
            update({ textColorLight: toStore(value), textColor: toStore(value) })
          }
        />
        <ColorField
          label="Вторичный текст"
          value={toDisplay(lightMutedColor)}
          placeholder={theme.mutedColor}
          onChange={(value) =>
            update({
              mutedColorLight: toStore(value),
              mutedColor: toStore(value),
            })
          }
        />
        {block.type === "aisha" && (
          <>
            <ColorField label="Цвет ответа ассистента" value={toDisplay(lightAssistantBubbleColor)} placeholder={theme.panelColor} onChange={(value) => update({ assistantBubbleColorLight: toStore(value) })} />
            <ColorField label="Текст ассистента" value={toDisplay(lightAssistantTextColor)} placeholder={theme.textColor} onChange={(value) => update({ assistantTextColorLight: toStore(value) })} />
            <ColorField label="Цвет сообщения клиента" value={toDisplay(lightClientBubbleColor)} placeholder={theme.buttonColor} onChange={(value) => update({ clientBubbleColorLight: toStore(value) })} />
            <ColorField label="Текст клиента" value={toDisplay(lightClientTextColor)} placeholder={theme.buttonTextColor} onChange={(value) => update({ clientTextColorLight: toStore(value) })} />
            <ColorField label="Цвет плашки" value={toDisplay(lightHeaderBgColor)} placeholder={theme.panelColor} onChange={(value) => update({ headerBgColorLight: toStore(value) })} />
            <ColorField label="Цвет текста плашки" value={toDisplay(lightHeaderTextColor)} placeholder={theme.textColor} onChange={(value) => update({ headerTextColorLight: toStore(value) })} />
            <ColorField label="Цвет кнопок вариантов" value={toDisplay(lightQuickReplyButtonColor)} placeholder={theme.buttonColor} onChange={(value) => update({ quickReplyButtonColorLight: toStore(value) })} />
            <ColorField label="Текст кнопок вариантов" value={toDisplay(lightQuickReplyTextColor)} placeholder={theme.buttonTextColor} onChange={(value) => update({ quickReplyTextColorLight: toStore(value) })} />
          </>
        )}
        {block.type === "works" && (
          <>
            <ColorField
              label="Цвет стрелок"
              value={String(block.data.arrowColorLight ?? block.data.arrowColor ?? "")}
              placeholder={theme.textColor}
              onChange={(value) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    arrowColorLight: value,
                    arrowColor: value,
                  },
                })
              }
            />
            <ColorField
              label="Фон стрелок"
              value={String(block.data.arrowBgColorLight ?? block.data.arrowBgColor ?? "")}
              placeholder="#ffffffd1"
              onChange={(value) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    arrowBgColorLight: value,
                    arrowBgColor: value,
                  },
                })
              }
            />
            <ColorField
              label="Активная точка"
              value={String(block.data.dotActiveColorLight ?? block.data.dotActiveColor ?? "")}
              placeholder={theme.textColor}
              onChange={(value) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    dotActiveColorLight: value,
                    dotActiveColor: value,
                  },
                })
              }
            />
            <ColorField
              label="Неактивная точка"
              value={String(block.data.dotInactiveColorLight ?? block.data.dotInactiveColor ?? "")}
              placeholder={theme.mutedColor}
              onChange={(value) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    dotInactiveColorLight: value,
                    dotInactiveColor: value,
                  },
                })
              }
            />
          </>
        )}
        <ColorField
          label="Тень"
          value={style.shadowColor || theme.shadowColor}
          onChange={(value) => update({ shadowColor: value })}
        />
        <NumberField
          label="Размер тени"
          value={style.shadowSize ?? theme.shadowSize}
          min={0}
          max={40}
          onChange={(value) => update({ shadowSize: value })}
        />
          </div>
          )}
        </div>
      )}
      {inSection("colors") && (
      <div className="mt-4 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Темная тема
        </div>
        {block.type === "menu" ? (
          <div className="mt-3 space-y-3">
            {(() => {
              const data = block.data as Record<string, unknown>;
              const modeRaw =
                typeof data.menuBlockBackgroundModeDark === "string"
                  ? data.menuBlockBackgroundModeDark
                  : "";
              const mode: CoverBackgroundMode =
                modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
              return (
                <TildaBackgroundColorField
                  label="Цвет блока"
                  value={String(data.menuBlockBackgroundFromDark ?? darkBlockBg ?? "")}
                  mode={mode}
                  secondValue={String(data.menuBlockBackgroundToDark ?? "")}
                  angle={Number(data.menuBlockBackgroundAngleDark ?? 135)}
                  radialStopA={Number(data.menuBlockBackgroundStopADark ?? 0)}
                  radialStopB={Number(data.menuBlockBackgroundStopBDark ?? 100)}
                  placeholder={theme.darkPalette.panelColor}
                  onModeChange={(nextMode) =>
                    updateCoverData({ menuBlockBackgroundModeDark: nextMode })
                  }
                  onSecondChange={(value) =>
                    updateCoverData({ menuBlockBackgroundToDark: value })
                  }
                  onAngleChange={(value) =>
                    updateCoverData({ menuBlockBackgroundAngleDark: value })
                  }
                  onRadialStopAChange={(value) =>
                    updateCoverData({ menuBlockBackgroundStopADark: value })
                  }
                  onRadialStopBChange={(value) =>
                    updateCoverData({ menuBlockBackgroundStopBDark: value })
                  }
                  onChange={(value) => {
                    update({
                      blockBgDark: toStoreMenuDarkBg(value),
                      gradientEnabledDark: false,
                    });
                    updateCoverData({ menuBlockBackgroundFromDark: value });
                  }}
                />
              );
            })()}

            {(() => {
              const data = block.data as Record<string, unknown>;
              const modeRaw =
                typeof data.menuSectionBackgroundModeDark === "string"
                  ? data.menuSectionBackgroundModeDark
                  : "";
              const mode: CoverBackgroundMode =
                modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
              return (
                <TildaBackgroundColorField
                  label="Цвет фона для всего блока"
                  value={String(data.menuSectionBackgroundFromDark ?? darkSectionBg ?? "")}
                  mode={mode}
                  secondValue={String(data.menuSectionBackgroundToDark ?? "")}
                  angle={Number(data.menuSectionBackgroundAngleDark ?? 135)}
                  radialStopA={Number(data.menuSectionBackgroundStopADark ?? 0)}
                  radialStopB={Number(data.menuSectionBackgroundStopBDark ?? 100)}
                  placeholder={theme.darkPalette.panelColor}
                  onModeChange={(nextMode) =>
                    updateCoverData({ menuSectionBackgroundModeDark: nextMode })
                  }
                  onSecondChange={(value) =>
                    updateCoverData({ menuSectionBackgroundToDark: value })
                  }
                  onAngleChange={(value) =>
                    updateCoverData({ menuSectionBackgroundAngleDark: value })
                  }
                  onRadialStopAChange={(value) =>
                    updateCoverData({ menuSectionBackgroundStopADark: value })
                  }
                  onRadialStopBChange={(value) =>
                    updateCoverData({ menuSectionBackgroundStopBDark: value })
                  }
                  onChange={(value) => {
                    update({
                      sectionBgDark: toStore(value),
                    });
                    updateCoverData({ menuSectionBackgroundFromDark: value });
                  }}
                />
              );
            })()}

            <TildaInlineColorField
              label="Цвет подблока"
              value={toDisplay(darkSubBlockBg)}
              placeholder={theme.darkPalette.panelColor}
              onChange={(value) => update({ subBlockBgDark: toStore(value) })}
              onClear={() => update({ subBlockBgDark: toStore("transparent") })}
            />
            <TildaInlineColorField
              label="Цвет обводки"
              value={toDisplay(darkBorderColor)}
              placeholder={theme.darkPalette.borderColor}
              onChange={(value) => update({ borderColorDark: toStore(value) })}
              onClear={() => update({ borderColorDark: toStore("transparent") })}
            />
            <TildaInlineColorField
              label="Заголовок"
              value={toDisplay(darkTextColor)}
              placeholder={theme.darkPalette.textColor}
              onChange={(value) => update({ textColorDark: toStore(value) })}
              onClear={() => update({ textColorDark: toStore("transparent") })}
            />
            <TildaInlineColorField
              label="Текст"
              value={toDisplay(darkMutedColor)}
              placeholder={theme.darkPalette.mutedColor}
              onChange={(value) => update({ mutedColorDark: toStore(value) })}
              onClear={() => update({ mutedColorDark: toStore("transparent") })}
            />
            <TildaInlineColorField
              label="Тень"
              value={style.shadowColor || theme.shadowColor}
              placeholder={theme.shadowColor}
              onChange={(value) => update({ shadowColor: value })}
              onClear={() => update({ shadowColor: "transparent" })}
            />
            <TildaInlineNumberField
              label="Размер тени"
              value={style.shadowSize ?? theme.shadowSize}
              min={0}
              max={40}
              onChange={(value) => update({ shadowSize: value })}
            />
          </div>
        ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
              <ColorField
                label={block.type === "booking" ? "Фон страницы" : "Фон блока"}
                value={toDisplay(block.type === "aisha" ? darkBlockBg : darkSectionBg)}
                placeholder={theme.darkPalette.panelColor}
                onChange={(value) =>
                  update(
                    block.type === "aisha"
                      ? { blockBgDark: toStore(value) }
                      : block.type === "works"
                      ? { sectionBgDark: toStore(value), blockBgDark: toStore(value) }
                      : block.type === "booking"
                      ? { sectionBgDark: toStore(value) }
                      : { sectionBgDark: toStore(value) }
                  )
                }
              />
            {block.type === "booking" && (
              <ColorField
                label="Фон блока"
                value={toDisplay(darkBlockBg)}
                placeholder={theme.darkPalette.panelColor}
                onChange={(value) => update({ blockBgDark: toStore(value) })}
              />
            )}
            {block.type === "booking" && (
              <ColorField
                label="Цвет подблока"
                value={toDisplay(darkSubBlockBg)}
                placeholder={theme.darkPalette.panelColor}
                onChange={(value) => update({ subBlockBgDark: toStore(value) })}
              />
            )}
            <ColorField
              label="Цвет обводки"
              value={toDisplay(darkBorderColor)}
              placeholder={theme.darkPalette.borderColor}
              onChange={(value) => update({ borderColorDark: toStore(value) })}
            />
            <ColorField
              label="Текст"
              value={toDisplay(darkTextColor)}
              placeholder={theme.darkPalette.textColor}
              onChange={(value) => update({ textColorDark: toStore(value) })}
            />
            <ColorField
              label="Вторичный текст"
              value={toDisplay(darkMutedColor)}
              placeholder={theme.darkPalette.mutedColor}
              onChange={(value) => update({ mutedColorDark: toStore(value) })}
            />
            <ColorField
              label="Тень"
              value={style.shadowColor || theme.shadowColor}
              onChange={(value) => update({ shadowColor: value })}
            />
            <NumberField
              label="Размер тени"
              value={style.shadowSize ?? theme.shadowSize}
              min={0}
              max={40}
              onChange={(value) => update({ shadowSize: value })}
            />
            {block.type === "aisha" && (
              <>
                <ColorField label="Цвет ответа ассистента" value={toDisplay(darkAssistantBubbleColor)} placeholder={theme.darkPalette.panelColor} onChange={(value) => update({ assistantBubbleColorDark: toStore(value) })} />
                <ColorField label="Текст ассистента" value={toDisplay(darkAssistantTextColor)} placeholder={theme.darkPalette.textColor} onChange={(value) => update({ assistantTextColorDark: toStore(value) })} />
                <ColorField label="Цвет сообщения клиента" value={toDisplay(darkClientBubbleColor)} placeholder={theme.darkPalette.buttonColor} onChange={(value) => update({ clientBubbleColorDark: toStore(value) })} />
                <ColorField label="Текст клиента" value={toDisplay(darkClientTextColor)} placeholder={theme.darkPalette.buttonTextColor} onChange={(value) => update({ clientTextColorDark: toStore(value) })} />
                <ColorField label="Цвет плашки" value={toDisplay(darkHeaderBgColor)} placeholder={theme.darkPalette.panelColor} onChange={(value) => update({ headerBgColorDark: toStore(value) })} />
                <ColorField label="Цвет текста плашки" value={toDisplay(darkHeaderTextColor)} placeholder={theme.darkPalette.textColor} onChange={(value) => update({ headerTextColorDark: toStore(value) })} />
                <ColorField label="Цвет кнопок вариантов" value={toDisplay(darkQuickReplyButtonColor)} placeholder={theme.darkPalette.buttonColor} onChange={(value) => update({ quickReplyButtonColorDark: toStore(value) })} />
                <ColorField label="Текст кнопок вариантов" value={toDisplay(darkQuickReplyTextColor)} placeholder={theme.darkPalette.buttonTextColor} onChange={(value) => update({ quickReplyTextColorDark: toStore(value) })} />
              </>
            )}
            {block.type === "works" && (
              <>
                <ColorField
                  label="Цвет стрелок"
                  value={String(block.data.arrowColorDark ?? "")}
                  placeholder={theme.darkPalette.textColor}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        arrowColorDark: value,
                      },
                    })
                  }
                />
                <ColorField
                  label="Фон стрелок"
                  value={String(block.data.arrowBgColorDark ?? "")}
                  placeholder="#ffffffd1"
                  onChange={(value) =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        arrowBgColorDark: value,
                      },
                    })
                  }
                />
                <ColorField
                  label="Активная точка"
                  value={String(block.data.dotActiveColorDark ?? "")}
                  placeholder={theme.darkPalette.textColor}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        dotActiveColorDark: value,
                      },
                    })
                  }
                />
                <ColorField
                  label="Неактивная точка"
                  value={String(block.data.dotInactiveColorDark ?? "")}
                  placeholder={theme.darkPalette.mutedColor}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        dotInactiveColorDark: value,
                      },
                    })
                  }
                />
              </>
            )}
        </div>
        )}
      </div>
      )}
      {inSection("effects") && (
        <>
          <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
              Градиент: светлая тема
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  typeof style.gradientEnabledLight === "boolean"
                    ? style.gradientEnabledLight
                    : Boolean(style.gradientEnabled)
                }
                onChange={(event) =>
                  update({
                    gradientEnabledLight: event.target.checked,
                    ...(block.type === "aisha" ? {} : { gradientEnabled: event.target.checked }),
                  })
                }
              />
              Включить градиент
            </label>
            {(typeof style.gradientEnabledLight === "boolean"
              ? style.gradientEnabledLight
              : Boolean(style.gradientEnabled)) && (
              <>
                <label className="mt-3 block text-sm">
                  Направление градиента
                  <select
                    value={
                      style.gradientDirectionLight === "horizontal" || style.gradientDirectionLight === "vertical"
                        ? style.gradientDirectionLight
                        : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
                          ? style.gradientDirection
                          : "vertical"
                    }
                    onChange={(event) =>
                      update({
                        gradientDirectionLight: event.target.value as BlockStyle["gradientDirection"],
                        ...(block.type === "aisha" ? {} : { gradientDirection: event.target.value as BlockStyle["gradientDirection"] }),
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                  >
                    <option value="vertical">Сверху вниз</option>
                    <option value="horizontal">Слева направо</option>
                  </select>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ColorField
                    label="Цвет 1"
                    value={style.gradientFromLight || style.gradientFrom || theme.lightPalette.gradientFrom}
                    onChange={(value) => update(block.type === "aisha" ? { gradientFromLight: value } : { gradientFromLight: value, gradientFrom: value })}
                  />
                  <ColorField
                    label="Цвет 2"
                    value={style.gradientToLight || style.gradientTo || theme.lightPalette.gradientTo}
                    onChange={(value) => update(block.type === "aisha" ? { gradientToLight: value } : { gradientToLight: value, gradientTo: value })}
                  />
                </div>
              </>
            )}
          </div>
          <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
              Градиент: темная тема
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  typeof style.gradientEnabledDark === "boolean"
                    ? style.gradientEnabledDark
                    : typeof style.gradientEnabledLight === "boolean"
                      ? style.gradientEnabledLight
                      : Boolean(style.gradientEnabled)
                }
                onChange={(event) => update({ gradientEnabledDark: event.target.checked })}
              />
              Включить градиент
            </label>
            {(typeof style.gradientEnabledDark === "boolean"
              ? style.gradientEnabledDark
              : typeof style.gradientEnabledLight === "boolean"
                ? style.gradientEnabledLight
                : Boolean(style.gradientEnabled)) && (
              <>
                <label className="mt-3 block text-sm">
                  Направление градиента
                  <select
                    value={
                      style.gradientDirectionDark === "horizontal" || style.gradientDirectionDark === "vertical"
                        ? style.gradientDirectionDark
                        : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
                          ? style.gradientDirection
                          : style.gradientDirectionLight === "horizontal" || style.gradientDirectionLight === "vertical"
                            ? style.gradientDirectionLight
                            : "vertical"
                    }
                    onChange={(event) =>
                      update({
                        gradientDirectionDark: event.target.value as BlockStyle["gradientDirection"],
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                  >
                    <option value="vertical">Сверху вниз</option>
                    <option value="horizontal">Слева направо</option>
                  </select>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ColorField
                    label="Цвет 1"
                    value={style.gradientFromDark || style.gradientFrom || theme.darkPalette.gradientFrom}
                    onChange={(value) => update({ gradientFromDark: value })}
                  />
                  <ColorField
                    label="Цвет 2"
                    value={style.gradientToDark || style.gradientTo || theme.darkPalette.gradientTo}
                    onChange={(value) => update({ gradientToDark: value })}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
      {inSection("typography") && block.type === "cover" && (
        <>
          <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">Заголовок</div>
          <TildaInlineColorField
            label="Цвет"
            value={style.textColorLight || style.textColor || theme.textColor}
            onChange={(value) =>
              update({ textColorLight: value, textColorDark: value, textColor: value })
            }
            onClear={() =>
              update({
                textColorLight: "transparent",
                textColorDark: "transparent",
                textColor: "transparent",
              })
            }
            placeholder="#000000"
            compact
          />
          {renderFlatNumber(
            "Размер шрифта",
            style.headingSize ?? theme.headingSize,
            0,
            140,
            (value) => update({ headingSize: value })
          )}
          {renderFlatSelect(
            "Шрифт",
            style.fontHeading || "",
            (value) => update({ fontHeading: value }),
            [{ value: "", label: "По умолчанию" }, ...THEME_FONTS.map((font) => ({ value: font.heading, label: font.label }))]
          )}
          {renderFlatSelect(
            "Насыщенность",
            style.fontWeightHeading?.toString() || "",
            (value) => update({ fontWeightHeading: value ? Number(value) : null }),
            [{ value: "", label: "По умолчанию" }, ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label }))]
          )}

          {block.variant !== "v2" && (
            <>
              <div className="pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">Подзаголовок</div>
              <TildaInlineColorField
                label="Цвет"
                value={coverSubtitleColorInput}
                onChange={(value) => updateCoverData({ coverSubtitleColor: value })}
                onClear={() => updateCoverData({ coverSubtitleColor: "transparent" })}
                placeholder="#ffffff"
                compact
              />
              {renderFlatNumber(
                "Размер шрифта",
                style.subheadingSize ?? theme.subheadingSize,
                0,
                100,
                (value) => update({ subheadingSize: value })
              )}
              {renderFlatSelect(
                "Шрифт",
                style.fontSubheading || "",
                (value) => update({ fontSubheading: value }),
                [
                  { value: "", label: "По умолчанию" },
                  ...THEME_FONTS.map((font) => ({ value: font.body, label: font.label })),
                ]
              )}
              {renderFlatSelect(
                "Насыщенность",
                style.fontWeightSubheading?.toString() || "",
                (value) => update({ fontWeightSubheading: value ? Number(value) : null }),
                [
                  { value: "", label: "По умолчанию" },
                  ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label })),
                ]
              )}
            </>
          )}

          <div className="pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">Описание</div>
          <TildaInlineColorField
            label="Цвет"
            value={coverDescriptionColorInput}
            onChange={(value) => updateCoverData({ coverDescriptionColor: value })}
            onClear={() => updateCoverData({ coverDescriptionColor: "transparent" })}
            placeholder="#ffffff"
            compact
          />
          {renderFlatNumber(
            "Размер шрифта",
            style.textSize ?? theme.textSize,
            0,
            72,
            (value) => update({ textSize: value })
          )}
          {renderFlatSelect(
            "Шрифт",
            style.fontBody || "",
            (value) => update({ fontBody: value }),
            [{ value: "", label: "По умолчанию" }, ...THEME_FONTS.map((font) => ({ value: font.body, label: font.label }))]
          )}
          {renderFlatSelect(
            "Насыщенность",
            style.fontWeightBody?.toString() || "",
            (value) => update({ fontWeightBody: value ? Number(value) : null }),
            [{ value: "", label: "По умолчанию" }, ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label }))]
          )}
          <div className="h-6" />
        </>
      )}
      {inSection("typography") && block.type === "menu" && (
        <>
          <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">
            Заголовок
          </div>
          {renderFlatNumber(
            "Размер шрифта",
            style.headingSize ?? theme.headingSize,
            0,
            140,
            (value) => update({ headingSize: value })
          )}
          {renderFlatSelect(
            "Шрифт",
            style.fontHeading || "",
            (value) => update({ fontHeading: value }),
            [
              { value: "", label: "По умолчанию" },
              ...THEME_FONTS.map((font) => ({ value: font.heading, label: font.label })),
            ]
          )}
          {renderFlatSelect(
            "Насыщенность",
            style.fontWeightHeading?.toString() || "",
            (value) => update({ fontWeightHeading: value ? Number(value) : null }),
            [
              { value: "", label: "По умолчанию" },
              ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label })),
            ]
          )}

          <div className="pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">
            Текст
          </div>
          {renderFlatNumber(
            "Размер шрифта",
            style.textSize ?? theme.textSize,
            0,
            72,
            (value) => update({ textSize: value })
          )}
          {renderFlatSelect(
            "Шрифт",
            style.fontBody || "",
            (value) => update({ fontBody: value }),
            [
              { value: "", label: "По умолчанию" },
              ...THEME_FONTS.map((font) => ({ value: font.body, label: font.label })),
            ]
          )}
          {renderFlatSelect(
            "Насыщенность",
            style.fontWeightBody?.toString() || "",
            (value) => update({ fontWeightBody: value ? Number(value) : null }),
            [
              { value: "", label: "По умолчанию" },
              ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label })),
            ]
          )}

          <div className="pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">
            Кнопка
          </div>
          {renderFlatNumber(
            "Размер шрифта",
            style.subheadingSize ?? theme.subheadingSize,
            0,
            100,
            (value) => update({ subheadingSize: value })
          )}
          {renderFlatSelect(
            "Шрифт",
            style.fontSubheading || "",
            (value) => update({ fontSubheading: value }),
            [
              { value: "", label: "По умолчанию" },
              ...THEME_FONTS.map((font) => ({ value: font.body, label: font.label })),
            ]
          )}
          {renderFlatSelect(
            "Насыщенность",
            style.fontWeightSubheading?.toString() || "",
            (value) => update({ fontWeightSubheading: value ? Number(value) : null }),
            [
              { value: "", label: "По умолчанию" },
              ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label })),
            ]
          )}
          <div className="h-6" />
        </>
      )}
      {inSection("typography") && block.type !== "cover" && block.type !== "menu" && (
      <label className="text-sm">
        Шрифт заголовка
        <select
          value={style.fontHeading || ""}
          onChange={(event) => update({ fontHeading: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="">По умолчанию</option>
          {THEME_FONTS.map((font) => (
            <option key={font.label} value={font.heading}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      )}
      {inSection("typography") && block.type !== "cover" && block.type !== "menu" && (
      <label className="text-sm">
        Шрифт подзаголовка
        <select
          value={style.fontSubheading || ""}
          onChange={(event) => update({ fontSubheading: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="">По умолчанию</option>
          {THEME_FONTS.map((font) => (
            <option key={font.label} value={font.body}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      )}
      {inSection("typography") && block.type !== "cover" && block.type !== "menu" && (
      <label className="text-sm">
        Шрифт текста
        <select
          value={style.fontBody || ""}
          onChange={(event) => update({ fontBody: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="">По умолчанию</option>
          {THEME_FONTS.map((font) => (
            <option key={font.label} value={font.body}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      )}
      {inSection("typography") && block.type !== "cover" && block.type !== "menu" && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Жирность заголовка
          <select
            value={style.fontWeightHeading?.toString() || ""}
            onChange={(event) =>
              update({ fontWeightHeading: event.target.value ? Number(event.target.value) : null })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="">По умолчанию</option>
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Жирность подзаголовка
          <select
            value={style.fontWeightSubheading?.toString() || ""}
            onChange={(event) =>
              update({ fontWeightSubheading: event.target.value ? Number(event.target.value) : null })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="">По умолчанию</option>
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Жирность текста
          <select
            value={style.fontWeightBody?.toString() || ""}
            onChange={(event) =>
              update({ fontWeightBody: event.target.value ? Number(event.target.value) : null })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="">По умолчанию</option>
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      )}
      {inSection("typography") && block.type !== "cover" && block.type !== "menu" && (
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          label="Заголовок"
          value={style.headingSize ?? theme.headingSize}
          min={0}
          max={140}
          onChange={(value) => update({ headingSize: value })}
        />
        <NumberField
          label="Подзаголовок"
          value={style.subheadingSize ?? theme.subheadingSize}
          min={0}
          max={100}
          onChange={(value) => update({ subheadingSize: value })}
        />
        <NumberField
          label="Текст"
          value={style.textSize ?? theme.textSize}
          min={0}
          max={72}
          onChange={(value) => update({ textSize: value })}
        />
      </div>
      )}
    </div>
  );
}


