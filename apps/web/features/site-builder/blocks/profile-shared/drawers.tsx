import { useState } from "react";
import { TildaInlineColorField } from "@/features/site-builder/crm/site-editor-panels";
import { normalizeBlockStyle } from "@/features/site-builder/crm/site-renderer";
import { RatingSettingsPanel } from "@/features/site-builder/blocks/rating-settings-panel";
import type { CrmPanelCtx } from "../runtime/contracts";
import {
  DarkThemeToggle,
  FlatSelect,
  color,
  flatNumber,
  updateStyle,
} from "../runtime/ui/flat-panel-helpers";

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

export function ProfileDrawers(ctx: CrmPanelCtx) {
  const [showDarkTheme, setShowDarkTheme] = useState(false);
  const style = normalizeBlockStyle(ctx.block, ctx.activeTheme);
  const section = ctx.activePanelSectionId;
  if (ctx.rightPanel !== "settings") return "";
  if (!section) return "";

  if (section === "typography") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Заголовок</div>
          <TildaInlineColorField compact label="Цвет" value={color(ctx, "textColorLight", ctx.activeTheme.textColor)} placeholder={ctx.activeTheme.textColor} onChange={(value) => updateStyle(ctx, { textColorLight: value, textColor: value })} onClear={() => updateStyle(ctx, { textColorLight: "transparent", textColor: "transparent" })} />
          {flatNumber("Размер шрифта", style.headingSize ?? ctx.activeTheme.headingSize ?? 32, (value) => updateStyle(ctx, { headingSize: value }), 10, 96)}
          <FlatSelect label="Шрифт" value={style.fontHeading || ctx.activeTheme.fontHeading || "Manrope"} options={FONT_OPTIONS} onChange={(value) => updateStyle(ctx, { fontHeading: value })} />
          <FlatSelect label="Насыщенность" value={String(style.fontWeightHeading ?? "")} options={WEIGHT_OPTIONS} onChange={(value) => updateStyle(ctx, { fontWeightHeading: value ? Number(value) : null })} />
        </div>

        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Подзаголовок</div>
          <TildaInlineColorField compact label="Цвет" value={color(ctx, "mutedColorLight", ctx.activeTheme.mutedColor)} placeholder={ctx.activeTheme.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorLight: value, mutedColor: value })} onClear={() => updateStyle(ctx, { mutedColorLight: "transparent", mutedColor: "transparent" })} />
          {flatNumber("Размер шрифта", style.subheadingSize ?? ctx.activeTheme.subheadingSize ?? 18, (value) => updateStyle(ctx, { subheadingSize: value }), 10, 64)}
          <FlatSelect label="Шрифт" value={style.fontSubheading || style.fontBody || ctx.activeTheme.fontBody || "Manrope"} options={FONT_OPTIONS} onChange={(value) => updateStyle(ctx, { fontSubheading: value })} />
          <FlatSelect label="Насыщенность" value={String(style.fontWeightSubheading ?? "")} options={WEIGHT_OPTIONS} onChange={(value) => updateStyle(ctx, { fontWeightSubheading: value ? Number(value) : null })} />
        </div>

        <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Основной текст</div>
          {flatNumber("Размер шрифта", style.textSize ?? ctx.activeTheme.textSize ?? 16, (value) => updateStyle(ctx, { textSize: value }), 10, 48)}
          <FlatSelect label="Шрифт" value={style.fontBody || ctx.activeTheme.fontBody || "Manrope"} options={FONT_OPTIONS} onChange={(value) => updateStyle(ctx, { fontBody: value })} />
          <FlatSelect label="Насыщенность" value={String(style.fontWeightBody ?? "")} options={WEIGHT_OPTIONS} onChange={(value) => updateStyle(ctx, { fontWeightBody: value ? Number(value) : null })} />
        </div>

        <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
        {showDarkTheme && (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Основной текст" value={color(ctx, "textColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { textColorDark: value })} onClear={() => updateStyle(ctx, { textColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Вторичный текст" value={color(ctx, "mutedColorDark", ctx.activeTheme.darkPalette.mutedColor)} placeholder={ctx.activeTheme.darkPalette.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorDark: value })} onClear={() => updateStyle(ctx, { mutedColorDark: "transparent" })} />
          </div>
        )}
      </div>
    );
  }

  if (section === "colors") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <TildaInlineColorField compact label="Основной текст" value={color(ctx, "textColorLight", ctx.activeTheme.textColor)} placeholder={ctx.activeTheme.textColor} onChange={(value) => updateStyle(ctx, { textColorLight: value, textColor: value })} onClear={() => updateStyle(ctx, { textColorLight: "transparent", textColor: "transparent" })} />
        <TildaInlineColorField compact label="Вторичный текст" value={color(ctx, "mutedColorLight", ctx.activeTheme.mutedColor)} placeholder={ctx.activeTheme.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorLight: value, mutedColor: value })} onClear={() => updateStyle(ctx, { mutedColorLight: "transparent", mutedColor: "transparent" })} />
        <TildaInlineColorField compact label="Обводка" value={color(ctx, "borderColorLight", ctx.activeTheme.borderColor)} placeholder={ctx.activeTheme.borderColor} onChange={(value) => updateStyle(ctx, { borderColorLight: value, borderColor: value })} onClear={() => updateStyle(ctx, { borderColorLight: "transparent", borderColor: "transparent" })} />
        <TildaInlineColorField compact label="Фон карточек" value={color(ctx, "cardBgLight", style.subBlockBgLight || "#ffffff")} placeholder="#ffffff" onChange={(value) => updateStyle(ctx, { cardBgLight: value, subBlockBgLight: value, subBlockBg: value })} onClear={() => updateStyle(ctx, { cardBgLight: "transparent", subBlockBgLight: "transparent" })} />
        <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
        {showDarkTheme && (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Основной текст" value={color(ctx, "textColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { textColorDark: value })} onClear={() => updateStyle(ctx, { textColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Вторичный текст" value={color(ctx, "mutedColorDark", ctx.activeTheme.darkPalette.mutedColor)} placeholder={ctx.activeTheme.darkPalette.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorDark: value })} onClear={() => updateStyle(ctx, { mutedColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Обводка" value={color(ctx, "borderColorDark", ctx.activeTheme.darkPalette.borderColor)} placeholder={ctx.activeTheme.darkPalette.borderColor} onChange={(value) => updateStyle(ctx, { borderColorDark: value })} onClear={() => updateStyle(ctx, { borderColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Фон карточек" value={color(ctx, "cardBgDark", style.subBlockBgDark || "#16181d")} placeholder="#16181d" onChange={(value) => updateStyle(ctx, { cardBgDark: value, subBlockBgDark: value })} onClear={() => updateStyle(ctx, { cardBgDark: "transparent" })} />
          </div>
        )}
      </div>
    );
  }

  if (section === "button" || section === "buttons") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        {flatNumber("Радиус кнопки", style.buttonRadius ?? ctx.activeTheme.buttonRadius ?? 0, (value) => updateStyle(ctx, { buttonRadius: value }), 0, 80)}
        <TildaInlineColorField compact label="Фон кнопки" value={color(ctx, "buttonColorLight", ctx.activeTheme.buttonColor)} placeholder={ctx.activeTheme.buttonColor} onChange={(value) => updateStyle(ctx, { buttonColorLight: value, buttonColor: value })} onClear={() => updateStyle(ctx, { buttonColorLight: "transparent", buttonColor: "transparent" })} />
        <TildaInlineColorField compact label="Текст кнопки" value={color(ctx, "buttonTextColorLight", ctx.activeTheme.buttonTextColor)} placeholder={ctx.activeTheme.buttonTextColor} onChange={(value) => updateStyle(ctx, { buttonTextColorLight: value, buttonTextColor: value })} onClear={() => updateStyle(ctx, { buttonTextColorLight: "transparent", buttonTextColor: "transparent" })} />
        <TildaInlineColorField compact label="Обводка кнопки" value={color(ctx, "primaryButtonBorderColorLight", "transparent")} placeholder="transparent" onChange={(value) => updateStyle(ctx, { primaryButtonBorderColorLight: value })} onClear={() => updateStyle(ctx, { primaryButtonBorderColorLight: "transparent" })} />
        <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
        {showDarkTheme && (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Фон кнопки" value={color(ctx, "buttonColorDark", ctx.activeTheme.darkPalette.buttonColor)} placeholder={ctx.activeTheme.darkPalette.buttonColor} onChange={(value) => updateStyle(ctx, { buttonColorDark: value })} onClear={() => updateStyle(ctx, { buttonColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст кнопки" value={color(ctx, "buttonTextColorDark", ctx.activeTheme.darkPalette.buttonTextColor)} placeholder={ctx.activeTheme.darkPalette.buttonTextColor} onChange={(value) => updateStyle(ctx, { buttonTextColorDark: value })} onClear={() => updateStyle(ctx, { buttonTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Обводка кнопки" value={color(ctx, "primaryButtonBorderColorDark", "transparent")} placeholder="transparent" onChange={(value) => updateStyle(ctx, { primaryButtonBorderColorDark: value })} onClear={() => updateStyle(ctx, { primaryButtonBorderColorDark: "transparent" })} />
          </div>
        )}
      </div>
    );
  }

  if (section === "reviews") {
    return <RatingSettingsPanel block={ctx.block} activeTheme={ctx.activeTheme} updateBlock={ctx.updateBlock} />;
  }

  return (
    <div className="px-1 pb-8 pt-1 text-sm text-[color:var(--bp-muted)]">
      Раздел настроек пока пуст.
    </div>
  );
}
