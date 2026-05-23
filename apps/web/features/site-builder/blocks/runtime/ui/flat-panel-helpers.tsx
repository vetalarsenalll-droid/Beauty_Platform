import { useEffect, useState } from "react";
import { updateBlockStyle, type BlockStyle } from "@/features/site-builder/crm/site-renderer";
import type { CrmPanelCtx } from "../contracts";

const flatSelectClass =
  "w-full appearance-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0";

export function updateStyle(ctx: CrmPanelCtx, patch: Partial<BlockStyle>) {
  ctx.updateBlock(ctx.block.id, (prev) => updateBlockStyle(prev, patch));
}

export function updateData(ctx: CrmPanelCtx, patch: Record<string, unknown>) {
  ctx.updateBlock(ctx.block.id, (prev) => ({
    ...prev,
    data: { ...(prev.data as Record<string, unknown>), ...patch },
  }));
}

export function textValue(ctx: CrmPanelCtx, key: string, fallback = "") {
  const value = (ctx.block.data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

export function FlatSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="min-h-[32px] text-[11px] font-semibold uppercase leading-4 tracking-[0.15em] text-[color:var(--bp-muted)]">
        {label}
      </div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={flatSelectClass}
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
          ▾
        </span>
      </div>
    </label>
  );
}

export function SectionButton({
  id,
  label,
  activePanelSectionId,
  setActivePanelSectionId,
  panelBorder,
  panelAccent = "#2F8EEF",
  panelText,
  panelMuted,
}: {
  id: string;
  label: string;
  activePanelSectionId: string | null;
  setActivePanelSectionId: CrmPanelCtx["setActivePanelSectionId"];
  panelBorder: string;
  panelAccent?: string;
  panelText: string;
  panelMuted: string;
}) {
  const active = activePanelSectionId === id;
  return (
    <button
      type="button"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setActivePanelSectionId(active ? null : id);
      }}
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
      style={{
        borderColor: active ? panelAccent : panelBorder,
        backgroundColor: "transparent",
        color: active ? panelText : panelMuted,
      }}
    >
      <span>{label}</span>
      <span className="text-xs">{active ? "<" : ">"}</span>
    </button>
  );
}

export function DarkThemeToggle({
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
      className="mt-3 mb-1 flex w-full items-center justify-between rounded-none border-0 border-b px-0 py-2 text-left text-sm transition"
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

export function rawStyle(ctx: CrmPanelCtx) {
  const data = ctx.block.data as Record<string, unknown>;
  return (data.style as Record<string, unknown>) ?? {};
}

export function readRawString(ctx: CrmPanelCtx, key: string, fallback = "") {
  const value = rawStyle(ctx)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function color(ctx: CrmPanelCtx, key: string, fallback: string) {
  return readRawString(ctx, key, fallback) || fallback;
}

function FlatNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = 96,
  suffix = "px",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const normalized = Number.isFinite(value) ? Math.round(value) : min;
  const [draft, setDraft] = useState(String(normalized));

  useEffect(() => {
    setDraft(String(normalized));
  }, [normalized]);

  const commit = (rawValue: string) => {
    const parsed = Number(rawValue);
    const next = Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : min;
    setDraft(String(next));
    onChange(next);
  };

  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="number"
          min={min}
          max={max}
          value={draft}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setDraft(nextDraft);

            if (nextDraft.trim() === "") {
              return;
            }

            const parsed = Number(nextDraft);
            if (Number.isFinite(parsed)) {
              onChange(Math.round(parsed));
            }
          }}
          onBlur={(event) => commit(event.target.value)}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">{suffix}</span>
      </div>
    </label>
  );
}

export function flatNumber(
  label: string,
  value: number,
  onChange: (value: number) => void,
  min = 0,
  max = 96,
  suffix = "px"
) {
  return <FlatNumberInput label={label} value={value} onChange={onChange} min={min} max={max} suffix={suffix} />;
}

export function flatPercentSelect(label: string, value: number, onChange: (value: number) => void) {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 50;
  return (
    <FlatSelect
      label={label}
      value={String(normalized)}
      options={Array.from({ length: 11 }, (_, i) => {
        const pct = i * 10;
        return { value: String(pct), label: `${pct}%` };
      })}
      onChange={(next) => onChange(Number(next))}
    />
  );
}
