import { useState } from "react";
import type { ReactNode } from "react";
import { TildaInlineColorField } from "@/features/site-builder/crm/site-editor-panels";
import { renderCoverFlatNumberInput } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../../runtime/contracts";
import { readNumber, readString, updateCabinetStyle } from "./settings-panel";

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
      style={{ borderColor: open ? "var(--bp-save-close,var(--bp-accent))" : ctx.panelTheme.border, color: open ? ctx.panelTheme.text : ctx.panelTheme.muted }}
    >
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" /></svg>
        <span>Темная тема</span>
      </span>
      <span>{open ? "▴" : "▾"}</span>
    </button>
  );
}

export function ClientCabinetSettingsDrawer(ctx: CrmPanelCtx) {
  const [darkOpen, setDarkOpen] = useState(false);
  const style = readStyle(ctx);
  if (ctx.rightPanel !== "settings" || (ctx.activePanelSectionId !== "typography" && ctx.activePanelSectionId !== "button")) return null;

  if (ctx.activePanelSectionId === "typography") {
    return (
      <div className="space-y-5 px-5 py-5" onClick={(event) => event.stopPropagation()}>
        {group("Кабинет", (
          <>
            {renderCoverFlatNumberInput("Размер заголовка", readNumber(style, "cabinetTitleSize", 32), 0, 96, (value) => updateCabinetStyle(ctx, { cabinetTitleSize: value }))}
            {renderCoverFlatNumberInput("Размер текста", readNumber(style, "cabinetTextSize", 14), 0, 48, (value) => updateCabinetStyle(ctx, { cabinetTextSize: value }))}
            <TildaInlineColorField compact label="Цвет текста" value={readString(style, "cabinetTextColor", "#111827")} onChange={(value) => updateCabinetStyle(ctx, { cabinetTextColor: value })} />
            <TildaInlineColorField compact label="Цвет вторичного текста" value={readString(style, "cabinetMutedColor", "#6b7280")} onChange={(value) => updateCabinetStyle(ctx, { cabinetMutedColor: value })} />
          </>
        ))}
        {darkToggle(darkOpen, setDarkOpen, ctx)}
        {darkOpen ? (
          <>
            <TildaInlineColorField compact label="Цвет текста" value={readString(style, "cabinetTextColorDark", "#f8fafc")} onChange={(value) => updateCabinetStyle(ctx, { cabinetTextColorDark: value })} />
            <TildaInlineColorField compact label="Цвет вторичного текста" value={readString(style, "cabinetMutedColorDark", "#aeb4bf")} onChange={(value) => updateCabinetStyle(ctx, { cabinetMutedColorDark: value })} />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 px-5 py-5" onClick={(event) => event.stopPropagation()}>
      {group("Кнопки кабинета", (
        <>
          <TildaInlineColorField compact label="Цвет кнопки" value={readString(style, "cabinetButtonColor", "#111827")} onChange={(value) => updateCabinetStyle(ctx, { cabinetButtonColor: value })} />
          <TildaInlineColorField compact label="Текст кнопки" value={readString(style, "cabinetButtonTextColor", "#ffffff")} onChange={(value) => updateCabinetStyle(ctx, { cabinetButtonTextColor: value })} />
          <TildaInlineColorField compact label="Цвет вторичной кнопки" value={readString(style, "cabinetSecondaryButtonColor", "#ffffff")} onChange={(value) => updateCabinetStyle(ctx, { cabinetSecondaryButtonColor: value })} />
          <TildaInlineColorField compact label="Текст вторичной кнопки" value={readString(style, "cabinetSecondaryButtonTextColor", "#111827")} onChange={(value) => updateCabinetStyle(ctx, { cabinetSecondaryButtonTextColor: value })} />
          {renderCoverFlatNumberInput("Скругление кнопок", readNumber(style, "cabinetButtonRadius", 16), 0, 64, (value) => updateCabinetStyle(ctx, { cabinetButtonRadius: value }))}
          {renderCoverFlatNumberInput("Размер текста кнопок", readNumber(style, "cabinetButtonTextSize", 14), 0, 32, (value) => updateCabinetStyle(ctx, { cabinetButtonTextSize: value }))}
        </>
      ))}
      {darkToggle(darkOpen, setDarkOpen, ctx)}
      {darkOpen ? (
        <>
          <TildaInlineColorField compact label="Цвет кнопки" value={readString(style, "cabinetButtonColorDark", "#f8fafc")} onChange={(value) => updateCabinetStyle(ctx, { cabinetButtonColorDark: value })} />
          <TildaInlineColorField compact label="Текст кнопки" value={readString(style, "cabinetButtonTextColorDark", "#111827")} onChange={(value) => updateCabinetStyle(ctx, { cabinetButtonTextColorDark: value })} />
          <TildaInlineColorField compact label="Цвет вторичной кнопки" value={readString(style, "cabinetSecondaryButtonColorDark", "#20242d")} onChange={(value) => updateCabinetStyle(ctx, { cabinetSecondaryButtonColorDark: value })} />
          <TildaInlineColorField compact label="Текст вторичной кнопки" value={readString(style, "cabinetSecondaryButtonTextColorDark", "#f8fafc")} onChange={(value) => updateCabinetStyle(ctx, { cabinetSecondaryButtonTextColorDark: value })} />
        </>
      ) : null}
    </div>
  );
}
