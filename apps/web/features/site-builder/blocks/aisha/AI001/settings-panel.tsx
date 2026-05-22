import { useState } from "react";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import { TildaInlineColorField } from "@/features/site-builder/crm/site-editor-panels";
import type { CrmPanelCtx } from "../../runtime/contracts";
import {
  DarkThemeToggle,
  SectionButton,
  flatNumber,
  flatPercentSelect,
  rawStyle,
  readRawString,
  updateData,
  updateStyle,
} from "../../runtime/ui/flat-placeholder-panels";

export function AI001SettingsPanel(ctx: CrmPanelCtx) {
  const [showDarkTheme, setShowDarkTheme] = useState(false);
  const raw = rawStyle(ctx);
  const panelBorder = ctx.panelTheme.border;
  const panelText = ctx.panelTheme.text;
  const panelMuted = ctx.panelTheme.muted;
  const lightBackdropColor = readRawString(ctx, "aishaBackdropColorLight", "transparent");
  const darkBackdropColor = readRawString(ctx, "aishaBackdropColorDark", lightBackdropColor);
  const lightBackdropOpacity = Number.isFinite(Number(raw.aishaBackdropOpacityLight))
    ? Math.max(0, Math.min(100, Math.round(Number(raw.aishaBackdropOpacityLight))))
    : 50;
  const darkBackdropOpacity = Number.isFinite(Number(raw.aishaBackdropOpacityDark))
    ? Math.max(0, Math.min(100, Math.round(Number(raw.aishaBackdropOpacityDark))))
    : lightBackdropOpacity;
  const data = ctx.block.data as Record<string, unknown>;
  const offsetBottom = Number.isFinite(Number(data.offsetBottomPx))
    ? Math.max(0, Math.min(160, Math.round(Number(data.offsetBottomPx))))
    : 16;
  const offsetRight = Number.isFinite(Number(data.offsetRightPx))
    ? Math.max(0, Math.min(240, Math.round(Number(data.offsetRightPx))))
    : 16;

  return (
    <div className="space-y-6 px-1 pb-8 pt-1">
      <FlatCheckbox
        checked={data.enabled !== false}
        onChange={(checked) => updateData(ctx, { enabled: checked })}
        label="Показывать виджет на сайте"
      />

      <div className="space-y-3">
        {ctx.currentPanelSections.some((section) => section.id === "widget") && (
          <SectionButton id="widget" label="Виджет" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "messages") && (
          <SectionButton id="messages" label="Сообщения" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "button" || section.id === "buttons") && (
          <SectionButton id="buttons" label="Кнопки" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "animation") && (
          <SectionButton id="animation" label="Анимация" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {flatNumber("Отступ виджета снизу", offsetBottom, (value) => updateData(ctx, { offsetBottomPx: value }), 0, 160, "px")}
        {flatNumber("Отступ виджета справа", offsetRight, (value) => updateData(ctx, { offsetRightPx: value }), 0, 240, "px")}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TildaInlineColorField
          compact
          label="Затемнение"
          value={lightBackdropColor}
          placeholder=""
          onChange={(value) => updateStyle(ctx, { aishaBackdropColorLight: value })}
          onClear={() => updateStyle(ctx, { aishaBackdropColorLight: "transparent" })}
        />
        {flatPercentSelect("Непрозрачность", lightBackdropOpacity, (value) => updateStyle(ctx, { aishaBackdropOpacityLight: value }))}
      </div>

      <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
      {showDarkTheme ? (
        <div className="grid grid-cols-2 gap-4">
          <TildaInlineColorField
            compact
            label="Затемнение"
            value={darkBackdropColor}
            placeholder=""
            onChange={(value) => updateStyle(ctx, { aishaBackdropColorDark: value })}
            onClear={() => updateStyle(ctx, { aishaBackdropColorDark: "transparent" })}
          />
          {flatPercentSelect("Непрозрачность", darkBackdropOpacity, (value) => updateStyle(ctx, { aishaBackdropOpacityDark: value }))}
        </div>
      ) : null}
    </div>
  );
}
