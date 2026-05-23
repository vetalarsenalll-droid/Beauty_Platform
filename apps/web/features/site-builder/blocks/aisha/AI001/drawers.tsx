import { useState } from "react";
import {
  FlatSelect,
  DarkThemeToggle,
  color,
  flatNumber,
  updateStyle,
} from "../../runtime/ui/flat-panel-helpers";
import { TildaInlineColorField } from "@/features/site-builder/crm/site-editor-panels";
import { normalizeBlockStyle, type BlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../../runtime/contracts";

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

const WIDGET_ANIMATION_OPTIONS = [
  { value: "none", label: "Без анимации" },
  { value: "pulse", label: "Пульсация" },
  { value: "shake", label: "Вибрация" },
  { value: "flip", label: "Переворот" },
];

const WIDGET_ANIMATION_DEFAULT_SPEED_MS: Record<NonNullable<BlockStyle["widgetAnimationType"]>, number> = {
  none: 2400,
  pulse: 3500,
  shake: 4000,
  flip: 8000,
};

export function AI001Drawers(ctx: CrmPanelCtx) {
  const [showDarkTheme, setShowDarkTheme] = useState(false);
  const style = normalizeBlockStyle(ctx.block, ctx.activeTheme);
  const section = ctx.activePanelSectionId;

  if (ctx.rightPanel !== "settings" || !section) return "";

  if (section === "widget") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Окно виджета</div>
          <TildaInlineColorField compact label="Фон окна" value={color(ctx, "blockBgLight", ctx.activeTheme.panelColor)} placeholder={ctx.activeTheme.panelColor} onChange={(value) => updateStyle(ctx, { blockBgLight: value, blockBg: value })} onClear={() => updateStyle(ctx, { blockBgLight: "transparent", blockBg: "transparent" })} />
          <TildaInlineColorField compact label="Основной текст" value={color(ctx, "textColorLight", ctx.activeTheme.textColor)} placeholder={ctx.activeTheme.textColor} onChange={(value) => updateStyle(ctx, { textColorLight: value, textColor: value })} onClear={() => updateStyle(ctx, { textColorLight: "transparent", textColor: "transparent" })} />
          <TildaInlineColorField compact label="Вторичный текст" value={color(ctx, "mutedColorLight", ctx.activeTheme.mutedColor)} placeholder={ctx.activeTheme.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorLight: value, mutedColor: value })} onClear={() => updateStyle(ctx, { mutedColorLight: "transparent", mutedColor: "transparent" })} />
          <TildaInlineColorField compact label="Контур" value={color(ctx, "borderColorLight", ctx.activeTheme.borderColor)} placeholder={ctx.activeTheme.borderColor} onChange={(value) => updateStyle(ctx, { borderColorLight: value, borderColor: value })} onClear={() => updateStyle(ctx, { borderColorLight: "transparent", borderColor: "transparent" })} />
          {flatNumber("Скругление виджета", style.radius ?? 10, (value) => updateStyle(ctx, { radius: value }), 0, 36)}
          {flatNumber("Размер тени", style.shadowSize ?? 0, (value) => updateStyle(ctx, { shadowSize: value }), 0, 40)}
          <TildaInlineColorField compact label="Цвет тени" value={color(ctx, "shadowColor", ctx.activeTheme.shadowColor || "rgba(0,0,0,0.16)")} placeholder={ctx.activeTheme.shadowColor || "rgba(0,0,0,0.16)"} onChange={(value) => updateStyle(ctx, { shadowColor: value })} onClear={() => updateStyle(ctx, { shadowColor: "transparent" })} />
        </div>

        <div className="space-y-4 pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Шапка виджета</div>
          <TildaInlineColorField compact label="Фон шапки" value={color(ctx, "headerBgColorLight", ctx.activeTheme.panelColor)} placeholder={ctx.activeTheme.panelColor} onChange={(value) => updateStyle(ctx, { headerBgColorLight: value })} onClear={() => updateStyle(ctx, { headerBgColorLight: "transparent" })} />
          <TildaInlineColorField compact label="Текст шапки" value={color(ctx, "headerTextColorLight", ctx.activeTheme.textColor)} placeholder={ctx.activeTheme.textColor} onChange={(value) => updateStyle(ctx, { headerTextColorLight: value })} onClear={() => updateStyle(ctx, { headerTextColorLight: "transparent" })} />
          {flatNumber("Размер шрифта", style.headingSize ?? 14, (value) => updateStyle(ctx, { headingSize: value }), 10, 48)}
          <FlatSelect label="Шрифт" value={style.fontHeading || ctx.activeTheme.fontHeading || "Manrope"} options={FONT_OPTIONS} onChange={(value) => updateStyle(ctx, { fontHeading: value })} />
          <FlatSelect label="Насыщенность" value={String(style.fontWeightHeading ?? "")} options={WEIGHT_OPTIONS} onChange={(value) => updateStyle(ctx, { fontWeightHeading: value ? Number(value) : null })} />
        </div>

        <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
        {showDarkTheme ? (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Фон окна" value={color(ctx, "blockBgDark", ctx.activeTheme.darkPalette.panelColor)} placeholder={ctx.activeTheme.darkPalette.panelColor} onChange={(value) => updateStyle(ctx, { blockBgDark: value })} onClear={() => updateStyle(ctx, { blockBgDark: "transparent" })} />
            <TildaInlineColorField compact label="Основной текст" value={color(ctx, "textColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { textColorDark: value })} onClear={() => updateStyle(ctx, { textColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Вторичный текст" value={color(ctx, "mutedColorDark", ctx.activeTheme.darkPalette.mutedColor)} placeholder={ctx.activeTheme.darkPalette.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorDark: value })} onClear={() => updateStyle(ctx, { mutedColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Контур" value={color(ctx, "borderColorDark", ctx.activeTheme.darkPalette.borderColor)} placeholder={ctx.activeTheme.darkPalette.borderColor} onChange={(value) => updateStyle(ctx, { borderColorDark: value })} onClear={() => updateStyle(ctx, { borderColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Фон шапки" value={color(ctx, "headerBgColorDark", ctx.activeTheme.darkPalette.panelColor)} placeholder={ctx.activeTheme.darkPalette.panelColor} onChange={(value) => updateStyle(ctx, { headerBgColorDark: value })} onClear={() => updateStyle(ctx, { headerBgColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст шапки" value={color(ctx, "headerTextColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { headerTextColorDark: value })} onClear={() => updateStyle(ctx, { headerTextColorDark: "transparent" })} />
          </div>
        ) : null}
      </div>
    );
  }

  if (section === "messages") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="space-y-4">
          {flatNumber("Скругление сообщений", style.messageRadius ?? 5, (value) => updateStyle(ctx, { messageRadius: value }), 0, 32)}
          <TildaInlineColorField compact label="Цвет ответа ассистента" value={color(ctx, "assistantBubbleColorLight", ctx.activeTheme.panelColor)} placeholder={ctx.activeTheme.panelColor} onChange={(value) => updateStyle(ctx, { assistantBubbleColorLight: value })} onClear={() => updateStyle(ctx, { assistantBubbleColorLight: "transparent" })} />
          <TildaInlineColorField compact label="Текст ассистента" value={color(ctx, "assistantTextColorLight", ctx.activeTheme.textColor)} placeholder={ctx.activeTheme.textColor} onChange={(value) => updateStyle(ctx, { assistantTextColorLight: value })} onClear={() => updateStyle(ctx, { assistantTextColorLight: "transparent" })} />
          <TildaInlineColorField compact label="Цвет сообщения клиента" value={color(ctx, "clientBubbleColorLight", ctx.activeTheme.buttonColor)} placeholder={ctx.activeTheme.buttonColor} onChange={(value) => updateStyle(ctx, { clientBubbleColorLight: value })} onClear={() => updateStyle(ctx, { clientBubbleColorLight: "transparent" })} />
          <TildaInlineColorField compact label="Текст клиента" value={color(ctx, "clientTextColorLight", ctx.activeTheme.buttonTextColor)} placeholder={ctx.activeTheme.buttonTextColor} onChange={(value) => updateStyle(ctx, { clientTextColorLight: value })} onClear={() => updateStyle(ctx, { clientTextColorLight: "transparent" })} />
        </div>

        <div className="space-y-4 pt-4">
          <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Поле ввода</div>
          <TildaInlineColorField compact label="Цвет поля ввода" value={color(ctx, "inputBgColorLight", "#fafafa")} placeholder="#fafafa" onChange={(value) => updateStyle(ctx, { inputBgColorLight: value, inputBgColor: value })} onClear={() => updateStyle(ctx, { inputBgColorLight: "#fafafa", inputBgColor: "#fafafa" })} />
          <TildaInlineColorField compact label="Цвет текста" value={color(ctx, "inputTextColorLight", ctx.activeTheme.textColor)} placeholder={ctx.activeTheme.textColor} onChange={(value) => updateStyle(ctx, { inputTextColorLight: value, inputTextColor: value })} onClear={() => updateStyle(ctx, { inputTextColorLight: "transparent", inputTextColor: "transparent" })} />
          <TildaInlineColorField compact label="Контур" value={color(ctx, "inputBorderColorLight", "#e5e7eb")} placeholder="#e5e7eb" onChange={(value) => updateStyle(ctx, { inputBorderColorLight: value, inputBorderColor: value })} onClear={() => updateStyle(ctx, { inputBorderColorLight: "#e5e7eb", inputBorderColor: "#e5e7eb" })} />
          {flatNumber("Скругление поля ввода", style.inputRadius ?? 25, (value) => updateStyle(ctx, { inputRadius: value }), 0, 36)}
          <TildaInlineColorField compact label="Цвет кнопки ввода" value={color(ctx, "inputSendButtonColorLight", ctx.activeTheme.buttonColor)} placeholder={ctx.activeTheme.buttonColor} onChange={(value) => updateStyle(ctx, { inputSendButtonColorLight: value, inputSendButtonColor: value })} onClear={() => updateStyle(ctx, { inputSendButtonColorLight: "transparent", inputSendButtonColor: "transparent" })} />
        </div>

        <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
        {showDarkTheme ? (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Цвет ответа ассистента" value={color(ctx, "assistantBubbleColorDark", ctx.activeTheme.darkPalette.panelColor)} placeholder={ctx.activeTheme.darkPalette.panelColor} onChange={(value) => updateStyle(ctx, { assistantBubbleColorDark: value })} onClear={() => updateStyle(ctx, { assistantBubbleColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст ассистента" value={color(ctx, "assistantTextColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { assistantTextColorDark: value })} onClear={() => updateStyle(ctx, { assistantTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Цвет сообщения клиента" value={color(ctx, "clientBubbleColorDark", ctx.activeTheme.darkPalette.buttonColor)} placeholder={ctx.activeTheme.darkPalette.buttonColor} onChange={(value) => updateStyle(ctx, { clientBubbleColorDark: value })} onClear={() => updateStyle(ctx, { clientBubbleColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст клиента" value={color(ctx, "clientTextColorDark", ctx.activeTheme.darkPalette.buttonTextColor)} placeholder={ctx.activeTheme.darkPalette.buttonTextColor} onChange={(value) => updateStyle(ctx, { clientTextColorDark: value })} onClear={() => updateStyle(ctx, { clientTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Цвет поля ввода" value={color(ctx, "inputBgColorDark", "transparent")} placeholder="transparent" onChange={(value) => updateStyle(ctx, { inputBgColorDark: value })} onClear={() => updateStyle(ctx, { inputBgColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Цвет текста поля" value={color(ctx, "inputTextColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { inputTextColorDark: value })} onClear={() => updateStyle(ctx, { inputTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Контур поля ввода" value={color(ctx, "inputBorderColorDark", "transparent")} placeholder="transparent" onChange={(value) => updateStyle(ctx, { inputBorderColorDark: value })} onClear={() => updateStyle(ctx, { inputBorderColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Цвет кнопки ввода" value={color(ctx, "inputSendButtonColorDark", ctx.activeTheme.darkPalette.buttonColor)} placeholder={ctx.activeTheme.darkPalette.buttonColor} onChange={(value) => updateStyle(ctx, { inputSendButtonColorDark: value })} onClear={() => updateStyle(ctx, { inputSendButtonColorDark: "transparent" })} />
          </div>
        ) : null}
      </div>
    );
  }

  if (section === "buttons") {
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="space-y-4">
          {flatNumber("Скругление кнопки виджета", style.buttonRadius ?? 5, (value) => updateStyle(ctx, { buttonRadius: value }), 0, 36)}
          {flatNumber("Скругление кнопок ответов", style.quickReplyRadius ?? 5, (value) => updateStyle(ctx, { quickReplyRadius: value }), 0, 36)}
          <TildaInlineColorField compact label="Фон кнопки виджета" value={color(ctx, "buttonColorLight", ctx.activeTheme.buttonColor)} placeholder={ctx.activeTheme.buttonColor} onChange={(value) => updateStyle(ctx, { buttonColorLight: value, buttonColor: value })} onClear={() => updateStyle(ctx, { buttonColorLight: "transparent", buttonColor: "transparent" })} />
          <TildaInlineColorField compact label="Текст кнопки виджета" value={color(ctx, "buttonTextColorLight", ctx.activeTheme.buttonTextColor)} placeholder={ctx.activeTheme.buttonTextColor} onChange={(value) => updateStyle(ctx, { buttonTextColorLight: value, buttonTextColor: value })} onClear={() => updateStyle(ctx, { buttonTextColorLight: "transparent", buttonTextColor: "transparent" })} />
          {flatNumber("Размер шрифта", style.widgetButtonTextSize ?? 14, (value) => updateStyle(ctx, { widgetButtonTextSize: value }), 10, 48)}
          <FlatSelect label="Шрифт" value={style.widgetButtonTextFont || style.fontBody || ctx.activeTheme.fontBody || "Manrope"} options={FONT_OPTIONS} onChange={(value) => updateStyle(ctx, { widgetButtonTextFont: value })} />
          <FlatSelect label="Насыщенность" value={String(style.widgetButtonTextWeight ?? "")} options={WEIGHT_OPTIONS} onChange={(value) => updateStyle(ctx, { widgetButtonTextWeight: value ? Number(value) : null })} />
          <TildaInlineColorField compact label="Фон кнопок вариантов" value={color(ctx, "quickReplyButtonColorLight", ctx.activeTheme.buttonColor)} placeholder={ctx.activeTheme.buttonColor} onChange={(value) => updateStyle(ctx, { quickReplyButtonColorLight: value })} onClear={() => updateStyle(ctx, { quickReplyButtonColorLight: "transparent" })} />
          <TildaInlineColorField compact label="Текст кнопок вариантов" value={color(ctx, "quickReplyTextColorLight", ctx.activeTheme.buttonTextColor)} placeholder={ctx.activeTheme.buttonTextColor} onChange={(value) => updateStyle(ctx, { quickReplyTextColorLight: value })} onClear={() => updateStyle(ctx, { quickReplyTextColorLight: "transparent" })} />
        </div>

        <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
        {showDarkTheme ? (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Фон кнопки виджета" value={color(ctx, "buttonColorDark", ctx.activeTheme.darkPalette.buttonColor)} placeholder={ctx.activeTheme.darkPalette.buttonColor} onChange={(value) => updateStyle(ctx, { buttonColorDark: value })} onClear={() => updateStyle(ctx, { buttonColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст кнопки виджета" value={color(ctx, "buttonTextColorDark", ctx.activeTheme.darkPalette.buttonTextColor)} placeholder={ctx.activeTheme.darkPalette.buttonTextColor} onChange={(value) => updateStyle(ctx, { buttonTextColorDark: value })} onClear={() => updateStyle(ctx, { buttonTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Фон кнопок вариантов" value={color(ctx, "quickReplyButtonColorDark", ctx.activeTheme.darkPalette.buttonColor)} placeholder={ctx.activeTheme.darkPalette.buttonColor} onChange={(value) => updateStyle(ctx, { quickReplyButtonColorDark: value })} onClear={() => updateStyle(ctx, { quickReplyButtonColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст кнопок вариантов" value={color(ctx, "quickReplyTextColorDark", ctx.activeTheme.darkPalette.buttonTextColor)} placeholder={ctx.activeTheme.darkPalette.buttonTextColor} onChange={(value) => updateStyle(ctx, { quickReplyTextColorDark: value })} onClear={() => updateStyle(ctx, { quickReplyTextColorDark: "transparent" })} />
          </div>
        ) : null}
      </div>
    );
  }

  if (section === "animation") {
    const animationType =
      style.widgetAnimationType === "pulse" || style.widgetAnimationType === "shake" || style.widgetAnimationType === "flip"
        ? style.widgetAnimationType
        : "none";
    return (
      <div className="space-y-6 px-1 pb-8 pt-1">
        <div className="space-y-4">
          <FlatSelect
            label="Анимация кнопки"
            value={animationType}
            options={WIDGET_ANIMATION_OPTIONS}
            onChange={(value) => {
              const nextAnimationType = value as NonNullable<BlockStyle["widgetAnimationType"]>;
              updateStyle(ctx, {
                widgetAnimationType: nextAnimationType,
                widgetAnimationSpeedMs: WIDGET_ANIMATION_DEFAULT_SPEED_MS[nextAnimationType],
              });
            }}
          />
          {flatNumber("Скорость анимации, мс", style.widgetAnimationSpeedMs ?? 2400, (value) => updateStyle(ctx, { widgetAnimationSpeedMs: value }), 600, 8000)}
        </div>
      </div>
    );
  }

  return "";
}
