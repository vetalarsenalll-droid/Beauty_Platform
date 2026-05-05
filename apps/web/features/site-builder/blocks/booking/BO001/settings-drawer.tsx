import { useState } from "react";
import {
  TildaBackgroundColorField,
  TildaInlineColorField,
} from "@/features/site-builder/crm/site-editor-panels";
import { normalizeBlockStyle, updateBlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";

type Props = {
  block: SiteBlock;
  activeTheme: SiteTheme;
  activeSectionId: string;
  updateBlock: (blockId: string, updater: (block: SiteBlock) => SiteBlock) => void;
};

type BackgroundMode = "solid" | "linear" | "radial";

const FONT_OPTIONS = [
  { value: "Manrope", label: "Manrope" },
  { value: "Inter", label: "Inter" },
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
];

const WEIGHT_OPTIONS = [
  { value: "", label: "Обычная" },
  { value: "300", label: "300" },
  { value: "400", label: "400" },
  { value: "500", label: "500" },
  { value: "600", label: "600" },
  { value: "700", label: "700" },
  { value: "800", label: "800" },
];

function flatNumber(label: string, value: number, onChange: (value: number) => void, min = 0, max = 96, suffix = "px") {
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
        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">{suffix}</span>
      </div>
    </label>
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

function darkThemeToggle(open: boolean, setOpen: (value: boolean | ((prev: boolean) => boolean)) => void) {
  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
      style={{
        borderColor: open ? "#ff5a5f" : "var(--bp-stroke)",
        backgroundColor: "transparent",
        color: open ? "var(--bp-ink)" : "var(--bp-muted)",
      }}
    >
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
        </svg>
        <span>Темная тема</span>
      </span>
      <span className="text-xs">{open ? "▴" : "▾"}</span>
    </button>
  );
}

function backgroundMode(value: unknown): BackgroundMode {
  return value === "linear" || value === "radial" ? value : "solid";
}

function readNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function BO001SettingsDrawer({ block, activeTheme, activeSectionId, updateBlock }: Props) {
  const [showDarkTheme, setShowDarkTheme] = useState(false);
  const style = normalizeBlockStyle(block, activeTheme);
  const rawStyle = ((block.data as Record<string, unknown>).style as Record<string, unknown>) ?? {};

  const updateStyle = (patch: Record<string, unknown>) => {
    updateBlock(block.id, (prev) => updateBlockStyle(prev, patch));
  };
  const readRaw = (key: string, fallback = "") => {
    const value = rawStyle[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };
  const color = (key: string, fallback: string) => readRaw(key, fallback) || fallback;

  if (activeSectionId === "typography") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Основной текст</div>
          <TildaInlineColorField compact label="Цвет" value={color("textColorLight", activeTheme.textColor)} placeholder={activeTheme.textColor} onChange={(value) => updateStyle({ textColorLight: value, textColor: value })} onClear={() => updateStyle({ textColorLight: "transparent", textColor: "transparent" })} />
          {flatNumber("Размер шрифта", style.textSize ?? activeTheme.textSize ?? 14, (value) => updateStyle({ textSize: value }), 10, 32)}
          {flatSelect("Шрифт", style.fontBody || activeTheme.fontBody || "Manrope", (value) => updateStyle({ fontBody: value }), FONT_OPTIONS)}
          {flatSelect("Насыщенность", String(style.fontWeightBody ?? ""), (value) => updateStyle({ fontWeightBody: value ? Number(value) : "" }), WEIGHT_OPTIONS)}
        </div>

        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Заголовки шагов</div>
          {flatNumber("Размер шрифта", style.headingSize ?? activeTheme.headingSize ?? 18, (value) => updateStyle({ headingSize: value }), 12, 48)}
          {flatSelect("Шрифт", style.fontHeading || activeTheme.fontHeading || "Manrope", (value) => updateStyle({ fontHeading: value }), FONT_OPTIONS)}
          {flatSelect("Насыщенность", String(style.fontWeightHeading ?? ""), (value) => updateStyle({ fontWeightHeading: value ? Number(value) : "" }), WEIGHT_OPTIONS)}
        </div>

        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Вторичный текст интерфейса</div>
          <TildaInlineColorField compact label="Цвет" value={color("mutedColorLight", activeTheme.mutedColor)} placeholder={activeTheme.mutedColor} onChange={(value) => updateStyle({ mutedColorLight: value, mutedColor: value })} onClear={() => updateStyle({ mutedColorLight: "transparent", mutedColor: "transparent" })} />
          {flatNumber("Размер шрифта", style.subheadingSize ?? activeTheme.subheadingSize ?? 16, (value) => updateStyle({ subheadingSize: value }), 10, 36)}
          {flatSelect("Шрифт", style.fontSubheading || style.fontBody || activeTheme.fontBody || "Manrope", (value) => updateStyle({ fontSubheading: value }), FONT_OPTIONS)}
          {flatSelect("Насыщенность", String(style.fontWeightSubheading ?? ""), (value) => updateStyle({ fontWeightSubheading: value ? Number(value) : "" }), WEIGHT_OPTIONS)}
        </div>

        {darkThemeToggle(showDarkTheme, setShowDarkTheme)}
        {showDarkTheme ? (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Основной текст" value={color("textColorDark", activeTheme.darkPalette.textColor)} placeholder={activeTheme.darkPalette.textColor} onChange={(value) => updateStyle({ textColorDark: value })} onClear={() => updateStyle({ textColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Вторичный текст" value={color("mutedColorDark", activeTheme.darkPalette.mutedColor)} placeholder={activeTheme.darkPalette.mutedColor} onChange={(value) => updateStyle({ mutedColorDark: value })} onClear={() => updateStyle({ mutedColorDark: "transparent" })} />
          </div>
        ) : null}
      </div>
    );
  }

  if (activeSectionId === "button") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {flatNumber("Радиус кнопок", style.buttonRadius ?? activeTheme.buttonRadius ?? 0, (value) => updateStyle({ buttonRadius: value }), 0, 40)}
        <TildaInlineColorField compact label="Фон основной кнопки" value={color("buttonColorLight", activeTheme.buttonColor)} placeholder={activeTheme.buttonColor} onChange={(value) => updateStyle({ buttonColorLight: value, buttonColor: value })} onClear={() => updateStyle({ buttonColorLight: "transparent", buttonColor: "transparent" })} />
        <TildaInlineColorField compact label="Текст основной кнопки" value={color("buttonTextColorLight", activeTheme.buttonTextColor)} placeholder={activeTheme.buttonTextColor} onChange={(value) => updateStyle({ buttonTextColorLight: value, buttonTextColor: value })} onClear={() => updateStyle({ buttonTextColorLight: "transparent", buttonTextColor: "transparent" })} />
        <TildaInlineColorField compact label="Обводка основной кнопки" value={color("primaryButtonBorderColorLight", "transparent")} placeholder="transparent" onChange={(value) => updateStyle({ primaryButtonBorderColorLight: value })} onClear={() => updateStyle({ primaryButtonBorderColorLight: "transparent" })} />
        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Вторичные кнопки</div>
          <TildaInlineColorField compact label="Фон" value={color("secondaryButtonBgLight", color("cardBgLight", "#f8f8f8"))} placeholder="#f8f8f8" onChange={(value) => updateStyle({ secondaryButtonBgLight: value })} onClear={() => updateStyle({ secondaryButtonBgLight: "transparent" })} />
          <TildaInlineColorField compact label="Текст" value={color("secondaryButtonTextColorLight", activeTheme.textColor)} placeholder={activeTheme.textColor} onChange={(value) => updateStyle({ secondaryButtonTextColorLight: value })} onClear={() => updateStyle({ secondaryButtonTextColorLight: "transparent" })} />
          <TildaInlineColorField compact label="Обводка" value={color("secondaryButtonBorderColorLight", color("cardBorderColorLight", activeTheme.borderColor))} placeholder={activeTheme.borderColor} onChange={(value) => updateStyle({ secondaryButtonBorderColorLight: value })} onClear={() => updateStyle({ secondaryButtonBorderColorLight: "transparent" })} />
        </div>
        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Кнопка выбора в карточках</div>
          <TildaInlineColorField compact label="Фон" value={color("bookingCardActionBgLight", color("secondaryButtonBgLight", "#f8f8f8"))} placeholder="#f8f8f8" onChange={(value) => updateStyle({ bookingCardActionBgLight: value })} onClear={() => updateStyle({ bookingCardActionBgLight: "transparent" })} />
          <TildaInlineColorField compact label="Текст" value={color("bookingCardActionTextColorLight", color("secondaryButtonTextColorLight", activeTheme.textColor))} placeholder={activeTheme.textColor} onChange={(value) => updateStyle({ bookingCardActionTextColorLight: value })} onClear={() => updateStyle({ bookingCardActionTextColorLight: "transparent" })} />
          <TildaInlineColorField compact label="Обводка" value={color("bookingCardActionBorderColorLight", color("secondaryButtonBorderColorLight", activeTheme.borderColor))} placeholder={activeTheme.borderColor} onChange={(value) => updateStyle({ bookingCardActionBorderColorLight: value })} onClear={() => updateStyle({ bookingCardActionBorderColorLight: "transparent" })} />
        </div>

        {darkThemeToggle(showDarkTheme, setShowDarkTheme)}
        {showDarkTheme ? (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Фон основной кнопки" value={color("buttonColorDark", activeTheme.darkPalette.buttonColor)} placeholder={activeTheme.darkPalette.buttonColor} onChange={(value) => updateStyle({ buttonColorDark: value })} onClear={() => updateStyle({ buttonColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст основной кнопки" value={color("buttonTextColorDark", activeTheme.darkPalette.buttonTextColor)} placeholder={activeTheme.darkPalette.buttonTextColor} onChange={(value) => updateStyle({ buttonTextColorDark: value })} onClear={() => updateStyle({ buttonTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Обводка основной кнопки" value={color("primaryButtonBorderColorDark", "transparent")} placeholder="transparent" onChange={(value) => updateStyle({ primaryButtonBorderColorDark: value })} onClear={() => updateStyle({ primaryButtonBorderColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Фон вторичных кнопок" value={color("secondaryButtonBgDark", color("cardBgDark", "#1f2329"))} placeholder="#1f2329" onChange={(value) => updateStyle({ secondaryButtonBgDark: value })} onClear={() => updateStyle({ secondaryButtonBgDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст вторичных кнопок" value={color("secondaryButtonTextColorDark", activeTheme.darkPalette.textColor)} placeholder={activeTheme.darkPalette.textColor} onChange={(value) => updateStyle({ secondaryButtonTextColorDark: value })} onClear={() => updateStyle({ secondaryButtonTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Обводка вторичных кнопок" value={color("secondaryButtonBorderColorDark", color("cardBorderColorDark", activeTheme.darkPalette.borderColor))} placeholder={activeTheme.darkPalette.borderColor} onChange={(value) => updateStyle({ secondaryButtonBorderColorDark: value })} onClear={() => updateStyle({ secondaryButtonBorderColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Фон кнопки выбора" value={color("bookingCardActionBgDark", color("secondaryButtonBgDark", "#1f2329"))} placeholder="#1f2329" onChange={(value) => updateStyle({ bookingCardActionBgDark: value })} onClear={() => updateStyle({ bookingCardActionBgDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст кнопки выбора" value={color("bookingCardActionTextColorDark", color("secondaryButtonTextColorDark", activeTheme.darkPalette.textColor))} placeholder={activeTheme.darkPalette.textColor} onChange={(value) => updateStyle({ bookingCardActionTextColorDark: value })} onClear={() => updateStyle({ bookingCardActionTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Обводка кнопки выбора" value={color("bookingCardActionBorderColorDark", color("secondaryButtonBorderColorDark", activeTheme.darkPalette.borderColor))} placeholder={activeTheme.darkPalette.borderColor} onChange={(value) => updateStyle({ bookingCardActionBorderColorDark: value })} onClear={() => updateStyle({ bookingCardActionBorderColorDark: "transparent" })} />
          </div>
        ) : null}
      </div>
    );
  }

  if (activeSectionId === "panels") {
    const panelLightMode = backgroundMode(rawStyle.gradientModeLight);
    const panelDarkMode = backgroundMode(rawStyle.gradientModeDark ?? panelLightMode);
    const cardLightMode = backgroundMode(rawStyle.cardBackgroundModeLight);
    const cardDarkMode = backgroundMode(rawStyle.cardBackgroundModeDark ?? cardLightMode);
    const fieldLightMode = backgroundMode(rawStyle.fieldBackgroundModeLight);
    const fieldDarkMode = backgroundMode(rawStyle.fieldBackgroundModeDark ?? fieldLightMode);
    const cardRadius = style.cardRadius ?? 24;
    const bookingImageRadius = style.bookingImageRadius ?? Math.min(cardRadius, 18);

    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Панели</div>
          {flatNumber("Радиус панелей", style.radius ?? activeTheme.radius ?? 24, (value) => updateStyle({ radius: value }), 0, 48)}
          <TildaBackgroundColorField
            label="Фон панелей"
            value={color("gradientFromLight", color("blockBgLight", "#ffffff"))}
            mode={panelLightMode}
            secondValue={color("gradientToLight", color("blockBgLight", "#ffffff"))}
            angle={readNumber(rawStyle.gradientAngleLight, 135)}
            radialStopA={readNumber(rawStyle.gradientStopALight, 0)}
            radialStopB={readNumber(rawStyle.gradientStopBLight, 100)}
            placeholder="#ffffff"
            onModeChange={(value) => updateStyle({ gradientModeLight: value, gradientEnabledLight: value !== "solid" })}
            onSecondChange={(value) => updateStyle({ gradientToLight: value, gradientEnabledLight: panelLightMode !== "solid" })}
            onAngleChange={(value) => updateStyle({ gradientAngleLight: value, gradientEnabledLight: panelLightMode !== "solid" })}
            onRadialStopAChange={(value) => updateStyle({ gradientStopALight: value, gradientEnabledLight: panelLightMode !== "solid" })}
            onRadialStopBChange={(value) => updateStyle({ gradientStopBLight: value, gradientEnabledLight: panelLightMode !== "solid" })}
            onChange={(value) => updateStyle({ blockBgLight: value, blockBg: value, gradientFromLight: value })}
          />
          <TildaInlineColorField compact label="Обводка панелей" value={color("panelBorderColorLight", color("borderColorLight", activeTheme.borderColor))} placeholder={activeTheme.borderColor} onChange={(value) => updateStyle({ panelBorderColorLight: value })} onClear={() => updateStyle({ panelBorderColorLight: "transparent" })} />
          {flatNumber("Размер тени", style.shadowSize ?? 5, (value) => updateStyle({ shadowSize: value }), 0, 48)}
          <TildaInlineColorField compact label="Цвет тени" value={color("shadowColor", "#111827")} placeholder="#111827" onChange={(value) => updateStyle({ shadowColor: value })} onClear={() => updateStyle({ shadowColor: "transparent" })} />
        </div>

        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Карточки</div>
          {flatNumber(
            "Радиус карточек",
            cardRadius,
            (value) =>
              updateStyle({
                cardRadius: value,
                ...(style.bookingImageRadius === null || style.bookingImageRadius === undefined
                  ? { bookingImageRadius }
                  : {}),
              }),
            0,
            48
          )}
          {flatNumber("Радиус изображения", bookingImageRadius, (value) => updateStyle({ bookingImageRadius: value }), 0, 48)}
          <TildaBackgroundColorField
            label="Фон карточек"
            value={color("cardBgLight", color("subBlockBgLight", "#f8f8f8"))}
            mode={cardLightMode}
            secondValue={color("cardBackgroundToLight", color("cardBgLight", color("subBlockBgLight", "#f8f8f8")))}
            angle={readNumber(rawStyle.cardBackgroundAngleLight, 135)}
            radialStopA={readNumber(rawStyle.cardBackgroundStopALight, 0)}
            radialStopB={readNumber(rawStyle.cardBackgroundStopBLight, 100)}
            placeholder="#f8f8f8"
            onModeChange={(value) => updateStyle({ cardBackgroundModeLight: value })}
            onSecondChange={(value) => updateStyle({ cardBackgroundToLight: value })}
            onAngleChange={(value) => updateStyle({ cardBackgroundAngleLight: value })}
            onRadialStopAChange={(value) => updateStyle({ cardBackgroundStopALight: value })}
            onRadialStopBChange={(value) => updateStyle({ cardBackgroundStopBLight: value })}
            onChange={(value) => updateStyle({ cardBgLight: value, subBlockBgLight: value, subBlockBg: value })}
          />
          <TildaInlineColorField compact label="Обводка карточек" value={color("cardBorderColorLight", color("borderColorLight", activeTheme.borderColor))} placeholder={activeTheme.borderColor} onChange={(value) => updateStyle({ cardBorderColorLight: value })} onClear={() => updateStyle({ cardBorderColorLight: "transparent" })} />
          <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Текст карточек</div>
            <TildaInlineColorField compact label="Заголовок" value={color("bookingCardTitleColorLight", "#111827")} placeholder="#111827" onChange={(value) => updateStyle({ bookingCardTitleColorLight: value })} onClear={() => updateStyle({ bookingCardTitleColorLight: "transparent" })} />
            {flatNumber("Размер заголовка", readNumber(rawStyle.bookingCardTitleSizeLight, 16), (value) => updateStyle({ bookingCardTitleSizeLight: value }), 10, 36)}
            {flatSelect("Насыщенность заголовка", String(rawStyle.bookingCardTitleWeightLight ?? "600"), (value) => updateStyle({ bookingCardTitleWeightLight: value ? Number(value) : "" }), WEIGHT_OPTIONS)}
            <TildaInlineColorField compact label="Подзаголовок" value={color("bookingCardSubtitleColorLight", "#6B7280")} placeholder="#6B7280" onChange={(value) => updateStyle({ bookingCardSubtitleColorLight: value })} onClear={() => updateStyle({ bookingCardSubtitleColorLight: "transparent" })} />
            {flatNumber("Размер подзаголовка", readNumber(rawStyle.bookingCardSubtitleSizeLight, 14), (value) => updateStyle({ bookingCardSubtitleSizeLight: value }), 10, 32)}
            {flatSelect("Насыщенность подзаголовка", String(rawStyle.bookingCardSubtitleWeightLight ?? "400"), (value) => updateStyle({ bookingCardSubtitleWeightLight: value ? Number(value) : "" }), WEIGHT_OPTIONS)}
          </div>
        </div>

        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Поля</div>
          <TildaBackgroundColorField
            label="Фон полей"
            value={color("fieldBgLight", color("cardBgLight", color("subBlockBgLight", "#ffffff")))}
            mode={fieldLightMode}
            secondValue={color("fieldBackgroundToLight", color("fieldBgLight", color("cardBgLight", "#ffffff")))}
            angle={readNumber(rawStyle.fieldBackgroundAngleLight, 135)}
            radialStopA={readNumber(rawStyle.fieldBackgroundStopALight, 0)}
            radialStopB={readNumber(rawStyle.fieldBackgroundStopBLight, 100)}
            placeholder="#ffffff"
            onModeChange={(value) => updateStyle({ fieldBackgroundModeLight: value })}
            onSecondChange={(value) => updateStyle({ fieldBackgroundToLight: value })}
            onAngleChange={(value) => updateStyle({ fieldBackgroundAngleLight: value })}
            onRadialStopAChange={(value) => updateStyle({ fieldBackgroundStopALight: value })}
            onRadialStopBChange={(value) => updateStyle({ fieldBackgroundStopBLight: value })}
            onChange={(value) => updateStyle({ fieldBgLight: value })}
          />
          <TildaInlineColorField compact label="Обводка полей" value={color("fieldBorderColorLight", color("cardBorderColorLight", activeTheme.borderColor))} placeholder={activeTheme.borderColor} onChange={(value) => updateStyle({ fieldBorderColorLight: value })} onClear={() => updateStyle({ fieldBorderColorLight: "transparent" })} />
        </div>

        {darkThemeToggle(showDarkTheme, setShowDarkTheme)}
        {showDarkTheme ? (
          <div className="space-y-4">
            <TildaBackgroundColorField
              label="Фон панелей"
              value={color("gradientFromDark", color("blockBgDark", "#16181d"))}
              mode={panelDarkMode}
              secondValue={color("gradientToDark", color("blockBgDark", "#16181d"))}
              angle={readNumber(rawStyle.gradientAngleDark, readNumber(rawStyle.gradientAngleLight, 135))}
              radialStopA={readNumber(rawStyle.gradientStopADark, readNumber(rawStyle.gradientStopALight, 0))}
              radialStopB={readNumber(rawStyle.gradientStopBDark, readNumber(rawStyle.gradientStopBLight, 100))}
              placeholder="#16181d"
              onModeChange={(value) => updateStyle({ gradientModeDark: value, gradientEnabledDark: value !== "solid" })}
              onSecondChange={(value) => updateStyle({ gradientToDark: value, gradientEnabledDark: panelDarkMode !== "solid" })}
              onAngleChange={(value) => updateStyle({ gradientAngleDark: value, gradientEnabledDark: panelDarkMode !== "solid" })}
              onRadialStopAChange={(value) => updateStyle({ gradientStopADark: value, gradientEnabledDark: panelDarkMode !== "solid" })}
              onRadialStopBChange={(value) => updateStyle({ gradientStopBDark: value, gradientEnabledDark: panelDarkMode !== "solid" })}
              onChange={(value) => updateStyle({ blockBgDark: value, gradientFromDark: value })}
            />
            <TildaInlineColorField compact label="Обводка панелей" value={color("panelBorderColorDark", color("borderColorDark", activeTheme.darkPalette.borderColor))} placeholder={activeTheme.darkPalette.borderColor} onChange={(value) => updateStyle({ panelBorderColorDark: value })} onClear={() => updateStyle({ panelBorderColorDark: "transparent" })} />
            <TildaBackgroundColorField
              label="Фон карточек"
              value={color("cardBgDark", color("subBlockBgDark", "#1f2329"))}
              mode={cardDarkMode}
              secondValue={color("cardBackgroundToDark", color("cardBgDark", color("subBlockBgDark", "#1f2329")))}
              angle={readNumber(rawStyle.cardBackgroundAngleDark, readNumber(rawStyle.cardBackgroundAngleLight, 135))}
              radialStopA={readNumber(rawStyle.cardBackgroundStopADark, readNumber(rawStyle.cardBackgroundStopALight, 0))}
              radialStopB={readNumber(rawStyle.cardBackgroundStopBDark, readNumber(rawStyle.cardBackgroundStopBLight, 100))}
              placeholder="#1f2329"
              onModeChange={(value) => updateStyle({ cardBackgroundModeDark: value })}
              onSecondChange={(value) => updateStyle({ cardBackgroundToDark: value })}
              onAngleChange={(value) => updateStyle({ cardBackgroundAngleDark: value })}
              onRadialStopAChange={(value) => updateStyle({ cardBackgroundStopADark: value })}
              onRadialStopBChange={(value) => updateStyle({ cardBackgroundStopBDark: value })}
              onChange={(value) => updateStyle({ cardBgDark: value, subBlockBgDark: value })}
            />
            <TildaInlineColorField compact label="Обводка карточек" value={color("cardBorderColorDark", color("borderColorDark", activeTheme.darkPalette.borderColor))} placeholder={activeTheme.darkPalette.borderColor} onChange={(value) => updateStyle({ cardBorderColorDark: value })} onClear={() => updateStyle({ cardBorderColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Заголовок карточек" value={color("bookingCardTitleColorDark", "#F8FAFC")} placeholder="#F8FAFC" onChange={(value) => updateStyle({ bookingCardTitleColorDark: value })} onClear={() => updateStyle({ bookingCardTitleColorDark: "transparent" })} />
            {flatNumber("Размер заголовка", readNumber(rawStyle.bookingCardTitleSizeDark, readNumber(rawStyle.bookingCardTitleSizeLight, 16)), (value) => updateStyle({ bookingCardTitleSizeDark: value }), 10, 36)}
            {flatSelect("Насыщенность заголовка", String(rawStyle.bookingCardTitleWeightDark ?? rawStyle.bookingCardTitleWeightLight ?? "600"), (value) => updateStyle({ bookingCardTitleWeightDark: value ? Number(value) : "" }), WEIGHT_OPTIONS)}
            <TildaInlineColorField compact label="Подзаголовок карточек" value={color("bookingCardSubtitleColorDark", "#CBD5E1")} placeholder="#CBD5E1" onChange={(value) => updateStyle({ bookingCardSubtitleColorDark: value })} onClear={() => updateStyle({ bookingCardSubtitleColorDark: "transparent" })} />
            {flatNumber("Размер подзаголовка", readNumber(rawStyle.bookingCardSubtitleSizeDark, readNumber(rawStyle.bookingCardSubtitleSizeLight, 14)), (value) => updateStyle({ bookingCardSubtitleSizeDark: value }), 10, 32)}
            {flatSelect("Насыщенность подзаголовка", String(rawStyle.bookingCardSubtitleWeightDark ?? rawStyle.bookingCardSubtitleWeightLight ?? "400"), (value) => updateStyle({ bookingCardSubtitleWeightDark: value ? Number(value) : "" }), WEIGHT_OPTIONS)}
            <TildaBackgroundColorField
              label="Фон полей"
              value={color("fieldBgDark", color("cardBgDark", color("subBlockBgDark", "#16181d")))}
              mode={fieldDarkMode}
              secondValue={color("fieldBackgroundToDark", color("fieldBgDark", color("cardBgDark", "#16181d")))}
              angle={readNumber(rawStyle.fieldBackgroundAngleDark, readNumber(rawStyle.fieldBackgroundAngleLight, 135))}
              radialStopA={readNumber(rawStyle.fieldBackgroundStopADark, readNumber(rawStyle.fieldBackgroundStopALight, 0))}
              radialStopB={readNumber(rawStyle.fieldBackgroundStopBDark, readNumber(rawStyle.fieldBackgroundStopBLight, 100))}
              placeholder="#16181d"
              onModeChange={(value) => updateStyle({ fieldBackgroundModeDark: value })}
              onSecondChange={(value) => updateStyle({ fieldBackgroundToDark: value })}
              onAngleChange={(value) => updateStyle({ fieldBackgroundAngleDark: value })}
              onRadialStopAChange={(value) => updateStyle({ fieldBackgroundStopADark: value })}
              onRadialStopBChange={(value) => updateStyle({ fieldBackgroundStopBDark: value })}
              onChange={(value) => updateStyle({ fieldBgDark: value })}
            />
            <TildaInlineColorField compact label="Обводка полей" value={color("fieldBorderColorDark", color("cardBorderColorDark", activeTheme.darkPalette.borderColor))} placeholder={activeTheme.darkPalette.borderColor} onChange={(value) => updateStyle({ fieldBorderColorDark: value })} onClear={() => updateStyle({ fieldBorderColorDark: "transparent" })} />
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
