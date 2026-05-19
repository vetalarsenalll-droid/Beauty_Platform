import { useState } from "react";
import type { ReactNode } from "react";
import { TildaInlineColorField } from "@/features/site-builder/crm/site-editor-panels";
import { renderCoverFlatNumberInput, renderCoverFlatTextInput } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../../runtime/contracts";
import { readNumber, readString, updateLoginStyle } from "./settings-panel";

function readStyle(ctx: CrmPanelCtx) {
  const data = ctx.block.data as Record<string, unknown>;
  return data.style && typeof data.style === "object" ? (data.style as Record<string, unknown>) : {};
}

function group(title: string, children: ReactNode) {
  return (
    <div className="space-y-4 pb-5">
      <div className="text-sm font-semibold text-[color:var(--bp-ink)]">{title}</div>
      {children}
    </div>
  );
}

function darkToggle(open: boolean, setOpen: (next: boolean) => void, ctx: CrmPanelCtx) {
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="flex w-full items-center justify-between border-b px-0 py-2 text-left text-sm transition"
      style={{
        borderColor: open ? "#ff5a5f" : ctx.panelTheme.border,
        color: open ? ctx.panelTheme.text : ctx.panelTheme.muted,
      }}
    >
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
        </svg>
        <span>Темная тема</span>
      </span>
      <span>{open ? "▴" : "▾"}</span>
    </button>
  );
}

export function ClientLoginSettingsDrawer(ctx: CrmPanelCtx) {
  const [darkOpen, setDarkOpen] = useState(false);
  const style = readStyle(ctx);
  if (ctx.rightPanel !== "settings" || (ctx.activePanelSectionId !== "typography" && ctx.activePanelSectionId !== "button")) return null;

  if (ctx.activePanelSectionId === "typography") {
    return (
      <div className="space-y-5 px-5 py-5" onClick={(event) => event.stopPropagation()}>
        {group("Левая панель", (
          <>
            {renderCoverFlatNumberInput("Размер заголовка", readNumber(style, "authTitleSize", 32), 0, 96, (value) => updateLoginStyle(ctx, { authTitleSize: value }))}
            {renderCoverFlatNumberInput("Размер описания", readNumber(style, "authTextSize", 14), 0, 48, (value) => updateLoginStyle(ctx, { authTextSize: value }))}
            <TildaInlineColorField compact label="Цвет текста" value={readString(style, "authSideTextColor", "#ffffff")} onChange={(value) => updateLoginStyle(ctx, { authSideTextColor: value })} />
            <TildaInlineColorField compact label="Цвет вторичного текста" value={readString(style, "authSideMutedColor", "rgba(255,255,255,0.8)")} onChange={(value) => updateLoginStyle(ctx, { authSideMutedColor: value })} />
          </>
        ))}
        {group("Правая панель", (
          <>
            {renderCoverFlatNumberInput("Размер заголовка формы", readNumber(style, "authFormTitleSize", 24), 0, 72, (value) => updateLoginStyle(ctx, { authFormTitleSize: value }))}
            {renderCoverFlatNumberInput("Размер текста формы", readNumber(style, "authFormTextSize", 14), 0, 48, (value) => updateLoginStyle(ctx, { authFormTextSize: value }))}
            <TildaInlineColorField compact label="Цвет текста формы" value={readString(style, "authRightTextColor", "#111827")} onChange={(value) => updateLoginStyle(ctx, { authRightTextColor: value })} />
            <TildaInlineColorField compact label="Цвет вторичного текста" value={readString(style, "authRightMutedColor", "#6b7280")} onChange={(value) => updateLoginStyle(ctx, { authRightMutedColor: value })} />
          </>
        ))}
        {darkToggle(darkOpen, setDarkOpen, ctx)}
        {darkOpen ? (
          <>
            <TildaInlineColorField compact label="Левая панель: цвет текста" value={readString(style, "authSideTextColorDark", readString(style, "authSideTextColor", "#ffffff"))} onChange={(value) => updateLoginStyle(ctx, { authSideTextColorDark: value })} />
            <TildaInlineColorField compact label="Левая панель: вторичный текст" value={readString(style, "authSideMutedColorDark", readString(style, "authSideMutedColor", "rgba(255,255,255,0.8)"))} onChange={(value) => updateLoginStyle(ctx, { authSideMutedColorDark: value })} />
            <TildaInlineColorField compact label="Правая панель: цвет текста" value={readString(style, "authRightTextColorDark", "#f8fafc")} onChange={(value) => updateLoginStyle(ctx, { authRightTextColorDark: value })} />
            <TildaInlineColorField compact label="Правая панель: вторичный текст" value={readString(style, "authRightMutedColorDark", "#aeb4bf")} onChange={(value) => updateLoginStyle(ctx, { authRightMutedColorDark: value })} />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 px-5 py-5" onClick={(event) => event.stopPropagation()}>
      {group("Основная кнопка входа", (
        <>
          {renderCoverFlatTextInput("Текст кнопки", String((ctx.block.data as Record<string, unknown>).loginButtonText ?? "Войти"), (value) =>
            ctx.updateBlock(ctx.block.id, (prev) => ({ ...prev, data: { ...(prev.data as Record<string, unknown>), loginButtonText: value, clientView: "login" } }))
          )}
          <TildaInlineColorField compact label="Цвет кнопки" value={readString(style, "authButtonColor", "#111827")} onChange={(value) => updateLoginStyle(ctx, { authButtonColor: value })} />
          <TildaInlineColorField compact label="Текст кнопки" value={readString(style, "authButtonTextColor", "#ffffff")} onChange={(value) => updateLoginStyle(ctx, { authButtonTextColor: value })} />
          <TildaInlineColorField compact label="Контур кнопки" value={readString(style, "authButtonBorderColor", "transparent")} onChange={(value) => updateLoginStyle(ctx, { authButtonBorderColor: value })} onClear={() => updateLoginStyle(ctx, { authButtonBorderColor: "transparent" })} />
          {renderCoverFlatNumberInput("Скругление кнопки и полей", readNumber(style, "authButtonRadius", 0), 0, 64, (value) => updateLoginStyle(ctx, { authButtonRadius: value }))}
          {renderCoverFlatNumberInput("Размер текста кнопки", readNumber(style, "authButtonTextSize", 14), 0, 32, (value) => updateLoginStyle(ctx, { authButtonTextSize: value }))}
          <TildaInlineColorField compact label="Цвет фона при наведении" value={readString(style, "authButtonHoverBgColor", "")} onChange={(value) => updateLoginStyle(ctx, { authButtonHoverBgColor: value })} onClear={() => updateLoginStyle(ctx, { authButtonHoverBgColor: "" })} />
        </>
      ))}
      {group("Telegram / VK ID / Яндекс ID / MAX ID", (
        <>
          <TildaInlineColorField compact label="Цвет соц-кнопок" value={readString(style, "authSocialButtonColor", "#ffffff")} onChange={(value) => updateLoginStyle(ctx, { authSocialButtonColor: value })} />
          <TildaInlineColorField compact label="Текст соц-кнопок" value={readString(style, "authSocialButtonTextColor", "#111827")} onChange={(value) => updateLoginStyle(ctx, { authSocialButtonTextColor: value })} />
          <TildaInlineColorField compact label="Обводка соц-кнопок" value={readString(style, "authSocialButtonBorderColor", "#e5e7eb")} onChange={(value) => updateLoginStyle(ctx, { authSocialButtonBorderColor: value })} />
          {renderCoverFlatNumberInput("Скругление соц-кнопок", readNumber(style, "authSocialButtonRadius", readNumber(style, "authButtonRadius", 0)), 0, 64, (value) => updateLoginStyle(ctx, { authSocialButtonRadius: value }))}
          {renderCoverFlatNumberInput("Размер текста соц-кнопок", readNumber(style, "authSocialButtonTextSize", 14), 0, 32, (value) => updateLoginStyle(ctx, { authSocialButtonTextSize: value }))}
          <TildaInlineColorField compact label="Цвет фона при наведении" value={readString(style, "authSocialButtonHoverBgColor", "")} onChange={(value) => updateLoginStyle(ctx, { authSocialButtonHoverBgColor: value })} onClear={() => updateLoginStyle(ctx, { authSocialButtonHoverBgColor: "" })} />
        </>
      ))}
      {darkToggle(darkOpen, setDarkOpen, ctx)}
      {darkOpen ? (
        <>
          <TildaInlineColorField compact label="Цвет кнопки" value={readString(style, "authButtonColorDark", "#f8fafc")} onChange={(value) => updateLoginStyle(ctx, { authButtonColorDark: value })} />
          <TildaInlineColorField compact label="Текст кнопки" value={readString(style, "authButtonTextColorDark", "#111827")} onChange={(value) => updateLoginStyle(ctx, { authButtonTextColorDark: value })} />
          <TildaInlineColorField compact label="Цвет соц-кнопок" value={readString(style, "authSocialButtonColorDark", "#20242d")} onChange={(value) => updateLoginStyle(ctx, { authSocialButtonColorDark: value })} />
          <TildaInlineColorField compact label="Текст соц-кнопок" value={readString(style, "authSocialButtonTextColorDark", "#f8fafc")} onChange={(value) => updateLoginStyle(ctx, { authSocialButtonTextColorDark: value })} />
          <TildaInlineColorField compact label="Обводка соц-кнопок" value={readString(style, "authSocialButtonBorderColorDark", "#343a46")} onChange={(value) => updateLoginStyle(ctx, { authSocialButtonBorderColorDark: value })} />
        </>
      ) : null}
    </div>
  );
}
