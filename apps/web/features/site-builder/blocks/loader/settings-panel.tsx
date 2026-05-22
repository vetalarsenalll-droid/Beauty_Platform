import { useState } from "react";
import {
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  type CoverBackgroundMode,
} from "@/features/site-builder/crm/site-client-core";
import { TildaBackgroundColorField } from "@/features/site-builder/crm/site-editor-panels";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../runtime/contracts";
import { LoaderGridWidthControl } from "./grid-width-control";

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
};

const readString = (data: Record<string, unknown>, key: string, fallback: string) => {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};

const readMode = (data: Record<string, unknown>, key: string): CoverBackgroundMode => {
  const value = data[key];
  return value === "linear" || value === "radial" ? value : "solid";
};

function FlatNumberInput({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(clampNumber(event.target.value, min, max, value))}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
        <span className="shrink-0 text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">
          {suffix}
        </span>
      </div>
    </label>
  );
}

function DarkThemeToggle({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className="mt-3 flex w-full items-center justify-between border-b px-0 py-2 text-left text-sm transition"
      style={{
        borderColor: open ? "var(--bp-save-close,var(--bp-accent))" : "var(--bp-stroke)",
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

export function SharedLoaderSettingsPanel(ctx: CrmPanelCtx) {
  const [darkOpen, setDarkOpen] = useState(false);
  const block = ctx.block;
  const data = ((block.data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const style = (data.style as Record<string, unknown>) ?? {};
  const start = Number.isFinite(Number(style.gridStartColumn)) ? Number(style.gridStartColumn) : 1;
  const end = Number.isFinite(Number(style.gridEndColumn)) ? Number(style.gridEndColumn) : 12;

  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  const applyRange = (nextStart: number, nextEnd: number) => {
    const nextColumns = Math.max(1, nextEnd - nextStart + 1);
    updateData({
      style: {
        ...(((block.data as Record<string, unknown>).style as Record<string, unknown>) ?? {}),
        useCustomWidth: true,
        blockWidthColumns: nextColumns,
        blockWidth: Math.round((nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
        gridStartColumn: nextStart,
        gridEndColumn: nextEnd,
      },
    });
  };

  const size = clampNumber(data.size, 16, 120, 36);
  const speedMs = clampNumber(data.speedMs, 300, 4000, 900);
  const thickness = clampNumber(data.thickness, 1, 10, 3);
  const sliderAccent = "var(--bp-save-close,var(--bp-accent))";

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      <LoaderGridWidthControl start={start} end={end} onChange={applyRange} />

      <div className="space-y-4">
        <TildaBackgroundColorField
          label="Цвет лоадера"
          value={readString(data, "color", "#111827")}
          mode={readMode(data, "colorMode")}
          secondValue={readString(data, "colorTo", readString(data, "color", "#111827"))}
          angle={clampNumber(data.colorAngle, 0, 360, 180)}
          radialStopA={clampNumber(data.colorStopA, 0, 100, 0)}
          radialStopB={clampNumber(data.colorStopB, 0, 100, 100)}
          placeholder="#111827"
          accentColor={sliderAccent}
          onModeChange={(mode) => updateData({ colorMode: mode })}
          onChange={(value) => updateData({ color: value })}
          onSecondChange={(value) => updateData({ colorTo: value })}
          onAngleChange={(value) => updateData({ colorAngle: value })}
          onRadialStopAChange={(value) => updateData({ colorStopA: value })}
          onRadialStopBChange={(value) => updateData({ colorStopB: value })}
        />
        <FlatCheckbox
          checked={Boolean(data.backdropEnabled)}
          onChange={(checked) => updateData({ backdropEnabled: checked })}
          label="Затемнять фон"
        />
        <TildaBackgroundColorField
          label="Цвет затемнения"
          value={readString(data, "backdropHex", "#111827")}
          mode={readMode(data, "backdropMode")}
          secondValue={readString(data, "backdropTo", readString(data, "backdropHex", "#111827"))}
          angle={clampNumber(data.backdropAngle, 0, 360, 180)}
          radialStopA={clampNumber(data.backdropStopA, 0, 100, 0)}
          radialStopB={clampNumber(data.backdropStopB, 0, 100, 100)}
          placeholder="#111827"
          accentColor={sliderAccent}
          onModeChange={(mode) => updateData({ backdropMode: mode })}
          onChange={(value) => updateData({ backdropHex: value, backdropColor: value })}
          onSecondChange={(value) => updateData({ backdropTo: value })}
          onAngleChange={(value) => updateData({ backdropAngle: value })}
          onRadialStopAChange={(value) => updateData({ backdropStopA: value })}
          onRadialStopBChange={(value) => updateData({ backdropStopB: value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FlatNumberInput label="Размер" value={size} min={16} max={120} suffix="px" onChange={(value) => updateData({ size: value })} />
        <FlatNumberInput label="Толщина" value={thickness} min={1} max={10} suffix="px" onChange={(value) => updateData({ thickness: value })} />
      </div>
      <FlatNumberInput label="Скорость анимации" value={speedMs} min={300} max={4000} suffix="мс" onChange={(value) => updateData({ speedMs: value })} />

      <div className="space-y-4">
        <DarkThemeToggle open={darkOpen} setOpen={setDarkOpen} />
        {darkOpen ? (
          <div className="space-y-4">
            <TildaBackgroundColorField
              label="Цвет лоадера"
              value={readString(data, "colorDark", readString(data, "color", "#111827"))}
              mode={readMode(data, "colorModeDark")}
              secondValue={readString(data, "colorToDark", readString(data, "colorTo", "#111827"))}
              angle={clampNumber(data.colorAngleDark, 0, 360, clampNumber(data.colorAngle, 0, 360, 180))}
              radialStopA={clampNumber(data.colorStopADark, 0, 100, clampNumber(data.colorStopA, 0, 100, 0))}
              radialStopB={clampNumber(data.colorStopBDark, 0, 100, clampNumber(data.colorStopB, 0, 100, 100))}
              placeholder="#111827"
              accentColor={sliderAccent}
              onModeChange={(mode) => updateData({ colorModeDark: mode })}
              onChange={(value) => updateData({ colorDark: value })}
              onSecondChange={(value) => updateData({ colorToDark: value })}
              onAngleChange={(value) => updateData({ colorAngleDark: value })}
              onRadialStopAChange={(value) => updateData({ colorStopADark: value })}
              onRadialStopBChange={(value) => updateData({ colorStopBDark: value })}
            />
            <TildaBackgroundColorField
              label="Цвет затемнения"
              value={readString(data, "backdropHexDark", readString(data, "backdropHex", "#111827"))}
              mode={readMode(data, "backdropModeDark")}
              secondValue={readString(data, "backdropToDark", readString(data, "backdropTo", "#111827"))}
              angle={clampNumber(data.backdropAngleDark, 0, 360, clampNumber(data.backdropAngle, 0, 360, 180))}
              radialStopA={clampNumber(data.backdropStopADark, 0, 100, clampNumber(data.backdropStopA, 0, 100, 0))}
              radialStopB={clampNumber(data.backdropStopBDark, 0, 100, clampNumber(data.backdropStopB, 0, 100, 100))}
              placeholder="#111827"
              accentColor={sliderAccent}
              onModeChange={(mode) => updateData({ backdropModeDark: mode })}
              onChange={(value) => updateData({ backdropHexDark: value, backdropColorDark: value })}
              onSecondChange={(value) => updateData({ backdropToDark: value })}
              onAngleChange={(value) => updateData({ backdropAngleDark: value })}
              onRadialStopAChange={(value) => updateData({ backdropStopADark: value })}
              onRadialStopBChange={(value) => updateData({ backdropStopBDark: value })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

