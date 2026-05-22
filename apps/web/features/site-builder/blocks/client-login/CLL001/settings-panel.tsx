import { useState } from "react";
import { TildaBackgroundColorField, CoverGridWidthControl } from "@/features/site-builder/crm/site-editor-panels";
import { renderCoverFlatNumberInput } from "@/features/site-builder/crm/cover-settings";
import {
  COVER_LINE_OPTIONS,
  COVER_LINE_STEP_PX,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  centeredGridRange,
  formatCoverLineLabel,
} from "@/features/site-builder/crm/site-client-core";
import type { CoverBackgroundMode } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../../runtime/contracts";

type StyleMap = Record<string, unknown>;

function readStyle(ctx: CrmPanelCtx): StyleMap {
  const data = ctx.block.data as Record<string, unknown>;
  return data.style && typeof data.style === "object" ? (data.style as StyleMap) : {};
}

export function readString(style: StyleMap, key: string, fallback: string) {
  const value = style[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function readNumber(style: StyleMap, key: string, fallback: number) {
  const value = Number(style[key]);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

export function updateLoginStyle(ctx: CrmPanelCtx, patch: StyleMap) {
  ctx.updateBlock(ctx.block.id, (prev) => {
    const data = prev.data as Record<string, unknown>;
    const style = data.style && typeof data.style === "object" ? (data.style as StyleMap) : {};
    return { ...prev, type: "clientLogin", data: { ...data, clientView: "login", style: { ...style, ...patch } } };
  });
}

function modeValue(style: StyleMap, key: string): CoverBackgroundMode {
  const value = style[key];
  return value === "linear" || value === "radial" ? value : "solid";
}

function lineSelect(label: string, value: number, onChange: (value: number) => void) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full appearance-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        >
          {COVER_LINE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatCoverLineLabel(option)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-[color:var(--bp-muted)]">▾</span>
      </div>
    </label>
  );
}

function BackgroundField({
  label,
  prefix,
  fallback,
  dark,
  style,
  ctx,
}: {
  label: string;
  prefix: string;
  fallback: string;
  dark?: boolean;
  style: StyleMap;
  ctx: CrmPanelCtx;
}) {
  const suffix = dark ? "Dark" : "Light";
  const legacyKey = dark ? `${prefix}Dark` : prefix;
  const modeKey = `${prefix}Mode${suffix}`;
  const fromKey = `${prefix}From${suffix}`;
  const toKey = `${prefix}To${suffix}`;
  const angleKey = `${prefix}Angle${suffix}`;
  const stopAKey = `${prefix}StopA${suffix}`;
  const stopBKey = `${prefix}StopB${suffix}`;
  const mode = modeValue(style, modeKey);
  const from = readString(style, fromKey, readString(style, legacyKey, fallback));
  const to = readString(style, toKey, from);
  const angle = readNumber(style, angleKey, 135);
  const stopA = readNumber(style, stopAKey, 0);
  const stopB = readNumber(style, stopBKey, 100);

  return (
    <TildaBackgroundColorField
      label={label}
      value={from}
      mode={mode}
      secondValue={to}
      angle={angle}
      radialStopA={stopA}
      radialStopB={stopB}
      placeholder={fallback}
      onModeChange={(value) => updateLoginStyle(ctx, { [modeKey]: value })}
      onSecondChange={(value) => updateLoginStyle(ctx, { [toKey]: value })}
      onAngleChange={(value) => updateLoginStyle(ctx, { [angleKey]: value })}
      onRadialStopAChange={(value) => updateLoginStyle(ctx, { [stopAKey]: value })}
      onRadialStopBChange={(value) => updateLoginStyle(ctx, { [stopBKey]: value })}
      onChange={(value) =>
        updateLoginStyle(ctx, {
          [legacyKey]: value,
          [fromKey]: value,
          [toKey]: mode === "solid" ? value : readString(style, toKey, value),
        })
      }
    />
  );
}

function drawerButton(id: string, label: string, ctx: CrmPanelCtx) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        ctx.setActivePanelSectionId((prev) => (prev === id ? null : id));
      }}
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
      style={{
        borderColor: ctx.activePanelSectionId === id ? ctx.panelTheme.accent : ctx.panelTheme.border,
        backgroundColor: ctx.panelTheme.panel,
        color: ctx.activePanelSectionId === id ? ctx.panelTheme.text : ctx.panelTheme.muted,
      }}
    >
      <span>{label}</span>
      <span className="text-xs">{ctx.activePanelSectionId === id ? "‹" : "›"}</span>
    </button>
  );
}

export function ClientLoginSettingsPanel(ctx: CrmPanelCtx) {
  const [darkOpen, setDarkOpen] = useState(false);
  const style = readStyle(ctx);
  const columns = Math.max(1, Math.min(MAX_BLOCK_COLUMNS, readNumber(style, "blockWidthColumns", 6)));
  const range = centeredGridRange(columns);
  const marginTopLines = Math.max(0, Math.min(7, Math.round((readNumber(style, "marginTop", 0) / COVER_LINE_STEP_PX) * 2) / 2));
  const marginBottomLines = Math.max(0, Math.min(7, Math.round((readNumber(style, "marginBottom", 0) / COVER_LINE_STEP_PX) * 2) / 2));

  const applyColumns = (nextColumns: number) => {
    const safe = Math.max(1, Math.min(MAX_BLOCK_COLUMNS, Math.round(nextColumns)));
    const next = centeredGridRange(safe);
    updateLoginStyle(ctx, {
      useCustomWidth: true,
      blockWidthColumns: safe,
      blockWidth: Math.round((safe / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
      gridStartColumn: next.start,
      gridEndColumn: next.end,
    });
  };

  return (
    <div className="space-y-5 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">Ширина блока</div>
        <button
          type="button"
          ref={ctx.getCoverWidthButtonRef()}
          onClick={() => ctx.setCoverWidthModalOpen((prev) => !prev)}
          className="mt-2 flex w-full items-center justify-between border-b border-[color:var(--bp-stroke)] pb-2 text-left text-sm"
        >
          <span>{columns} колонок</span>
          <span>{ctx.coverWidthModalOpen ? "▴" : "▾"}</span>
        </button>
        {ctx.coverWidthModalOpen ? (
          <div
            ref={ctx.getCoverWidthPopoverRef()}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] border px-3 py-4 shadow-2xl"
            style={{ backgroundColor: ctx.panelTheme.panel, borderColor: ctx.panelTheme.border }}
          >
            <CoverGridWidthControl
              start={range.start}
              end={range.end}
              onChange={(start, end) => applyColumns(Math.max(1, end - start + 1))}
              compact
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {drawerButton("typography", "Типографика", ctx)}
        {drawerButton("button", "Кнопки входа", ctx)}
      </div>

      <BackgroundField label="Фон формы" prefix="authBlockBg" fallback="#ffffff" style={style} ctx={ctx} />
      <BackgroundField label="Фон левой панели" prefix="authSideBg" fallback="#1f2937" style={style} ctx={ctx} />
      {renderCoverFlatNumberInput("Скругление формы", readNumber(style, "authRadius", 0), 0, 64, (value) => updateLoginStyle(ctx, { authRadius: value }))}
      {renderCoverFlatNumberInput("Высота блока", readNumber(style, "authBlockHeight", 700), 360, 1200, (value) => updateLoginStyle(ctx, { authBlockHeight: value }))}

      <div className="grid grid-cols-2 gap-4">
        {lineSelect("Отступ сверху", marginTopLines, (value) => updateLoginStyle(ctx, { marginTop: Math.round(value * COVER_LINE_STEP_PX) }))}
        {lineSelect("Отступ снизу", marginBottomLines, (value) => updateLoginStyle(ctx, { marginBottom: Math.round(value * COVER_LINE_STEP_PX) }))}
      </div>

      <BackgroundField label="Цвет фона для всего блока" prefix="authPageBg" fallback="#f3f4f6" style={style} ctx={ctx} />

      <button
        type="button"
        onClick={() => setDarkOpen((prev) => !prev)}
        className="mt-3 flex w-full items-center justify-between border-b px-0 py-2 text-left text-sm transition"
        style={{
          borderColor: darkOpen ? "var(--bp-save-close,var(--bp-accent))" : ctx.panelTheme.border,
          color: darkOpen ? ctx.panelTheme.text : ctx.panelTheme.muted,
        }}
      >
        <span className="inline-flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />
          </svg>
          <span>Темная тема</span>
        </span>
        <span>{darkOpen ? "▴" : "▾"}</span>
      </button>
      {darkOpen ? (
        <>
          <BackgroundField label="Фон формы" prefix="authBlockBg" fallback="#181b22" dark style={style} ctx={ctx} />
          <BackgroundField label="Фон левой панели" prefix="authSideBg" fallback="#111827" dark style={style} ctx={ctx} />
          <BackgroundField label="Цвет фона для всего блока" prefix="authPageBg" fallback="#0f1012" dark style={style} ctx={ctx} />
        </>
      ) : null}
    </div>
  );
}

