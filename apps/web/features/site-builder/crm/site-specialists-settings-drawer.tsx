import {
  useRef,
  useState,
} from "react";
import {
  TildaBackgroundColorField,
  TildaInlineColorField,
} from "@/features/site-builder/crm/site-editor-panels";
import { FlatCheckbox, updateBlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { SiteLocationItem } from "@/features/site-builder/shared/site-data";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

function renderFlatTextInput(
  label: string,
  value: string,
  onChange: (value: string) => void,
  placeholder?: string
) {
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
      </div>
    </label>
  );
}

function renderFlatNumberPxInput(
  label: string,
  value: number,
  onChange: (value: number) => void,
  min = 0,
  max = 80,
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
    WebkitAppearance: "none",
    MozAppearance: "textfield",
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
            title="Нажмите, чтобы задать значение для мобильного (≤ 480px)"
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
          style={{
            border: 0,
            borderRadius: 0,
            boxShadow: "none",
            backgroundColor: "transparent",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        >
          {Array.from({ length: 11 }, (_, index) => index * 10).map((option) => (
            <option key={`${label}-${option}`} value={option}>
              {option}%
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">{"\u25BE"}</span>
      </div>
    </label>
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

function defaultCardMobileTextSize(prefix: string, desktopSize: number) {
  if (prefix === "specialistCardTitle") {
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

function readAlignment(value: unknown, fallback: "left" | "center" | "right") {
  return value === "left" || value === "center" || value === "right" ? value : fallback;
}

function clampSpecialistModalColumns(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(11, Math.round(parsed))) : fallback;
}

function SpecialistModalColumnsControl({
  mediaColumns,
  infoColumns,
  onChange,
}: {
  mediaColumns: number;
  infoColumns: number;
  onChange: (mediaColumns: number, infoColumns: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const setMediaColumns = (nextMediaColumns: number) => {
    const media = clampSpecialistModalColumns(nextMediaColumns, 6);
    onChange(media, 12 - media);
  };
  const columnFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return mediaColumns;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.max(1, Math.min(11, Math.round(ratio * 12)));
  };
  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const apply = (clientX: number) => setMediaColumns(columnFromClientX(clientX));
    apply(event.clientX);
    const handleMove = (nextEvent: PointerEvent) => apply(nextEvent.clientX);
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };
  const dividerPercent = (mediaColumns / 12) * 100;

  return (
    <div className="relative">
      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        Ширина блоков
      </div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mt-2 flex w-full items-center justify-between border-b border-[color:var(--bp-stroke)] pb-2 text-left text-sm"
      >
        <span>
          {mediaColumns} колонок | {infoColumns} колонок
        </span>
        <span className="text-xs leading-none">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[160] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3 shadow-2xl">
          <div
            ref={(node) => {
              trackRef.current = node;
            }}
            className="relative"
          >
            <div className="grid grid-cols-12 gap-1">
              {Array.from({ length: 12 }, (_, index) => {
                const isMedia = index < mediaColumns;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setMediaColumns(index + 1)}
                    className={`h-14 rounded-sm ${isMedia ? "bg-[#ff5a5f]" : "bg-[#c6cbd3]"}`}
                    aria-label={`${index + 1} колонок`}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onPointerDown={startDrag}
              className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9ca3af] bg-white shadow"
              style={{ left: `${dividerPercent}%` }}
              aria-label="Изменить ширину блоков"
            />
          </div>
          <div className="mt-2 grid grid-cols-2 text-center text-sm text-[color:var(--bp-muted)]">
            <span>{mediaColumns}</span>
            <span>{infoColumns}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SiteSpecialistsSettingsDrawer({
  block,
  activeTheme,
  activeSectionId,
  locations,
  updateBlock,
}: {
  block: SiteBlock;
  activeTheme: SiteTheme;
  activeSectionId: string;
  locations: SiteLocationItem[];
  updateBlock: (blockId: string, updater: (block: SiteBlock) => SiteBlock) => void;
}) {
  const [showDarkThemeAdvanced, setShowDarkThemeAdvanced] = useState(false);
  const [mobileTypographyOpen, setMobileTypographyOpen] = useState<Record<string, boolean>>({});
  const data = (block.data as Record<string, unknown>) ?? {};
  const rawStyle = ((block.data as Record<string, unknown>).style as Record<string, unknown>) ?? {};
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
  const readDataNumber = (key: string, fallback: number) => {
    const value = Number(data[key]);
    return Number.isFinite(value) ? value : fallback;
  };
  const readDefaultedDataColor = (key: string, fallback: string) => {
    const value = readDataColor(key);
    return value && value !== "transparent" ? value : fallback;
  };

  if (activeSectionId === "button") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <FlatCheckbox
          checked={data.showButton !== false}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать основную кнопку записи"
        />
        <FlatCheckbox
          checked={data.showDetailsButton !== false}
          onChange={(checked) => updateData({ showDetailsButton: checked })}
          label="Показывать вторую кнопку"
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
        {renderFlatTextInput(
          "Текст основной кнопки",
          String(data.buttonText ?? "Записаться"),
          (value) => updateData({ buttonText: value }),
          "Записаться"
        )}
        {renderFlatTextInput(
          "Текст второй кнопки",
          String(data.detailsButtonText ?? "Подробнее"),
          (value) => updateData({ detailsButtonText: value }),
          "Подробнее"
        )}
        {renderFlatNumberPxInput(
          "Скругление",
          Number(rawStyle.buttonRadius ?? 0),
          (value) => updateStyle({ buttonRadius: value })
        )}
        <TildaInlineColorField
          compact
          label="Кнопка"
          value={readStyle("buttonColorLight", readStyle("buttonColor", activeTheme.buttonColor))}
          placeholder={activeTheme.buttonColor}
          onChange={(value) => updateStyle({ buttonColorLight: value, buttonColor: value })}
          onClear={() => updateStyle({ buttonColorLight: "transparent", buttonColor: "transparent" })}
        />
        <TildaInlineColorField
          compact
          label="Текст кнопки"
          value={readStyle("buttonTextColorLight", readStyle("buttonTextColor", activeTheme.buttonTextColor))}
          placeholder={activeTheme.buttonTextColor}
          onChange={(value) => updateStyle({ buttonTextColorLight: value, buttonTextColor: value })}
          onClear={() => updateStyle({ buttonTextColorLight: "transparent", buttonTextColor: "transparent" })}
        />
        <TildaInlineColorField
          compact
          label="Фон кнопки подробностей"
          value={readDataColor("detailsButtonColor")}
          placeholder="#ffffff"
          onChange={(value) => updateData({ detailsButtonColor: value })}
          onClear={() => updateData({ detailsButtonColor: "transparent" })}
        />
        <TildaInlineColorField
          compact
          label="Текст второй кнопки"
          value={readDataColor("detailsButtonTextColor", "#111111")}
          placeholder="#111111"
          onChange={(value) => updateData({ detailsButtonTextColor: value })}
          onClear={() => updateData({ detailsButtonTextColor: "transparent" })}
        />
        <TildaInlineColorField
          compact
          label="Обводка кнопки подробностей"
          value={readDataColor("detailsButtonBorderColor")}
          placeholder="#623232"
          onChange={(value) => updateData({ detailsButtonBorderColor: value })}
          onClear={() => updateData({ detailsButtonBorderColor: "transparent" })}
        />

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
            className="mb-4 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
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
                label="Кнопка"
                value={readStyle("buttonColorDark", activeTheme.darkPalette.buttonColor)}
                placeholder={activeTheme.darkPalette.buttonColor}
                onChange={(value) => updateStyle({ buttonColorDark: value })}
                onClear={() => updateStyle({ buttonColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Текст кнопки"
                value={readStyle("buttonTextColorDark", activeTheme.darkPalette.buttonTextColor)}
                placeholder={activeTheme.darkPalette.buttonTextColor}
                onChange={(value) => updateStyle({ buttonTextColorDark: value })}
                onClear={() => updateStyle({ buttonTextColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Фон кнопки подробностей"
                value={readDataColor("detailsButtonColorDark")}
                placeholder="#1f2937"
                onChange={(value) => updateData({ detailsButtonColorDark: value })}
                onClear={() => updateData({ detailsButtonColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Текст второй кнопки"
                value={readDataColor("detailsButtonTextColorDark", "#f8fafc")}
                placeholder="#f8fafc"
                onChange={(value) => updateData({ detailsButtonTextColorDark: value })}
                onClear={() => updateData({ detailsButtonTextColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Обводка кнопки подробностей"
                value={readDataColor("detailsButtonBorderColorDark")}
                placeholder="#374151"
                onChange={(value) => updateData({ detailsButtonBorderColorDark: value })}
                onClear={() => updateData({ detailsButtonBorderColorDark: "transparent" })}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeSectionId === "servicesList") {
    const readBackgroundMode = (value: unknown): "solid" | "linear" | "radial" =>
      value === "linear" || value === "radial" ? value : "solid";
    const cardLightMode = readBackgroundMode(data.specialistCardBackgroundModeLight);
    const cardDarkMode = readBackgroundMode(data.specialistCardBackgroundModeDark ?? cardLightMode);
    const cardLightFrom =
      readDataColor("specialistCardBackgroundFromLight", "") ||
      readStyle("subBlockBgLight", readStyle("subBlockBg", "#fafafa"));
    const cardLightTo =
      readDataColor("specialistCardBackgroundToLight", "") || cardLightFrom || "#fafafa";
    const cardDarkFrom =
      readDataColor("specialistCardBackgroundFromDark", "") ||
      readStyle("subBlockBgDark", "#24282e");
    const cardDarkTo =
      readDataColor("specialistCardBackgroundToDark", "") || cardDarkFrom || "#24282e";
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

    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {renderFlatSelect("Вид списка специалистов", String(data.listView ?? "tile"), (value) => updateData({ listView: value }), [
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
          label="Показывать карточки в один ряд на мобильных устройствах"
        />
        <FlatCheckbox
          checked={Number(data.mobileCardsPerRow ?? 2) === 2}
          onChange={(checked) => updateData({ mobileCardsPerRow: checked ? 2 : 1 })}
          label="Две карточки в ряд на мобильных устройствах"
        />
        <FlatCheckbox
          checked={data.imageZoomOnHover === true}
          onChange={(checked) => updateData({ imageZoomOnHover: checked })}
          label="Увеличивать изображение по наведению"
        />
        <FlatCheckbox
          checked={data.modalImageClickEnabled !== false}
          onChange={(checked) => updateData({ modalImageClickEnabled: checked })}
          label="Открывать карточку специалиста по клику на карточку"
        />
        {renderFlatTextInput(
          "Количество видимых специалистов до кнопки «Загрузить ещё»",
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
            onChange={(value) =>
              updateData({ specialistCardBackgroundFromLight: value })
            }
          />
          <div className="grid grid-cols-2 gap-4">
            {renderOpacitySelect("Непрозрачность в начале", cardLightStartOpacity, (value) =>
              updateData({ specialistCardBackgroundStartOpacityLight: value })
            )}
            {renderOpacitySelect("Непрозрачность в конце", cardLightEndOpacity, (value) =>
              updateData({ specialistCardBackgroundEndOpacityLight: value })
            )}
          </div>
          <TildaInlineColorField
            compact
            label="Заголовок карточки"
            value={readStyle("textColorLight", readStyle("textColor", activeTheme.textColor))}
            placeholder={activeTheme.textColor}
            onChange={(value) => updateStyle({ textColorLight: value, textColor: value })}
            onClear={() => updateStyle({ textColorLight: "transparent", textColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Текст карточки"
            value={readStyle("mutedColorLight", readStyle("mutedColor", activeTheme.mutedColor))}
            placeholder={activeTheme.mutedColor}
            onChange={(value) => updateStyle({ mutedColorLight: value, mutedColor: value })}
            onClear={() => updateStyle({ mutedColorLight: "transparent", mutedColor: "transparent" })}
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
              <TildaInlineColorField
                compact
                label="Заголовок карточки"
                value={readStyle("textColorDark", activeTheme.darkPalette.textColor)}
                placeholder={activeTheme.darkPalette.textColor}
                onChange={(value) => updateStyle({ textColorDark: value })}
                onClear={() => updateStyle({ textColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Текст карточки"
                value={readStyle("mutedColorDark", activeTheme.darkPalette.mutedColor)}
                placeholder={activeTheme.darkPalette.mutedColor}
                onChange={(value) => updateStyle({ mutedColorDark: value })}
                onClear={() => updateStyle({ mutedColorDark: "transparent" })}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeSectionId === "filters") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="flex flex-col items-start gap-4">
          <FlatCheckbox
            checked={data.showCategoryTabs !== false}
            onChange={(checked) => updateData({ showCategoryTabs: checked })}
            label="Показывать уровни специалистов"
          />
          <FlatCheckbox
            checked={data.showSearch !== false}
            onChange={(checked) => updateData({ showSearch: checked })}
            label="Показывать поиск"
          />
          <FlatCheckbox
            checked={data.showSort !== false}
            onChange={(checked) => updateData({ showSort: checked })}
            label="Показывать сортировку"
          />
        </div>
        {renderFlatSelect("Сортировка по умолчанию", String(data.defaultSort ?? "default"), (value) => updateData({ defaultSort: value }), [
          { value: "default", label: "По умолчанию" },
          { value: "nameAsc", label: "Имя: А-Я" },
          { value: "nameDesc", label: "Имя: Я-А" },
          { value: "levelAsc", label: "Уровень: А-Я" },
          { value: "levelDesc", label: "Уровень: Я-А" },
        ])}
        {renderFlatTextInput("Текст вкладки «Все»", String(data.categoryAllLabel ?? "Все специалисты"), (value) => updateData({ categoryAllLabel: value || "Все специалисты" }), "Все специалисты")}
        {renderFlatTextInput("Плейсхолдер поиска", String(data.searchPlaceholder ?? "Поиск специалиста"), (value) => updateData({ searchPlaceholder: value || "Поиск специалиста" }), "Поиск специалиста")}
        {renderFlatSelect("Выравнивание поиска/сортировки", readAlignment(data.searchSortAlignment, "right"), (value) => updateData({ searchSortAlignment: readAlignment(value, "right") }), [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        {renderFlatSelect("Выравнивание фильтров", readAlignment(data.filtersAlignment, "left"), (value) => updateData({ filtersAlignment: readAlignment(value, "left") }), [
          { value: "left", label: "По левому краю" },
          { value: "center", label: "По центру" },
          { value: "right", label: "По правому краю" },
        ])}
        <div className="space-y-4">
          <TildaInlineColorField
            compact
            label="Цвет текста уровней"
            value={readDefaultedDataColor("categoryTextColor", activeTheme.textColor)}
            placeholder={activeTheme.textColor}
            onChange={(value) => updateData({ categoryTextColor: value })}
            onClear={() => updateData({ categoryTextColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Активный уровень"
            value={readDefaultedDataColor("categoryActiveColor", activeTheme.buttonColor)}
            placeholder={activeTheme.buttonColor}
            onChange={(value) => updateData({ categoryActiveColor: value })}
            onClear={() => updateData({ categoryActiveColor: "transparent" })}
          />
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
          <TildaInlineColorField
            compact
            label="Цвет текста выбора локации"
            value={readDefaultedDataColor("locationTextColor", activeTheme.textColor)}
            placeholder={activeTheme.textColor}
            onChange={(value) => updateData({ locationTextColor: value })}
            onClear={() => updateData({ locationTextColor: "transparent" })}
          />
          <TildaInlineColorField
            compact
            label="Активный пункт локации"
            value={readDefaultedDataColor("locationActiveColor", activeTheme.buttonColor)}
            placeholder={activeTheme.buttonColor}
            onChange={(value) => updateData({ locationActiveColor: value })}
            onClear={() => updateData({ locationActiveColor: "transparent" })}
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
                label="Цвет текста уровней"
                value={readDefaultedDataColor("categoryTextColorDark", activeTheme.darkPalette.textColor)}
                placeholder={activeTheme.darkPalette.textColor}
                onChange={(value) => updateData({ categoryTextColorDark: value })}
                onClear={() => updateData({ categoryTextColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Активный уровень"
                value={readDefaultedDataColor("categoryActiveColorDark", activeTheme.darkPalette.buttonColor)}
                placeholder={activeTheme.darkPalette.buttonColor}
                onChange={(value) => updateData({ categoryActiveColorDark: value })}
                onClear={() => updateData({ categoryActiveColorDark: "transparent" })}
              />
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
              <TildaInlineColorField
                compact
                label="Цвет текста выбора локации"
                value={readDefaultedDataColor("locationTextColorDark", activeTheme.darkPalette.textColor)}
                placeholder={activeTheme.darkPalette.textColor}
                onChange={(value) => updateData({ locationTextColorDark: value })}
                onClear={() => updateData({ locationTextColorDark: "transparent" })}
              />
              <TildaInlineColorField
                compact
                label="Активный пункт локации"
                value={readDefaultedDataColor("locationActiveColorDark", activeTheme.darkPalette.buttonColor)}
                placeholder={activeTheme.darkPalette.buttonColor}
                onChange={(value) => updateData({ locationActiveColorDark: value })}
                onClear={() => updateData({ locationActiveColorDark: "transparent" })}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeSectionId === "servicePage") {
    const readBackgroundMode = (value: unknown): "solid" | "linear" | "radial" =>
      value === "linear" || value === "radial" ? value : "solid";
    const cardLightMode = readBackgroundMode(data.specialistCardBackgroundModeLight);
    const cardDarkMode = readBackgroundMode(data.specialistCardBackgroundModeDark ?? cardLightMode);
    const cardLightFrom =
      readDataColor("specialistCardBackgroundFromLight", "") ||
      readStyle("subBlockBgLight", readStyle("subBlockBg", "#fafafa"));
    const cardLightTo =
      readDataColor("specialistCardBackgroundToLight", "") || cardLightFrom || "#fafafa";
    const cardDarkFrom =
      readDataColor("specialistCardBackgroundFromDark", "") ||
      readStyle("subBlockBgDark", "#24282e");
    const cardDarkTo =
      readDataColor("specialistCardBackgroundToDark", "") || cardDarkFrom || "#24282e";
    const cardLightAngle = readDataNumber("specialistCardBackgroundAngleLight", 135);
    const cardDarkAngle = readDataNumber("specialistCardBackgroundAngleDark", cardLightAngle);
    const cardLightStopA = readDataNumber("specialistCardBackgroundStopALight", 0);
    const cardLightStopB = readDataNumber("specialistCardBackgroundStopBLight", 100);
    const cardDarkStopA = readDataNumber("specialistCardBackgroundStopADark", cardLightStopA);
    const cardDarkStopB = readDataNumber("specialistCardBackgroundStopBDark", cardLightStopB);
    const fontOptions = [
      { value: "Manrope", label: "Manrope" },
      { value: "Inter", label: "Inter" },
      { value: "Arial", label: "Arial" },
      { value: "Georgia", label: "Georgia" },
      { value: "Times New Roman", label: "Times New Roman" },
    ];
    const weightOptions = [
      { value: "", label: "По умолчанию" },
      { value: "300", label: "300" },
      { value: "400", label: "400" },
      { value: "500", label: "500" },
      { value: "600", label: "600" },
      { value: "700", label: "700" },
      { value: "800", label: "800" },
    ];
    const renderCardTypographyControl = (
      title: string,
      prefix: string,
      colorFallback: string,
      sizeFallback: number,
      weightFallback = "",
      showTopBorder = true
    ) => {
      const mobileKey = `specialistCard:${prefix}MobileSize`;
      const desktopSize = Number(data[`${prefix}Size`] ?? sizeFallback);
      const mobileSize = Number(data[`${prefix}MobileSize`]);
      const mobileValue = Number.isFinite(mobileSize) ? Math.round(mobileSize) : null;

      return (
        <div className={`space-y-4 ${showTopBorder ? "border-t border-[color:var(--bp-stroke)] pt-4" : ""}`}>
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">{title}</div>
          <TildaInlineColorField
            compact
            label="Цвет"
            value={readDataColor(`${prefix}ColorLight`, colorFallback)}
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
              fallback: defaultCardMobileTextSize(
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
          {renderFlatSelect(
            "Шрифт",
            String(data[`${prefix}Font`] ?? "Manrope"),
            (value) => updateData({ [`${prefix}Font`]: value }),
            fontOptions
          )}
          {renderFlatSelect(
            "Насыщенность",
            String(data[`${prefix}Weight`] ?? weightFallback),
            (value) => updateData({ [`${prefix}Weight`]: value ? Number(value) : "" }),
            weightOptions
          )}
        </div>
      );
    };
    const renderCardDarkColorControl = (label: string, prefix: string, fallback: string) => (
      <TildaInlineColorField
        compact
        label={label}
        value={readDataColor(`${prefix}ColorDark`, fallback)}
        placeholder={fallback}
        onChange={(value) => updateData({ [`${prefix}ColorDark`]: value })}
        onClear={() => updateData({ [`${prefix}ColorDark`]: "transparent" })}
      />
    );
    const specialistModalMediaColumns = clampSpecialistModalColumns(data.specialistModalMediaColumns, 6);
    const specialistModalInfoColumnsRaw = clampSpecialistModalColumns(
      data.specialistModalInfoColumns,
      12 - specialistModalMediaColumns
    );
    const specialistModalInfoColumns =
      specialistModalMediaColumns + specialistModalInfoColumnsRaw === 12
        ? specialistModalInfoColumnsRaw
        : 12 - specialistModalMediaColumns;

    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <SpecialistModalColumnsControl
          mediaColumns={specialistModalMediaColumns}
          infoColumns={specialistModalInfoColumns}
          onChange={(mediaColumns, infoColumns) =>
            updateData({ specialistModalMediaColumns: mediaColumns, specialistModalInfoColumns: infoColumns })
          }
        />
        <TildaBackgroundColorField
          label="Цвет фона карточки специалиста"
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
          onChange={(value) =>
            updateData({ specialistCardBackgroundFromLight: value })
          }
        />
        <FlatCheckbox
          checked={data.specialistCardImageZoomOnClick === true}
          onChange={(checked) => updateData({ specialistCardImageZoomOnClick: checked })}
          label="Увеличение изображения по клику"
        />
        <FlatCheckbox
          checked={data.showDescription !== false}
          onChange={(checked) => updateData({ showDescription: checked })}
          label="Показывать описание в карточке"
        />
        <FlatCheckbox
          checked={data.showLevel !== false}
          onChange={(checked) => updateData({ showLevel: checked })}
          label="Показывать уровень специалиста"
        />
        {renderFlatSelect(
          "Масштабирование изображения",
          String(data.specialistCardImageFit ?? "cover"),
          (value) => updateData({ specialistCardImageFit: value }),
          [
            { value: "cover", label: "Заполнять область" },
            { value: "contain", label: "Вписывать в область" },
          ]
        )}
        {renderFlatNumberPxInput(
          "Скругление",
          Number(data.imageRadius ?? 10),
          (value) => updateData({ imageRadius: value })
        )}
        {renderCardTypographyControl("Заголовок", "specialistCardTitle", "#111827", 18, "600", false)}
        {renderCardTypographyControl("Описание", "specialistCardDescription", "#6B7280", 14)}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowDarkThemeAdvanced((prev) => !prev)}
            className="mb-4 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
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
              <TildaBackgroundColorField
                label="Цвет фона карточки специалиста"
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
              {renderCardDarkColorControl("Заголовок", "specialistCardTitle", "#F8FAFC")}
              {renderCardDarkColorControl("Описание", "specialistCardDescription", "#CBD5E1")}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}
