import { useState } from "react";
import {
  TildaBackgroundColorField,
  TildaInlineColorField,
} from "@/features/site-builder/crm/site-editor-panels";
import { FlatCheckbox, updateBlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

type Props = {
  block: SiteBlock;
  activeTheme: SiteTheme;
  activeSectionId: string;
  locationsCount?: number;
  updateBlock: (blockId: string, updater: (block: SiteBlock) => SiteBlock) => void;
};

function renderFlatTextInput(label: string, value: string, onChange: (value: string) => void, placeholder?: string) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none", appearance: "none" }}
        />
      </div>
    </label>
  );
}

function renderFlatNumberInput(label: string, value: number, onChange: (value: number) => void, min = 0, max = 96) {
  const normalized = Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : min;
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={normalized}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? Math.max(min, Math.min(max, Math.round(next))) : min);
          }}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none", appearance: "textfield" }}
        />
        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
      </div>
    </label>
  );
}

function renderFlatNumberPxInput(
  label: string,
  value: number,
  onChange: (value: number) => void,
  min = 0,
  max = 96,
  mobile?: {
    value: number | null;
    fallback: number;
    onChange: (value: number) => void;
    isOpen: boolean;
    onToggle: () => void;
  }
) {
  const normalizedValue = Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : min;
  const inputClassName =
    "w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0";
  const inputStyle = {
    border: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
    appearance: "textfield",
  } as const;
  const clampNext = (nextValue: number) =>
    Number.isFinite(nextValue) ? Math.max(min, Math.min(max, Math.round(nextValue))) : min;

  return (
    <div className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <label className="block">
        <div className="min-h-[32px] leading-4">{label}</div>
        <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
          <input
            type="number"
            min={min}
            max={max}
            step={1}
            value={normalizedValue}
            onChange={(event) => onChange(clampNext(Number(event.target.value)))}
            className={inputClassName}
            style={inputStyle}
          />
          <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
          {mobile ? (
            <button
              type="button"
              onClick={mobile.onToggle}
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                mobile.isOpen ? "bg-[#ff5a5f] text-white" : "bg-[#d1d5db] text-white hover:bg-[#aeb4bd]"
              }`}
              title="Нажмите, чтобы задать значение для мобильного"
              aria-label="Открыть мобильный размер шрифта"
            >
              <DesktopFontSizeIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </label>
      {mobile && mobile.isOpen ? (
        <label className="mt-3 grid grid-cols-[112px_1fr] items-end gap-3">
          <div className="min-h-[32px] leading-4">Моб. размер шрифта</div>
          <div className="flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
            <input
              type="number"
              min={min}
              max={max}
              step={1}
              value={mobile.value ?? mobile.fallback}
              onChange={(event) => mobile.onChange(clampNext(Number(event.target.value)))}
              className={inputClassName}
              style={inputStyle}
            />
            <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d1d5db] text-white">
              <MobileFontSizeIcon className="h-3.5 w-3.5" />
            </span>
          </div>
        </label>
      ) : null}
    </div>
  );
}

function DesktopFontSizeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <rect height="15.031" width="18.5" rx="3.5" x="2.75" y="2.75" />
        <path d="M9.11 17.781v3.469m5.78-3.469v3.469m-8.382 0h10.984" />
      </g>
    </svg>
  );
}

function MobileFontSizeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="none" fillRule="evenodd" transform="translate(5 3)">
        <path d="M2.5.5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5.5" cy="11.5" fill="currentColor" r="1" />
      </g>
    </svg>
  );
}

function defaultCatalogCardMobileTextSize(prefix: string, desktopSize: number) {
  if (prefix === "catalogCardTitle") {
    return Math.max(15, Math.min(28, Math.round(desktopSize * 0.82)));
  }
  return Math.max(12, Math.min(17, Math.round(desktopSize * 0.9)));
}

function renderFlatSelect(
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

function renderFontSelect(label: string, value: string, onChange: (value: string) => void) {
  return renderFlatSelect(label, value || "Manrope", onChange, [
    { value: "Manrope", label: "Manrope" },
    { value: "Inter", label: "Inter" },
    { value: "Arial", label: "Arial" },
    { value: "Georgia", label: "Georgia" },
    { value: "Times New Roman", label: "Times New Roman" },
  ]);
}

function renderWeightSelect(label: string, value: unknown, onChange: (value: number | "") => void, fallback = "") {
  const normalized = value === "" || value === null || value === undefined ? fallback : String(value);
  return renderFlatSelect(label, normalized || "", (next) => onChange(next ? Number(next) : ""), [
    { value: "", label: "Обычная" },
    { value: "300", label: "300" },
    { value: "400", label: "400" },
    { value: "500", label: "500" },
    { value: "600", label: "600" },
    { value: "700", label: "700" },
    { value: "800", label: "800" },
  ]);
}

function renderOpacitySelect(label: string, value: number, onChange: (value: number) => void) {
  const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value / 10) * 10)) : 0;
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={String(normalizedValue)}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none", appearance: "none" }}
        >
          {Array.from({ length: 11 }, (_, index) => index * 10).map((option) => (
            <option key={`${label}-${option}`} value={option}>
              {option}%
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

function readAlignment(value: unknown, fallback: "left" | "center" | "right") {
  return value === "left" || value === "center" || value === "right" ? value : fallback;
}

function readBackgroundMode(value: unknown): "solid" | "linear" | "radial" {
  return value === "linear" || value === "radial" ? value : "solid";
}

export function LC001SettingsDrawer({ block, activeTheme, activeSectionId, locationsCount = 0, updateBlock }: Props) {
  const [showDarkThemeAdvanced, setShowDarkThemeAdvanced] = useState(false);
  const [mobileTypographyOpen, setMobileTypographyOpen] = useState<Record<string, boolean>>({});
  const data = (block.data as Record<string, unknown>) ?? {};
  const rawStyle = ((block.data as Record<string, unknown>).style as Record<string, unknown>) ?? {};
  const hasMultipleLocations = locationsCount > 1;

  const updateData = (patch: Record<string, unknown>) => {
    updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };
  const updateStyle = (patch: Record<string, unknown>) => {
    updateBlock(block.id, (prev) => updateBlockStyle(prev, patch));
  };
  const readStyle = (key: string, fallback = "") =>
    typeof rawStyle[key] === "string" && String(rawStyle[key]).trim() ? String(rawStyle[key]) : fallback;
  const readDataColor = (key: string, fallback = "transparent") =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]) : fallback;
  const readDefaultedDataColor = (key: string, fallback: string) => {
    const value = readDataColor(key);
    return value && value !== "transparent" ? value : fallback;
  };
  const readDataColorFallback = (key: string, legacyKey: string, fallback = "transparent") =>
    readDataColor(key, readDataColor(legacyKey, fallback));
  const readDataNumber = (key: string, fallback: number) => {
    const value = Number(data[key]);
    return Number.isFinite(value) ? value : fallback;
  };
  const readDataNumberFallback = (key: string, legacyKey: string, fallback: number) => {
    const value = Number(data[key]);
    if (Number.isFinite(value)) return value;
    const legacyValue = Number(data[legacyKey]);
    return Number.isFinite(legacyValue) ? legacyValue : fallback;
  };
  const readDataTextFallback = (key: string, legacyKey: string, fallback: string) =>
    typeof data[key] === "string" && String(data[key]).trim()
      ? String(data[key])
      : typeof data[legacyKey] === "string" && String(data[legacyKey]).trim()
        ? String(data[legacyKey])
        : fallback;
  const readDataValueFallback = (key: string, legacyKey: string) =>
    data[key] !== undefined && data[key] !== null ? data[key] : data[legacyKey];

  if (activeSectionId === "button") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <FlatCheckbox
          checked={data.showButton !== false}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать кнопку записи"
        />
        <FlatCheckbox
          checked={data.showDetailsButton !== false}
          onChange={(checked) => updateData({ showDetailsButton: checked })}
          label="Показывать кнопку подробнее"
        />
        <FlatCheckbox
          checked={data.alignButtonsBottom !== false}
          onChange={(checked) => updateData({ alignButtonsBottom: checked })}
          label="Выравнивать кнопки по низу"
        />
        {renderFlatSelect("Выравнивание", readAlignment(data.buttonAlignment, "center"), (value) => updateData({ buttonAlignment: readAlignment(value, "center") }), [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        {renderFlatTextInput("Текст кнопки записи", String(data.buttonText ?? "Записаться"), (value) => updateData({ buttonText: value }), "Записаться")}
        {renderFlatTextInput("Текст кнопки подробнее", String(data.detailsButtonText ?? "Подробнее"), (value) => updateData({ detailsButtonText: value }), "Подробнее")}
        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          {renderFlatNumberInput("Размер текста кнопки записи", readDataNumber("locationPrimaryButtonSize", 14), (value) => updateData({ locationPrimaryButtonSize: value }), 8, 48)}
          {renderFontSelect("Шрифт кнопки записи", String(data.locationPrimaryButtonFont ?? "Manrope"), (value) => updateData({ locationPrimaryButtonFont: value }))}
          {renderWeightSelect("Жирность кнопки записи", data.locationPrimaryButtonWeight, (value) => updateData({ locationPrimaryButtonWeight: value }), "600")}
          {renderFlatNumberInput("Размер текста кнопки подробнее", readDataNumber("locationDetailsButtonSize", 14), (value) => updateData({ locationDetailsButtonSize: value }), 8, 48)}
          {renderFontSelect("Шрифт кнопки подробнее", String(data.locationDetailsButtonFont ?? "Manrope"), (value) => updateData({ locationDetailsButtonFont: value }))}
          {renderWeightSelect("Жирность кнопки подробнее", data.locationDetailsButtonWeight, (value) => updateData({ locationDetailsButtonWeight: value }))}
        </div>
        {renderFlatNumberInput("Скругление", Number(rawStyle.buttonRadius ?? 0), (value) => updateStyle({ buttonRadius: value }))}
        <TildaInlineColorField
          compact
          label="Кнопка записи"
          value={readStyle("buttonColorLight", readStyle("buttonColor", activeTheme.buttonColor))}
          placeholder={activeTheme.buttonColor}
          onChange={(value) => updateStyle({ buttonColorLight: value, buttonColor: value })}
          onClear={() => updateStyle({ buttonColorLight: "transparent", buttonColor: "transparent" })}
        />
        <TildaInlineColorField
          compact
          label="Текст кнопки записи"
          value={readStyle("buttonTextColorLight", readStyle("buttonTextColor", activeTheme.buttonTextColor))}
          placeholder={activeTheme.buttonTextColor}
          onChange={(value) => updateStyle({ buttonTextColorLight: value, buttonTextColor: value })}
          onClear={() => updateStyle({ buttonTextColorLight: "transparent", buttonTextColor: "transparent" })}
        />
        <TildaInlineColorField
          compact
          label="Фон кнопки подробнее"
          value={readDataColor("detailsButtonColor")}
          placeholder="#ffffff"
          onChange={(value) => updateData({ detailsButtonColor: value })}
          onClear={() => updateData({ detailsButtonColor: "transparent" })}
        />
        <TildaInlineColorField
          compact
          label="Текст кнопки подробнее"
          value={readDataColor("detailsButtonTextColor", "#111111")}
          placeholder="#111111"
          onChange={(value) => updateData({ detailsButtonTextColor: value })}
          onClear={() => updateData({ detailsButtonTextColor: "transparent" })}
        />
      </div>
    );
  }

  if (activeSectionId === "filters") {
    const controlsAlignment = readAlignment(data.filtersAlignment ?? data.searchSortAlignment, "right");
    const updateControlsAlignment = (value: string) => {
      const alignment = readAlignment(value, "right");
      updateData({ searchSortAlignment: alignment, filtersAlignment: alignment });
    };

    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="flex flex-col items-start gap-4">
          <FlatCheckbox
            checked={hasMultipleLocations && data.showSearch !== false}
            onChange={(checked) => updateData({ showSearch: checked })}
            label="Показывать поиск"
          />
          <FlatCheckbox
            checked={hasMultipleLocations && data.showSort !== false}
            onChange={(checked) => updateData({ showSort: checked })}
            label="Показывать сортировку"
          />
        </div>
        {renderFlatSelect("Сортировка по умолчанию", String(data.defaultSort ?? "default"), (value) => updateData({ defaultSort: value }), [
          { value: "default", label: "По умолчанию" },
          { value: "nameAsc", label: "Название: А-Я" },
          { value: "nameDesc", label: "Название: Я-А" },
          { value: "levelAsc", label: "Адрес: А-Я" },
          { value: "levelDesc", label: "Адрес: Я-А" },
        ])}
        {renderFlatTextInput("Плейсхолдер поиска", String(data.searchPlaceholder ?? "Поиск филиала"), (value) => updateData({ searchPlaceholder: value || "Поиск филиала" }), "Поиск филиала")}
        {renderFlatSelect("Выравнивание поиска/сортировки", controlsAlignment, updateControlsAlignment, [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        {renderFlatSelect("Выравнивание фильтров", controlsAlignment, updateControlsAlignment, [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        <div className="space-y-4">
          <TildaInlineColorField
            compact
            label="Цвет текста сортировки"
            value={readDefaultedDataColor("sortTextColor", activeTheme.textColor)}
            placeholder={activeTheme.textColor}
            onChange={(value) => updateData({ sortTextColor: value })}
            onClear={() => updateData({ sortTextColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Активный пункт сортировки"
            value={readDefaultedDataColor("sortActiveColor", activeTheme.buttonColor)}
            placeholder={activeTheme.buttonColor}
            onChange={(value) => updateData({ sortActiveColor: value })}
            onClear={() => updateData({ sortActiveColor: "transparent" })}
          />

          <button
            type="button"
            onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
            className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
            style={{
              borderColor: showDarkThemeAdvanced ? "#ff5a5f" : "var(--bp-stroke)",
              backgroundColor: "transparent",
              color: showDarkThemeAdvanced ? "var(--bp-ink)" : "var(--bp-muted)",
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
            <div className="space-y-4">
              <TildaInlineColorField
                compact
                label="Цвет текста сортировки"
                value={readDefaultedDataColor("sortTextColorDark", activeTheme.darkPalette.textColor)}
                placeholder={activeTheme.darkPalette.textColor}
                onChange={(value) => updateData({ sortTextColorDark: value })}
                onClear={() => updateData({ sortTextColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Активный пункт сортировки"
                value={readDefaultedDataColor("sortActiveColorDark", activeTheme.darkPalette.buttonColor)}
                placeholder={activeTheme.darkPalette.buttonColor}
                onChange={(value) => updateData({ sortActiveColorDark: value })}
                onClear={() => updateData({ sortActiveColorDark: "transparent" })}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeSectionId === "servicesList") {
    const cardLightMode = readBackgroundMode(data.specialistCardBackgroundModeLight);
    const cardDarkMode = readBackgroundMode(data.specialistCardBackgroundModeDark ?? cardLightMode);
    const cardLightFrom =
      readDataColor("specialistCardBackgroundFromLight", "") ||
      readStyle("subBlockBgLight", readStyle("subBlockBg", "#fafafa"));
    const cardLightTo = readDataColor("specialistCardBackgroundToLight", "") || cardLightFrom || "#fafafa";
    const cardDarkFrom =
      readDataColor("specialistCardBackgroundFromDark", "") ||
      readStyle("subBlockBgDark", "#24282e");
    const cardDarkTo = readDataColor("specialistCardBackgroundToDark", "") || cardDarkFrom || "#24282e";
    const cardLightAngle = readDataNumber("specialistCardBackgroundAngleLight", 135);
    const cardDarkAngle = readDataNumber("specialistCardBackgroundAngleDark", cardLightAngle);
    const cardLightStopA = readDataNumber("specialistCardBackgroundStopALight", 0);
    const cardLightStopB = readDataNumber("specialistCardBackgroundStopBLight", 100);
    const cardDarkStopA = readDataNumber("specialistCardBackgroundStopADark", cardLightStopA);
    const cardDarkStopB = readDataNumber("specialistCardBackgroundStopBDark", cardLightStopB);
    const cardLightStartOpacity = readDataNumber("specialistCardBackgroundStartOpacityLight", 0);
    const cardLightEndOpacity = readDataNumber("specialistCardBackgroundEndOpacityLight", 10);
    const cardDarkStartOpacity = readDataNumber("specialistCardBackgroundStartOpacityDark", cardLightStartOpacity);
    const cardDarkEndOpacity = readDataNumber("specialistCardBackgroundEndOpacityDark", cardLightEndOpacity);
    const showLiquidGlassControl =
      String(data.imageAspectRatio ?? "1 / 1") === "original" &&
      (data.cardStyle === "filled" || data.cardStyle === "boxed");
    const renderCardTypographyControl = (
      title: string,
      prefix: string,
      legacyPrefix: string,
      colorFallback: string,
      sizeFallback: number,
      weightFallback = "",
      showTopBorder = true
    ) => {
      const mobileKey = `locationCard:${prefix}MobileSize`;
      const desktopSize = readDataNumberFallback(`${prefix}Size`, `${legacyPrefix}Size`, sizeFallback);
      const mobileSize = Number(data[`${prefix}MobileSize`]);
      const legacyMobileSize = Number(data[`${legacyPrefix}MobileSize`]);
      const mobileValue = Number.isFinite(mobileSize)
        ? Math.round(mobileSize)
        : Number.isFinite(legacyMobileSize)
          ? Math.round(legacyMobileSize)
          : null;

      return (
        <div className={`space-y-4 ${showTopBorder ? "border-t border-[color:var(--bp-stroke)] pt-4" : ""}`}>
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">{title}</div>
          <TildaInlineColorField
            compact
            label="Цвет"
            value={readDataColorFallback(`${prefix}ColorLight`, `${legacyPrefix}ColorLight`, colorFallback)}
            placeholder={colorFallback}
            onChange={(value) => updateData({ [`${prefix}ColorLight`]: value })}
            onClear={() => updateData({ [`${prefix}ColorLight`]: "transparent" })}
          />
          {renderFlatNumberPxInput(
            "Размер шрифта",
            desktopSize,
            (value) => updateData({ [`${prefix}Size`]: value }),
            8,
            96,
            {
              value: mobileValue,
              fallback: defaultCatalogCardMobileTextSize(
                prefix,
                Number.isFinite(desktopSize) ? Math.round(desktopSize) : sizeFallback
              ),
              onChange: (value) => updateData({ [`${prefix}MobileSize`]: value }),
              isOpen: mobileTypographyOpen[mobileKey] === true,
              onToggle: () =>
                setMobileTypographyOpen((prev) => ({
                  ...prev,
                  [mobileKey]: !prev[mobileKey],
                })),
            }
          )}
          {renderFontSelect(
            "Шрифт",
            readDataTextFallback(`${prefix}Font`, `${legacyPrefix}Font`, "Manrope"),
            (value) => updateData({ [`${prefix}Font`]: value })
          )}
          {renderWeightSelect(
            "Насыщенность",
            readDataValueFallback(`${prefix}Weight`, `${legacyPrefix}Weight`),
            (value) => updateData({ [`${prefix}Weight`]: value }),
            weightFallback
          )}
        </div>
      );
    };
    const renderCardDarkColorControl = (label: string, prefix: string, legacyPrefix: string, fallback: string) => (
      <TildaInlineColorField
        compact
        label={label}
        value={readDataColorFallback(`${prefix}ColorDark`, `${legacyPrefix}ColorDark`, fallback)}
        placeholder={fallback}
        onChange={(value) => updateData({ [`${prefix}ColorDark`]: value })}
        onClear={() => updateData({ [`${prefix}ColorDark`]: "transparent" })}
      />
    );

    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {renderFlatSelect("Вид списка филиалов", String(data.listView ?? "tile"), (value) => updateData({ listView: value }), [
          { value: "tile", label: "Плитка" },
          { value: "list", label: "Список" },
        ])}
        {renderFlatSelect("Стиль карточек", String(data.cardStyle ?? "plain"), (value) => updateData({ cardStyle: value }), [
          { value: "plain", label: "Без фона" },
          { value: "filled", label: "С фоном" },
        ])}
        {renderFlatSelect("Кол-во карточек в ряду", String(data.cardsPerRow ?? 4), (value) => updateData({ cardsPerRow: Number(value) }), [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
          { value: "5", label: "5" },
          { value: "6", label: "6" },
        ])}
        {renderFlatSelect("Выравнивание", String(rawStyle.textAlign ?? "left"), (value) => updateStyle({ textAlign: value }), [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        {renderFlatSelect("Соотношение сторон изображения", String(data.imageAspectRatio ?? "1 / 1"), (value) => updateData({ imageAspectRatio: value }), [
          { value: "1 / 1", label: "1:1 Квадрат" },
          { value: "4 / 3", label: "4:3 Горизонтально" },
          { value: "3 / 4", label: "3:4 Вертикально" },
          { value: "16 / 9", label: "16:9 Широкое" },
          { value: "original", label: "Вписать в карточку" },
        ])}
        {renderFlatTextInput("Отступ между колонками", String(data.cardGapX ?? 20), (value) => updateData({ cardGapX: Number(value) || 0 }), "20")}
        {renderFlatTextInput("Вертикальный отступ между карточками", String(data.cardGapY ?? 40), (value) => updateData({ cardGapY: Number(value) || 0 }), "40")}
        {renderFlatTextInput("Скругление изображения", String(data.imageRadius ?? 10), (value) => updateData({ imageRadius: Number(value) || 0 }), "10")}
        {renderFlatTextInput("Внутренний отступ X", String(data.cardPaddingX ?? 30), (value) => updateData({ cardPaddingX: Number(value) || 0 }), "30")}
        {renderFlatTextInput("Внутренний отступ Y", String(data.cardPaddingY ?? 30), (value) => updateData({ cardPaddingY: Number(value) || 0 }), "30")}
        <FlatCheckbox
          checked={Number(data.mobileCardsPerRow ?? 2) === 1}
          onChange={(checked) => updateData({ mobileCardsPerRow: checked ? 1 : 2 })}
          label="На мобильных: одна карточка в ряду"
        />
        <FlatCheckbox
          checked={Number(data.mobileCardsPerRow ?? 2) === 2}
          onChange={(checked) => updateData({ mobileCardsPerRow: checked ? 2 : 1 })}
          label="На мобильных: две карточки в ряду"
        />
        <FlatCheckbox
          checked={data.imageZoomOnHover === true}
          onChange={(checked) => updateData({ imageZoomOnHover: checked })}
          label="Увеличивать изображение по наведению"
        />
        <FlatCheckbox
          checked={data.modalImageClickEnabled !== false}
          onChange={(checked) => updateData({ modalImageClickEnabled: checked })}
          label="Открывать карточку филиала по клику на карточку"
        />
        {renderFlatTextInput(
          "Количество видимых филиалов до кнопки «Загрузить ещё»",
          String(data.maxVisibleItems ?? 8),
          (value) => updateData({ maxVisibleItems: Math.max(1, Math.min(100, Number(value) || 8)) }),
          "8"
        )}
        <FlatCheckbox
          checked={data.usePagination === true}
          onChange={(checked) => updateData({ usePagination: checked })}
          label="Показывать пагинацию (вместо кнопки «Загрузить ещё»)"
        />
        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          {showLiquidGlassControl ? (
            <FlatCheckbox
              checked={data.specialistCardLiquidGlass === true}
              onChange={(checked) => updateData({ specialistCardLiquidGlass: checked })}
              label="Жидкое стекло"
            />
          ) : null}
          <TildaBackgroundColorField
            label="Фон карточек"
            value={cardLightFrom}
            mode={cardLightMode}
            secondValue={cardLightTo}
            angle={cardLightAngle}
            radialStopA={cardLightStopA}
            radialStopB={cardLightStopB}
            placeholder="#fafafa"
            onModeChange={(value) => updateData({ specialistCardBackgroundModeLight: value })}
            onSecondChange={(value) => updateData({ specialistCardBackgroundToLight: value })}
            onAngleChange={(value) => updateData({ specialistCardBackgroundAngleLight: value })}
            onRadialStopAChange={(value) => updateData({ specialistCardBackgroundStopALight: value })}
            onRadialStopBChange={(value) => updateData({ specialistCardBackgroundStopBLight: value })}
            onChange={(value) => updateData({ specialistCardBackgroundFromLight: value })}
          />
          <div className="grid grid-cols-2 gap-4">
            {renderOpacitySelect("Непрозрачность в начале", cardLightStartOpacity, (value) =>
              updateData({ specialistCardBackgroundStartOpacityLight: value })
            )}
            {renderOpacitySelect("Непрозрачность в конце", cardLightEndOpacity, (value) =>
              updateData({ specialistCardBackgroundEndOpacityLight: value })
            )}
          </div>
          {renderCardTypographyControl("Заголовок", "catalogCardTitle", "specialistCardTitle", "#111827", 18, "600", false)}
          {renderCardTypographyControl("Адрес", "catalogCardText", "specialistCardDescription", "#6B7280", 14)}
          <button
            type="button"
            onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
            className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
            style={{
              borderColor: showDarkThemeAdvanced ? "#ff5a5f" : "var(--bp-stroke)",
              backgroundColor: "transparent",
              color: showDarkThemeAdvanced ? "var(--bp-ink)" : "var(--bp-muted)",
            }}
          >
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
              </svg>
              <span>Темная тема</span>
            </span>
            <span className="text-xs">{showDarkThemeAdvanced ? "\u25B4" : "\u25BE"}</span>
          </button>
          {showDarkThemeAdvanced ? (
            <div className="space-y-4">
              <TildaBackgroundColorField
                label="Фон карточек"
                value={cardDarkFrom}
                mode={cardDarkMode}
                secondValue={cardDarkTo}
                angle={cardDarkAngle}
                radialStopA={cardDarkStopA}
                radialStopB={cardDarkStopB}
                placeholder="#24282e"
                onModeChange={(value) => updateData({ specialistCardBackgroundModeDark: value })}
                onSecondChange={(value) => updateData({ specialistCardBackgroundToDark: value })}
                onAngleChange={(value) => updateData({ specialistCardBackgroundAngleDark: value })}
                onRadialStopAChange={(value) => updateData({ specialistCardBackgroundStopADark: value })}
                onRadialStopBChange={(value) => updateData({ specialistCardBackgroundStopBDark: value })}
                onChange={(value) => updateData({ specialistCardBackgroundFromDark: value })}
              />
              <div className="grid grid-cols-2 gap-4">
                {renderOpacitySelect("Непрозрачность в начале", cardDarkStartOpacity, (value) =>
                  updateData({ specialistCardBackgroundStartOpacityDark: value })
                )}
                {renderOpacitySelect("Непрозрачность в конце", cardDarkEndOpacity, (value) =>
                  updateData({ specialistCardBackgroundEndOpacityDark: value })
                )}
              </div>
              {renderCardDarkColorControl("Заголовок", "catalogCardTitle", "specialistCardTitle", "#F8FAFC")}
              {renderCardDarkColorControl("Адрес", "catalogCardText", "specialistCardDescription", "#CBD5E1")}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeSectionId === "servicePage") {
    const lightMode = readBackgroundMode(data.specialistCardBackgroundModeLight);
    const darkMode = readBackgroundMode(data.specialistCardBackgroundModeDark ?? lightMode);
    const lightFrom = readDataColor("specialistCardBackgroundFromLight", readStyle("subBlockBgLight", "#fafafa"));
    const lightTo = readDataColor("specialistCardBackgroundToLight", lightFrom);
    const darkFrom = readDataColor("specialistCardBackgroundFromDark", readStyle("subBlockBgDark", "#24282e"));
    const darkTo = readDataColor("specialistCardBackgroundToDark", darkFrom);
    const renderLocationCardTypographyControl = (
      title: string,
      prefix: string,
      legacyPrefix: string,
      colorFallback: string,
      sizeFallback: number,
      weightFallback = "",
      showTopBorder = true
    ) => {
      const mobileKey = `locationPage:${prefix}MobileSize`;
      const desktopSize = readDataNumberFallback(`${prefix}Size`, `${legacyPrefix}Size`, sizeFallback);
      const mobileSize = Number(data[`${prefix}MobileSize`]);
      const legacyMobileSize = Number(data[`${legacyPrefix}MobileSize`]);
      const mobileValue = Number.isFinite(mobileSize)
        ? Math.round(mobileSize)
        : Number.isFinite(legacyMobileSize)
          ? Math.round(legacyMobileSize)
          : null;

      return (
        <div className={`space-y-4 ${showTopBorder ? "border-t border-[color:var(--bp-stroke)] pt-4" : ""}`}>
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">{title}</div>
          <TildaInlineColorField
            compact
            label="Цвет"
            value={readDataColorFallback(`${prefix}ColorLight`, `${legacyPrefix}ColorLight`, colorFallback)}
            placeholder={colorFallback}
            onChange={(value) => updateData({ [`${prefix}ColorLight`]: value })}
            onClear={() => updateData({ [`${prefix}ColorLight`]: "transparent" })}
          />
          {renderFlatNumberPxInput(
            "Размер шрифта",
            desktopSize,
            (value) => updateData({ [`${prefix}Size`]: value }),
            8,
            96,
            {
              value: mobileValue,
              fallback: defaultCatalogCardMobileTextSize(
                prefix,
                Number.isFinite(desktopSize) ? Math.round(desktopSize) : sizeFallback
              ),
              onChange: (value) => updateData({ [`${prefix}MobileSize`]: value }),
              isOpen: mobileTypographyOpen[mobileKey] === true,
              onToggle: () =>
                setMobileTypographyOpen((prev) => ({
                  ...prev,
                  [mobileKey]: !prev[mobileKey],
                })),
            }
          )}
          {renderFontSelect(
            "Шрифт",
            readDataTextFallback(`${prefix}Font`, `${legacyPrefix}Font`, "Manrope"),
            (value) => updateData({ [`${prefix}Font`]: value })
          )}
          {renderWeightSelect(
            "Насыщенность",
            readDataValueFallback(`${prefix}Weight`, `${legacyPrefix}Weight`),
            (value) => updateData({ [`${prefix}Weight`]: value }),
            weightFallback
          )}
        </div>
      );
    };
    const renderLocationCardDarkColorControl = (label: string, prefix: string, legacyPrefix: string, fallback: string) => (
      <TildaInlineColorField
        compact
        label={label}
        value={readDataColorFallback(`${prefix}ColorDark`, `${legacyPrefix}ColorDark`, fallback)}
        placeholder={fallback}
        onChange={(value) => updateData({ [`${prefix}ColorDark`]: value })}
        onClear={() => updateData({ [`${prefix}ColorDark`]: "transparent" })}
      />
    );

    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <TildaBackgroundColorField
          label="Цвет фона карточки филиала"
          value={lightFrom}
          mode={lightMode}
          secondValue={lightTo}
          angle={readDataNumber("specialistCardBackgroundAngleLight", 135)}
          radialStopA={readDataNumber("specialistCardBackgroundStopALight", 0)}
          radialStopB={readDataNumber("specialistCardBackgroundStopBLight", 100)}
          placeholder="#fafafa"
          onModeChange={(value) => updateData({ specialistCardBackgroundModeLight: value })}
          onSecondChange={(value) => updateData({ specialistCardBackgroundToLight: value })}
          onAngleChange={(value) => updateData({ specialistCardBackgroundAngleLight: value })}
          onRadialStopAChange={(value) => updateData({ specialistCardBackgroundStopALight: value })}
          onRadialStopBChange={(value) => updateData({ specialistCardBackgroundStopBLight: value })}
          onChange={(value) => updateData({ specialistCardBackgroundFromLight: value })}
        />
        <FlatCheckbox
          checked={data.showImage !== false}
          onChange={(checked) => updateData({ showImage: checked })}
          label="Показывать фото"
        />
        <FlatCheckbox
          checked={data.showLevel !== false && data.showAddress !== false}
          onChange={(checked) => updateData({ showLevel: checked, showAddress: checked })}
          label="Показывать адрес"
        />
        <FlatCheckbox
          checked={data.showDescription !== false}
          onChange={(checked) => updateData({ showDescription: checked })}
          label="Показывать описание и телефон"
        />
        {renderFlatSelect("Масштабирование изображения", String(data.specialistCardImageFit ?? "cover"), (value) => updateData({ specialistCardImageFit: value }), [
          { value: "cover", label: "Заполнять область" },
          { value: "contain", label: "Вписывать в область" },
        ])}
        {renderFlatNumberInput("Скругление изображения", readDataNumber("imageRadius", 10), (value) => updateData({ imageRadius: value }), 0, 40)}
        {renderFlatNumberInput("Внутренний отступ X", readDataNumber("cardPaddingX", 30), (value) => updateData({ cardPaddingX: value }), 0, 80)}
        {renderFlatNumberInput("Внутренний отступ Y", readDataNumber("cardPaddingY", 30), (value) => updateData({ cardPaddingY: value }), 0, 80)}
        {renderLocationCardTypographyControl("Заголовок", "catalogCardTitle", "specialistCardTitle", "#111827", 18, "600", false)}
        {renderLocationCardTypographyControl("Адрес и описание", "catalogCardText", "specialistCardDescription", "#6B7280", 14)}
        <button
          type="button"
          onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
          className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
          style={{
            borderColor: showDarkThemeAdvanced ? "#ff5a5f" : "var(--bp-stroke)",
            backgroundColor: "transparent",
            color: showDarkThemeAdvanced ? "var(--bp-ink)" : "var(--bp-muted)",
          }}
        >
          <span>Темная тема</span>
          <span className="text-xs">{showDarkThemeAdvanced ? "\u25B4" : "\u25BE"}</span>
        </button>
        {showDarkThemeAdvanced ? (
          <div className="space-y-4">
            <TildaBackgroundColorField
              label="Цвет фона карточки филиала"
              value={darkFrom}
              mode={darkMode}
              secondValue={darkTo}
              angle={readDataNumber("specialistCardBackgroundAngleDark", 135)}
              radialStopA={readDataNumber("specialistCardBackgroundStopADark", 0)}
              radialStopB={readDataNumber("specialistCardBackgroundStopBDark", 100)}
              placeholder="#24282e"
              onModeChange={(value) => updateData({ specialistCardBackgroundModeDark: value })}
              onSecondChange={(value) => updateData({ specialistCardBackgroundToDark: value })}
              onAngleChange={(value) => updateData({ specialistCardBackgroundAngleDark: value })}
              onRadialStopAChange={(value) => updateData({ specialistCardBackgroundStopADark: value })}
              onRadialStopBChange={(value) => updateData({ specialistCardBackgroundStopBDark: value })}
              onChange={(value) => updateData({ specialistCardBackgroundFromDark: value })}
            />
            {renderLocationCardDarkColorControl("Заголовок", "catalogCardTitle", "specialistCardTitle", "#F8FAFC")}
            {renderLocationCardDarkColorControl("Адрес и описание", "catalogCardText", "specialistCardDescription", "#CBD5E1")}
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
