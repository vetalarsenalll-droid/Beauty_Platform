import { useEffect, useState } from "react";
import {
  COVER_LINE_OPTIONS,
  COVER_LINE_STEP_PX,
  DEFAULT_BLOCK_COLUMNS,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  centeredGridRange,
  clampBlockColumns,
  clampGridColumn,
  formatCoverLineLabel,
} from "@/features/site-builder/crm/site-client-core";
import {
  CoverGridWidthControl,
  TildaBackgroundColorField,
  TildaInlineColorField,
} from "@/features/site-builder/crm/site-editor-panels";
import {
  FlatCheckbox,
  normalizeBlockStyle,
  updateBlockStyle,
  type BlockStyle,
} from "@/features/site-builder/crm/site-renderer";
import { renderCoverFlatTextInput } from "@/features/site-builder/crm/cover-settings";
import { RatingSettingsPanel } from "@/features/site-builder/blocks/rating-settings-panel";
import type { CrmPanelCtx } from "../contracts";

const flatTextareaClass =
  "mt-2 min-h-28 w-full resize-y appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-[color:var(--bp-ink)] focus:shadow-none focus:outline-none focus:ring-0";

const flatSelectClass =
  "w-full appearance-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0";

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

const AISHA_WIDGET_ANIMATION_OPTIONS = [
  { value: "none", label: "Без анимации" },
  { value: "pulse", label: "Пульсация" },
  { value: "shake", label: "Вибрация" },
  { value: "flip", label: "Переворот" },
];

const AISHA_WIDGET_ANIMATION_DEFAULT_SPEED_MS: Record<NonNullable<BlockStyle["widgetAnimationType"]>, number> = {
  none: 2400,
  pulse: 3500,
  shake: 4000,
  flip: 8000,
};

function updateStyle(ctx: CrmPanelCtx, patch: Partial<BlockStyle>) {
  ctx.updateBlock(ctx.block.id, (prev) => updateBlockStyle(prev, patch));
}

function updateData(ctx: CrmPanelCtx, patch: Record<string, unknown>) {
  ctx.updateBlock(ctx.block.id, (prev) => ({
    ...prev,
    data: { ...(prev.data as Record<string, unknown>), ...patch },
  }));
}

function textValue(ctx: CrmPanelCtx, key: string, fallback = "") {
  const value = (ctx.block.data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : fallback;
}

function aishaTextValue(ctx: CrmPanelCtx, key: string, fallback = "Ассистент") {
  const value = textValue(ctx, key, fallback).trim();
  if (!value) return fallback;
  if (key === "title" && (value === "AI-ассистент записи" || value === "AI-ассистент")) return "Ассистент";
  if (key === "label" && (value === "AI Ассистент" || value === "AI-ассистент" || value === "AI-чат")) return "Ассистент";
  return value;
}

type AishaBackgroundOption = { name: string; label: string; url: string };

const aishaAssetListCache: Record<string, AishaBackgroundOption[] | undefined> = {};
const aishaAssetListRequests: Record<string, Promise<AishaBackgroundOption[]> | undefined> = {};

function normalizeAishaAssetItems(payload: unknown): AishaBackgroundOption[] {
  const nextItems =
    payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  return nextItems.filter(
    (item: unknown): item is AishaBackgroundOption =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as AishaBackgroundOption).name === "string" &&
          typeof (item as AishaBackgroundOption).label === "string" &&
          typeof (item as AishaBackgroundOption).url === "string"
      )
  );
}

function loadAishaAssetItems(endpoint: string) {
  if (aishaAssetListCache[endpoint]) {
    return Promise.resolve(aishaAssetListCache[endpoint]);
  }

  aishaAssetListRequests[endpoint] ??= fetch(endpoint)
    .then((response) => (response.ok ? response.json() : { items: [] }))
    .then((payload) => {
      const items = normalizeAishaAssetItems(payload);
      aishaAssetListCache[endpoint] = items;
      return items;
    })
    .catch(() => {
      aishaAssetListCache[endpoint] = [];
      return [];
    });

  return aishaAssetListRequests[endpoint];
}

function AishaWidgetIconPicker({ ctx }: { ctx: CrmPanelCtx }) {
  const data = ctx.block.data as Record<string, unknown>;
  const selectedUrl = typeof data.widgetIconImageUrl === "string" ? data.widgetIconImageUrl : "";
  const [items, setItems] = useState<AishaBackgroundOption[]>(aishaAssetListCache["/api/v1/site-builder/aisha-icons"] ?? []);
  const [open, setOpen] = useState(Boolean(selectedUrl));

  useEffect(() => {
    let cancelled = false;
    loadAishaAssetItems("/api/v1/site-builder/aisha-icons")
      .then((nextItems) => {
        if (cancelled) return;
        setItems(nextItems);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedItem = items.find((item) => item.url === selectedUrl) ?? null;

  return (
    <div className="space-y-3 border-t border-[color:var(--bp-stroke)] pt-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Иконка виджета
        </span>
        <span className="text-xs text-[color:var(--bp-muted)]">
          {selectedItem?.label ?? "Не выбрана"} {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => updateData(ctx, { widgetIconImageUrl: "" })}
              className="border border-[color:var(--bp-stroke)] px-3 py-1 text-xs text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
            >
              Без иконки
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const selected = selectedUrl === item.url;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => updateData(ctx, { widgetIconImageUrl: item.url })}
                  className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-white p-2 transition ${
                    selected ? "border-[color:var(--bp-stroke)] ring-1 ring-black/25" : "border-[color:var(--bp-stroke)] hover:border-[color:var(--bp-ink)]/50"
                  }`}
                  aria-label={`Выбрать иконку ${item.label}`}
                  title={item.label}
                >
                  <img src={item.url} alt="" className="max-h-full max-w-full object-contain" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AishaChatBackgroundPicker({ ctx }: { ctx: CrmPanelCtx }) {
  const data = ctx.block.data as Record<string, unknown>;
  const selectedUrl = typeof data.chatBackgroundImageUrl === "string" ? data.chatBackgroundImageUrl : "";
  const [items, setItems] = useState<AishaBackgroundOption[]>(aishaAssetListCache["/api/v1/site-builder/aisha-backgrounds"] ?? []);
  const [open, setOpen] = useState(Boolean(selectedUrl));
  const [previewItem, setPreviewItem] = useState<AishaBackgroundOption | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAishaAssetItems("/api/v1/site-builder/aisha-backgrounds")
      .then((nextItems) => {
        if (cancelled) return;
        setItems(nextItems);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!previewItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewItem(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewItem]);

  const selectedItem = items.find((item) => item.url === selectedUrl) ?? null;

  return (
    <div className="space-y-3 border-t border-[color:var(--bp-stroke)] pt-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Фон чата
        </span>
        <span className="text-xs text-[color:var(--bp-muted)]">
          {selectedItem?.label ?? "Не выбран"} {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => updateData(ctx, { chatBackgroundImageUrl: "" })}
              className="border border-[color:var(--bp-stroke)] px-3 py-1 text-xs text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
            >
              Без фона
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const selected = selectedUrl === item.url;
              return (
                <div key={item.name} className="relative aspect-[40/56] w-32">
                  <button
                    type="button"
                    onClick={() => updateData(ctx, { chatBackgroundImageUrl: item.url })}
                    className={`h-full w-full overflow-hidden rounded-md border transition ${
                      selected ? "border-[color:var(--bp-stroke)] ring-1 ring-black/25" : "border-[color:var(--bp-stroke)] hover:border-[color:var(--bp-ink)]/50"
                    }`}
                    aria-label={`Выбрать фон ${item.label}`}
                  >
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-[10px] font-semibold text-white">
                      {item.label}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center text-[color:var(--bp-ink)] drop-shadow-sm transition hover:text-black"
                    aria-label={`Увеличить фон ${item.label}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25">
                      <circle cx="11" cy="11" r="6" />
                      <path d="m16 16 4 4" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {previewItem ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-6"
          onClick={() => setPreviewItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Просмотр фона ${previewItem.label}`}
        >
          <div className="relative max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
            <img src={previewItem.url} alt={previewItem.label} className="max-h-[86vh] max-w-[86vw] rounded-md object-contain shadow-2xl" />
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center text-4xl leading-none text-black drop-shadow-sm hover:text-black/70"
              aria-label="Закрыть просмотр"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlatTextarea({
  label,
  value,
  rows = 5,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={flatTextareaClass}
        style={{ borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
      />
    </label>
  );
}

function FlatSelect({
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

function SectionButton({
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

function rawStyle(ctx: CrmPanelCtx) {
  const data = ctx.block.data as Record<string, unknown>;
  return (data.style as Record<string, unknown>) ?? {};
}

function readRawString(ctx: CrmPanelCtx, key: string, fallback = "") {
  const value = rawStyle(ctx)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function backgroundMode(value: unknown): "solid" | "linear" | "radial" {
  return value === "linear" || value === "radial" ? value : "solid";
}

function color(ctx: CrmPanelCtx, key: string, fallback: string) {
  return readRawString(ctx, key, fallback) || fallback;
}

function marginLines(value: number) {
  return Math.max(0, Math.min(7, Math.round((value / COVER_LINE_STEP_PX) * 2) / 2));
}

function applyGridRange(ctx: CrmPanelCtx, nextStart: number, nextEnd: number) {
  const safeStart = clampGridColumn(nextStart);
  const safeEnd = Math.max(safeStart, clampGridColumn(nextEnd));
  const nextColumns = Math.max(1, safeEnd - safeStart + 1);
  updateStyle(ctx, {
    useCustomWidth: true,
    blockWidthColumns: nextColumns,
    blockWidth: Math.round((nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
    gridStartColumn: safeStart,
    gridEndColumn: safeEnd,
  });
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

function flatNumber(
  label: string,
  value: number,
  onChange: (value: number) => void,
  min = 0,
  max = 96,
  suffix = "px"
) {
  return <FlatNumberInput label={label} value={value} onChange={onChange} min={min} max={max} suffix={suffix} />;
}

function flatPercentSelect(
  label: string,
  value: number,
  onChange: (value: number) => void
) {
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

function JsonTextarea(ctx: CrmPanelCtx, key: string, label: string, fallback: unknown) {
  const raw = (ctx.block.data as Record<string, unknown>)[key];
  const value = JSON.stringify(raw ?? fallback, null, 2);
  return (
    <FlatTextarea
      label={label}
      value={value}
      rows={8}
      onChange={(next) => {
        try {
          updateData(ctx, { [key]: JSON.parse(next) });
        } catch {
          updateData(ctx, { [key]: next });
        }
      }}
    />
  );
}

function entityOptions<T extends { id: number; name?: string; title?: string }>(
  items: T[],
  emptyLabel: string
) {
  return [
    { value: "", label: emptyLabel },
    ...items.map((item) => ({
      value: String(item.id),
      label: item.name || item.title || `ID ${item.id}`,
    })),
  ];
}

export function GenericFlatContentPanel(ctx: CrmPanelCtx) {
  const data = ctx.block.data as Record<string, unknown>;
  const commonTitle = (label = "Заголовок", key = "title") =>
    renderCoverFlatTextInput(label, textValue(ctx, key), (value) => updateData(ctx, { [key]: value }));

  return (
    <div className="space-y-6 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {ctx.block.type === "about" && (
        <>
          {commonTitle("Заголовок")}
          <FlatTextarea label="Текст" value={textValue(ctx, "text")} onChange={(value) => updateData(ctx, { text: value })} />
          <FlatCheckbox checked={data.showContacts !== false} onChange={(checked) => updateData(ctx, { showContacts: checked })} label="Показывать контакты" />
        </>
      )}

      {ctx.block.type === "aisha" && (
        <>
          {renderCoverFlatTextInput("Заголовок виджета", aishaTextValue(ctx, "title"), (value) => updateData(ctx, { title: value }))}
          {renderCoverFlatTextInput("Имя ассистента", aishaTextValue(ctx, "assistantName"), (value) => updateData(ctx, { assistantName: value }))}
          {renderCoverFlatTextInput("Текст кнопки", aishaTextValue(ctx, "label"), (value) => updateData(ctx, { label: value }))}
          <FlatCheckbox
            checked={(ctx.block.data as Record<string, unknown>).keepWidgetButtonText !== false}
            onChange={(checked) => updateData(ctx, { keepWidgetButtonText: checked })}
            label="Оставить текст кнопки"
          />
          {flatNumber("Размер виджета", Number(data.widgetIconSizePx) || 48, (value) => updateData(ctx, { widgetIconSizePx: value }), 24, 120)}
          <AishaWidgetIconPicker ctx={ctx} />
          <AishaChatBackgroundPicker ctx={ctx} />
        </>
      )}

      {ctx.block.type === "reviews" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          {flatNumber("Количество отзывов", Number(data.limit) || 6, (value) => updateData(ctx, { limit: value }), 1, 24, "шт")}
        </>
      )}

      {ctx.block.type === "contacts" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          <FlatSelect
            label="Локация"
            value={data.locationId ? String(data.locationId) : ""}
            options={entityOptions(ctx.locations, "Автоматически")}
            onChange={(value) => updateData(ctx, { locationId: value ? Number(value) : null })}
          />
          <FlatCheckbox checked={data.showMap === true} onChange={(checked) => updateData(ctx, { showMap: checked })} label="Показывать карту" />
        </>
      )}

      {ctx.block.type === "promos" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          <FlatSelect
            label="Источник"
            value={textValue(ctx, "mode", "all")}
            options={[
              { value: "all", label: "Все промо" },
              { value: "selected", label: "Выбранные" },
            ]}
            onChange={(value) => updateData(ctx, { mode: value })}
          />
          {JsonTextarea(ctx, "ids", "ID промо JSON", [])}
          <FlatCheckbox checked={data.showButton === true} onChange={(checked) => updateData(ctx, { showButton: checked })} label="Показывать кнопку" />
          {data.showButton === true && commonTitle("Текст кнопки", "buttonText")}
        </>
      )}

      {ctx.block.type === "heading" && (
        <>
          {commonTitle("Надзаголовок", "eyebrow")}
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
        </>
      )}

      {ctx.block.type === "text" && (
        <>
          {commonTitle("Заголовок")}
          <FlatTextarea label="Текст" value={textValue(ctx, "text")} onChange={(value) => updateData(ctx, { text: value })} />
          <FlatSelect
            label="Колонки"
            value={String(data.columns === 2 ? 2 : 1)}
            options={[
              { value: "1", label: "1 колонка" },
              { value: "2", label: "2 колонки" },
            ]}
            onChange={(value) => updateData(ctx, { columns: Number(value) })}
          />
        </>
      )}

      {ctx.block.type === "image" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          {commonTitle("Ссылка на изображение", "imageUrl")}
          {commonTitle("Alt-текст", "alt")}
          <FlatSelect
            label="Заполнение"
            value={data.imageFit === "contain" ? "contain" : "cover"}
            options={[
              { value: "cover", label: "Заполнить" },
              { value: "contain", label: "Вписать" },
            ]}
            onChange={(value) => updateData(ctx, { imageFit: value })}
          />
        </>
      )}

      {ctx.block.type === "gallery" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          {JsonTextarea(ctx, "images", "Изображения JSON", [])}
        </>
      )}

      {ctx.block.type === "form" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          {commonTitle("Текст кнопки", "buttonText")}
          {commonTitle("Текст после отправки", "successText")}
          {JsonTextarea(ctx, "fields", "Поля JSON", ["name", "phone", "comment"])}
        </>
      )}

      {ctx.block.type === "button" && (
        <>
          {commonTitle("Текст кнопки", "text")}
          {commonTitle("Ссылка", "href")}
          <FlatSelect
            label="Страница"
            value={textValue(ctx, "page", "booking")}
            options={[
              { value: "", label: "Не выбрано" },
              { value: "booking", label: "Онлайн запись" },
              { value: "locations", label: "Локации" },
              { value: "services", label: "Услуги" },
              { value: "specialists", label: "Специалисты" },
            ]}
            onChange={(value) => updateData(ctx, { page: value })}
          />
          <FlatSelect
            label="Выравнивание"
            value={textValue(ctx, "align", "center")}
            options={[
              { value: "left", label: "Слева" },
              { value: "center", label: "По центру" },
              { value: "right", label: "Справа" },
            ]}
            onChange={(value) => updateData(ctx, { align: value })}
          />
        </>
      )}

      {ctx.block.type === "advantages" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          {JsonTextarea(ctx, "items", "Преимущества JSON", [])}
        </>
      )}

      {ctx.block.type === "project" && (
        <>
          {commonTitle("Заголовок")}
          <FlatTextarea label="Текст" value={textValue(ctx, "text")} onChange={(value) => updateData(ctx, { text: value })} />
          {commonTitle("Ссылка на изображение", "imageUrl")}
        </>
      )}

      {ctx.block.type === "footer" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          <FlatCheckbox checked={data.showSocials !== false} onChange={(checked) => updateData(ctx, { showSocials: checked })} label="Показывать соцсети" />
          <FlatCheckbox checked={data.showAddress !== false} onChange={(checked) => updateData(ctx, { showAddress: checked })} label="Показывать адрес" />
          <FlatCheckbox checked={data.showPhone !== false} onChange={(checked) => updateData(ctx, { showPhone: checked })} label="Показывать телефон" />
          <FlatCheckbox checked={data.showEmail !== false} onChange={(checked) => updateData(ctx, { showEmail: checked })} label="Показывать email" />
        </>
      )}

      {ctx.block.type === "team" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          <FlatSelect
            label="Источник"
            value={textValue(ctx, "mode", "all")}
            options={[
              { value: "all", label: "Все специалисты" },
              { value: "selected", label: "Выбранные" },
            ]}
            onChange={(value) => updateData(ctx, { mode: value })}
          />
          {JsonTextarea(ctx, "ids", "ID специалистов JSON", [])}
        </>
      )}

      {ctx.block.type === "news" && (
        <>
          {commonTitle("Заголовок")}
          {commonTitle("Подзаголовок", "subtitle")}
          {JsonTextarea(ctx, "items", "Новости JSON", [])}
        </>
      )}

      {ctx.block.type === "widget" && (
        <>
          {commonTitle("Заголовок")}
          <FlatTextarea label="Код виджета" value={textValue(ctx, "embedCode")} onChange={(value) => updateData(ctx, { embedCode: value })} />
          <FlatTextarea label="Текст заглушки" value={textValue(ctx, "fallbackText")} onChange={(value) => updateData(ctx, { fallbackText: value })} />
        </>
      )}

      {ctx.block.type === "locationProfile" && (
        <>
          {commonTitle("Заголовок")}
          <FlatSelect
            label="Локация"
            value={data.locationId ? String(data.locationId) : ""}
            options={entityOptions(ctx.locations, "Автоматически")}
            onChange={(value) => updateData(ctx, { locationId: value ? Number(value) : null })}
          />
          <FlatCheckbox checked={data.showServices !== false} onChange={(checked) => updateData(ctx, { showServices: checked })} label="Показывать услуги" />
          <FlatCheckbox checked={data.showSpecialists !== false} onChange={(checked) => updateData(ctx, { showSpecialists: checked })} label="Показывать специалистов" />
        </>
      )}

      {ctx.block.type === "serviceProfile" && (
        <>
          {commonTitle("Заголовок")}
          <FlatSelect
            label="Услуга"
            value={data.serviceId ? String(data.serviceId) : ""}
            options={entityOptions(ctx.services, "Автоматически")}
            onChange={(value) => updateData(ctx, { serviceId: value ? Number(value) : null })}
          />
          <FlatCheckbox checked={data.showSpecialists !== false} onChange={(checked) => updateData(ctx, { showSpecialists: checked })} label="Показывать специалистов" />
          <FlatCheckbox checked={data.showBookingButton !== false} onChange={(checked) => updateData(ctx, { showBookingButton: checked })} label="Показывать кнопку записи" />
        </>
      )}

      {ctx.block.type === "specialistProfile" && (
        <>
          {commonTitle("Заголовок")}
          <FlatSelect
            label="Специалист"
            value={data.specialistId ? String(data.specialistId) : ""}
            options={entityOptions(ctx.specialists, "Автоматически")}
            onChange={(value) => updateData(ctx, { specialistId: value ? Number(value) : null })}
          />
          <FlatCheckbox checked={data.showServices !== false} onChange={(checked) => updateData(ctx, { showServices: checked })} label="Показывать услуги" />
          <FlatCheckbox checked={data.showBookingButton !== false} onChange={(checked) => updateData(ctx, { showBookingButton: checked })} label="Показывать кнопку записи" />
        </>
      )}
    </div>
  );
}

export function GenericFlatSettingsPanel(ctx: CrmPanelCtx) {
  const [showDarkTheme, setShowDarkTheme] = useState(false);
  const [widthPopoverOpen, setWidthPopoverOpen] = useState(false);
  const style = normalizeBlockStyle(ctx.block, ctx.activeTheme);
  const raw = rawStyle(ctx);
  const panelBorder = ctx.panelTheme.border;
  const panel = ctx.panelTheme.panel;
  const panelText = ctx.panelTheme.text;
  const panelMuted = ctx.panelTheme.muted;
  const buttonSectionId = ctx.currentPanelSections.some((section) => section.id === "buttons")
    ? "buttons"
    : "button";
  const columns = clampBlockColumns(style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, ctx.block.type);
  const fallback = centeredGridRange(columns);
  const gridStart = clampGridColumn(style.gridStartColumn ?? fallback.start);
  const gridEnd = Math.max(gridStart, clampGridColumn(style.gridEndColumn ?? fallback.end));
  const lightMode = backgroundMode(raw.servicesSectionBackgroundModeLight);
  const darkMode = backgroundMode(raw.servicesSectionBackgroundModeDark ?? raw.servicesSectionBackgroundModeLight);
  const lightBg = readRawString(ctx, "servicesSectionBackgroundFromLight", style.sectionBgLight || "#ffffff");
  const darkBg = readRawString(ctx, "servicesSectionBackgroundFromDark", style.sectionBgDark || "#16181d");
  const isAisha = ctx.block.type === "aisha";
  const lightBackdropColor = readRawString(ctx, "aishaBackdropColorLight", "transparent");
  const darkBackdropColor = readRawString(ctx, "aishaBackdropColorDark", lightBackdropColor);
  const lightBackdropOpacity = Number.isFinite(Number(raw.aishaBackdropOpacityLight))
    ? Math.max(0, Math.min(100, Math.round(Number(raw.aishaBackdropOpacityLight))))
    : 50;
  const darkBackdropOpacity = Number.isFinite(Number(raw.aishaBackdropOpacityDark))
    ? Math.max(0, Math.min(100, Math.round(Number(raw.aishaBackdropOpacityDark))))
    : lightBackdropOpacity;
  const aishaOffsetBottom = Number.isFinite(Number((ctx.block.data as Record<string, unknown>).offsetBottomPx))
    ? Math.max(0, Math.min(160, Math.round(Number((ctx.block.data as Record<string, unknown>).offsetBottomPx))))
    : 16;
  const aishaOffsetRight = Number.isFinite(Number((ctx.block.data as Record<string, unknown>).offsetRightPx))
    ? Math.max(0, Math.min(240, Math.round(Number((ctx.block.data as Record<string, unknown>).offsetRightPx))))
    : 16;

  return (
    <div className="space-y-6 px-1 pb-8 pt-1">
      {isAisha && (
        <FlatCheckbox
          checked={(ctx.block.data as Record<string, unknown>).enabled !== false}
          onChange={(checked) => updateData(ctx, { enabled: checked })}
          label="Показывать виджет на сайте"
        />
      )}

      {!isAisha && (
        <>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
              Ширина блока
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setWidthPopoverOpen((prev) => !prev)}
                className="mt-2 flex w-full items-center justify-between border-b pb-2 text-left text-sm"
                style={{ borderColor: panelBorder }}
              >
                <span>{Math.max(1, gridEnd - gridStart + 1)} колонок</span>
                <span className="text-sm leading-none">{widthPopoverOpen ? "^" : "v"}</span>
              </button>
              {widthPopoverOpen && (
                <div
                  className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
                  style={{ backgroundColor: panel, borderColor: panelBorder }}
                >
                  <CoverGridWidthControl
                    start={gridStart}
                    end={gridEnd}
                    onChange={(nextStart, nextEnd) => applyGridRange(ctx, nextStart, nextEnd)}
                    compact
                  />
                </div>
              )}
            </div>
          </div>

          <FlatSelect
            label="Выравнивание"
            value={style.textAlign ?? "left"}
            options={[
              { value: "left", label: "По левому краю" },
              { value: "center", label: "По центру" },
              { value: "right", label: "По правому краю" },
            ]}
            onChange={(value) =>
              updateStyle(ctx, {
                textAlign: value as BlockStyle["textAlign"],
                textAlignHeading: value as BlockStyle["textAlign"],
                textAlignSubheading: value as BlockStyle["textAlign"],
              })
            }
          />
        </>
      )}

      <div className="space-y-3">
        {ctx.currentPanelSections.some((section) => section.id === "typography") && (
          <SectionButton id="typography" label="Типографика" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "widget") && (
          <SectionButton id="widget" label="Виджет" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "messages") && (
          <SectionButton id="messages" label="Сообщения" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "colors") && (
          <SectionButton id="colors" label="Цвета" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "button" || section.id === "buttons") && (
          <SectionButton id={buttonSectionId} label={ctx.block.type === "aisha" ? "Кнопки" : "Кнопка"} activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "animation") && (
          <SectionButton id="animation" label="Анимация" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
        {ctx.currentPanelSections.some((section) => section.id === "reviews") && (
          <SectionButton id="reviews" label="Отзывы" activePanelSectionId={ctx.activePanelSectionId} setActivePanelSectionId={ctx.setActivePanelSectionId} panelBorder={panelBorder} panelText={panelText} panelMuted={panelMuted} />
        )}
      </div>

      {isAisha ? (
        <div className="grid grid-cols-2 gap-3">
          {flatNumber("Отступ виджета снизу", aishaOffsetBottom, (value) => updateData(ctx, { offsetBottomPx: value }), 0, 160, "px")}
          {flatNumber("Отступ виджета справа", aishaOffsetRight, (value) => updateData(ctx, { offsetRightPx: value }), 0, 240, "px")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <FlatSelect
            label="Отступ сверху"
            value={String(marginLines(style.marginTop))}
            options={COVER_LINE_OPTIONS.map((value) => ({ value: String(value), label: formatCoverLineLabel(value) }))}
            onChange={(value) => updateStyle(ctx, { marginTop: Math.round(Number(value) * COVER_LINE_STEP_PX) })}
          />
          <FlatSelect
            label="Отступ снизу"
            value={String(marginLines(style.marginBottom))}
            options={COVER_LINE_OPTIONS.map((value) => ({ value: String(value), label: formatCoverLineLabel(value) }))}
            onChange={(value) => updateStyle(ctx, { marginBottom: Math.round(Number(value) * COVER_LINE_STEP_PX) })}
          />
        </div>
      )}

      {isAisha ? (
        <div className="grid grid-cols-2 gap-4">
          <TildaInlineColorField
            compact
            label="Затемнение"
            value={lightBackdropColor}
            placeholder=""
            onChange={(value) => updateStyle(ctx, { aishaBackdropColorLight: value })}
            onClear={() => updateStyle(ctx, { aishaBackdropColorLight: "transparent" })}
          />
          {flatPercentSelect("Непрозрачность", lightBackdropOpacity, (value) =>
            updateStyle(ctx, { aishaBackdropOpacityLight: value })
          )}
        </div>
      ) : (
        <TildaBackgroundColorField
          label="Цвет фона для всего блока"
          value={lightBg}
          mode={lightMode}
          secondValue={String(raw.servicesSectionBackgroundToLight ?? lightBg)}
          angle={Number(raw.servicesSectionBackgroundAngleLight ?? 135)}
          radialStopA={Number(raw.servicesSectionBackgroundStopALight ?? 0)}
          radialStopB={Number(raw.servicesSectionBackgroundStopBLight ?? 100)}
          placeholder="#ffffff"
          onModeChange={(mode) => updateStyle(ctx, { servicesSectionBackgroundModeLight: mode })}
          onSecondChange={(value) => updateStyle(ctx, { servicesSectionBackgroundToLight: value })}
          onAngleChange={(value) => updateStyle(ctx, { servicesSectionBackgroundAngleLight: value })}
          onRadialStopAChange={(value) => updateStyle(ctx, { servicesSectionBackgroundStopALight: value })}
          onRadialStopBChange={(value) => updateStyle(ctx, { servicesSectionBackgroundStopBLight: value })}
          onChange={(value) =>
            updateStyle(ctx, {
              sectionBgLight: value,
              sectionBg: value,
              servicesSectionBackgroundFromLight: value,
              servicesSectionBackgroundToLight:
                lightMode === "solid" ? value : String(raw.servicesSectionBackgroundToLight ?? value),
            })
          }
        />
      )}

      <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
      {showDarkTheme && (
        isAisha ? (
          <div className="grid grid-cols-2 gap-4">
            <TildaInlineColorField
              compact
              label="Затемнение"
              value={darkBackdropColor}
              placeholder=""
              onChange={(value) => updateStyle(ctx, { aishaBackdropColorDark: value })}
              onClear={() => updateStyle(ctx, { aishaBackdropColorDark: "transparent" })}
            />
            {flatPercentSelect("Непрозрачность", darkBackdropOpacity, (value) =>
              updateStyle(ctx, { aishaBackdropOpacityDark: value })
            )}
          </div>
        ) : (
          <TildaBackgroundColorField
            label="Цвет фона для всего блока"
            value={darkBg}
            mode={darkMode}
            secondValue={String(raw.servicesSectionBackgroundToDark ?? darkBg)}
            angle={Number(raw.servicesSectionBackgroundAngleDark ?? raw.servicesSectionBackgroundAngleLight ?? 135)}
            radialStopA={Number(raw.servicesSectionBackgroundStopADark ?? raw.servicesSectionBackgroundStopALight ?? 0)}
            radialStopB={Number(raw.servicesSectionBackgroundStopBDark ?? raw.servicesSectionBackgroundStopBLight ?? 100)}
            placeholder="#16181d"
            onModeChange={(mode) => updateStyle(ctx, { servicesSectionBackgroundModeDark: mode })}
            onSecondChange={(value) => updateStyle(ctx, { servicesSectionBackgroundToDark: value })}
            onAngleChange={(value) => updateStyle(ctx, { servicesSectionBackgroundAngleDark: value })}
            onRadialStopAChange={(value) => updateStyle(ctx, { servicesSectionBackgroundStopADark: value })}
            onRadialStopBChange={(value) => updateStyle(ctx, { servicesSectionBackgroundStopBDark: value })}
            onChange={(value) =>
              updateStyle(ctx, {
                sectionBgDark: value,
                servicesSectionBackgroundFromDark: value,
                servicesSectionBackgroundToDark:
                  darkMode === "solid" ? value : String(raw.servicesSectionBackgroundToDark ?? value),
              })
            }
          />
        )
      )}
    </div>
  );
}

export function GenericFlatDrawers(ctx: CrmPanelCtx) {
  const [showDarkTheme, setShowDarkTheme] = useState(false);
  const style = normalizeBlockStyle(ctx.block, ctx.activeTheme);
  const section = ctx.activePanelSectionId;
  if (ctx.rightPanel !== "settings") return "";
  if (!section) return "";

  if (section === "typography") {
    if (ctx.block.type === "aisha") {
      return "";
    }

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

  if (ctx.block.type === "aisha" && section === "widget") {
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
        {showDarkTheme && (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Фон окна" value={color(ctx, "blockBgDark", ctx.activeTheme.darkPalette.panelColor)} placeholder={ctx.activeTheme.darkPalette.panelColor} onChange={(value) => updateStyle(ctx, { blockBgDark: value })} onClear={() => updateStyle(ctx, { blockBgDark: "transparent" })} />
            <TildaInlineColorField compact label="Основной текст" value={color(ctx, "textColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { textColorDark: value })} onClear={() => updateStyle(ctx, { textColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Вторичный текст" value={color(ctx, "mutedColorDark", ctx.activeTheme.darkPalette.mutedColor)} placeholder={ctx.activeTheme.darkPalette.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorDark: value })} onClear={() => updateStyle(ctx, { mutedColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Контур" value={color(ctx, "borderColorDark", ctx.activeTheme.darkPalette.borderColor)} placeholder={ctx.activeTheme.darkPalette.borderColor} onChange={(value) => updateStyle(ctx, { borderColorDark: value })} onClear={() => updateStyle(ctx, { borderColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Фон шапки" value={color(ctx, "headerBgColorDark", ctx.activeTheme.darkPalette.panelColor)} placeholder={ctx.activeTheme.darkPalette.panelColor} onChange={(value) => updateStyle(ctx, { headerBgColorDark: value })} onClear={() => updateStyle(ctx, { headerBgColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст шапки" value={color(ctx, "headerTextColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { headerTextColorDark: value })} onClear={() => updateStyle(ctx, { headerTextColorDark: "transparent" })} />
          </div>
        )}
      </div>
    );
  }

  if (ctx.block.type === "aisha" && section === "messages") {
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
        {showDarkTheme && (
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
        )}
      </div>
    );
  }

  if (ctx.block.type === "aisha" && section === "buttons") {
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
        {showDarkTheme && (
          <div className="space-y-4">
            <TildaInlineColorField compact label="Фон кнопки виджета" value={color(ctx, "buttonColorDark", ctx.activeTheme.darkPalette.buttonColor)} placeholder={ctx.activeTheme.darkPalette.buttonColor} onChange={(value) => updateStyle(ctx, { buttonColorDark: value })} onClear={() => updateStyle(ctx, { buttonColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст кнопки виджета" value={color(ctx, "buttonTextColorDark", ctx.activeTheme.darkPalette.buttonTextColor)} placeholder={ctx.activeTheme.darkPalette.buttonTextColor} onChange={(value) => updateStyle(ctx, { buttonTextColorDark: value })} onClear={() => updateStyle(ctx, { buttonTextColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Фон кнопок вариантов" value={color(ctx, "quickReplyButtonColorDark", ctx.activeTheme.darkPalette.buttonColor)} placeholder={ctx.activeTheme.darkPalette.buttonColor} onChange={(value) => updateStyle(ctx, { quickReplyButtonColorDark: value })} onClear={() => updateStyle(ctx, { quickReplyButtonColorDark: "transparent" })} />
            <TildaInlineColorField compact label="Текст кнопок вариантов" value={color(ctx, "quickReplyTextColorDark", ctx.activeTheme.darkPalette.buttonTextColor)} placeholder={ctx.activeTheme.darkPalette.buttonTextColor} onChange={(value) => updateStyle(ctx, { quickReplyTextColorDark: value })} onClear={() => updateStyle(ctx, { quickReplyTextColorDark: "transparent" })} />
          </div>
        )}
      </div>
    );
  }

  if (ctx.block.type === "aisha" && section === "animation") {
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
            options={AISHA_WIDGET_ANIMATION_OPTIONS}
            onChange={(value) => {
              const nextAnimationType = value as NonNullable<BlockStyle["widgetAnimationType"]>;
              updateStyle(ctx, {
                widgetAnimationType: nextAnimationType,
                widgetAnimationSpeedMs: AISHA_WIDGET_ANIMATION_DEFAULT_SPEED_MS[nextAnimationType],
              });
            }}
          />
          {flatNumber(
            "Скорость анимации, мс",
            style.widgetAnimationSpeedMs ?? 2400,
            (value) => updateStyle(ctx, { widgetAnimationSpeedMs: value }),
            600,
            8000
          )}
        </div>
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
            <TildaInlineColorField compact label="Фон карточек" value={color(ctx, "cardBgDark", style.subBlockBgDark || "#16181d")} placeholder="#16181d" onChange={(value) => updateStyle(ctx, { cardBgDark: value, subBlockBgDark: value })} onClear={() => updateStyle(ctx, { cardBgDark: "transparent", subBlockBgDark: "transparent" })} />
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
    if (ctx.block.type === "reviews") {
      return (
        <div className="space-y-6 px-1 pb-8 pt-1">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Текст</div>
            <TildaInlineColorField compact label="Основной текст" value={color(ctx, "textColorLight", ctx.activeTheme.textColor)} placeholder={ctx.activeTheme.textColor} onChange={(value) => updateStyle(ctx, { textColorLight: value, textColor: value })} onClear={() => updateStyle(ctx, { textColorLight: "transparent", textColor: "transparent" })} />
            <TildaInlineColorField compact label="Вторичный текст" value={color(ctx, "mutedColorLight", ctx.activeTheme.mutedColor)} placeholder={ctx.activeTheme.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorLight: value, mutedColor: value })} onClear={() => updateStyle(ctx, { mutedColorLight: "transparent", mutedColor: "transparent" })} />
            {flatNumber("Заголовок", style.headingSize ?? ctx.activeTheme.headingSize ?? 28, (value) => updateStyle(ctx, { headingSize: value }), 10, 96)}
            {flatNumber("Подзаголовок", style.subheadingSize ?? ctx.activeTheme.subheadingSize ?? 16, (value) => updateStyle(ctx, { subheadingSize: value }), 10, 64)}
            {flatNumber("Текст отзывов", style.textSize ?? ctx.activeTheme.textSize ?? 16, (value) => updateStyle(ctx, { textSize: value }), 10, 48)}
          </div>

          <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Карточки</div>
            <TildaInlineColorField compact label="Цвет карточек" value={color(ctx, "cardBgLight", style.subBlockBgLight || "#ffffff")} placeholder="#ffffff" onChange={(value) => updateStyle(ctx, { cardBgLight: value, subBlockBgLight: value, subBlockBg: value })} onClear={() => updateStyle(ctx, { cardBgLight: "transparent", subBlockBgLight: "transparent" })} />
            <TildaInlineColorField compact label="Обводка карточек" value={color(ctx, "cardBorderColorLight", "transparent")} placeholder="transparent" onChange={(value) => updateStyle(ctx, { cardBorderColorLight: value })} onClear={() => updateStyle(ctx, { cardBorderColorLight: "transparent" })} />
            {flatNumber("Скругление карточек", style.cardRadius ?? style.radius ?? 8, (value) => updateStyle(ctx, { cardRadius: value }), 0, 80)}
          </div>

          <div className="space-y-4 border-t border-[color:var(--bp-stroke)] pt-4">
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">Рейтинг</div>
            <TildaInlineColorField compact label="Цвет звезд" value={color(ctx, "secondaryButtonBgLight", "#ff9f0a")} placeholder="#ff9f0a" onChange={(value) => updateStyle(ctx, { secondaryButtonBgLight: value })} onClear={() => updateStyle(ctx, { secondaryButtonBgLight: "transparent" })} />
            <TildaInlineColorField compact label="Линии рейтинга" value={color(ctx, "fieldBorderColorLight", "#e2e8f0")} placeholder="#e2e8f0" onChange={(value) => updateStyle(ctx, { fieldBorderColorLight: value })} onClear={() => updateStyle(ctx, { fieldBorderColorLight: "transparent" })} />
          </div>

          <DarkThemeToggle open={showDarkTheme} setOpen={setShowDarkTheme} />
          {showDarkTheme && (
            <div className="space-y-4">
              <TildaInlineColorField compact label="Основной текст" value={color(ctx, "textColorDark", ctx.activeTheme.darkPalette.textColor)} placeholder={ctx.activeTheme.darkPalette.textColor} onChange={(value) => updateStyle(ctx, { textColorDark: value })} onClear={() => updateStyle(ctx, { textColorDark: "transparent" })} />
              <TildaInlineColorField compact label="Вторичный текст" value={color(ctx, "mutedColorDark", ctx.activeTheme.darkPalette.mutedColor)} placeholder={ctx.activeTheme.darkPalette.mutedColor} onChange={(value) => updateStyle(ctx, { mutedColorDark: value })} onClear={() => updateStyle(ctx, { mutedColorDark: "transparent" })} />
              <TildaInlineColorField compact label="Цвет карточек" value={color(ctx, "cardBgDark", style.subBlockBgDark || "#16181d")} placeholder="#16181d" onChange={(value) => updateStyle(ctx, { cardBgDark: value, subBlockBgDark: value })} onClear={() => updateStyle(ctx, { cardBgDark: "transparent", subBlockBgDark: "transparent" })} />
              <TildaInlineColorField compact label="Обводка карточек" value={color(ctx, "cardBorderColorDark", "transparent")} placeholder="transparent" onChange={(value) => updateStyle(ctx, { cardBorderColorDark: value })} onClear={() => updateStyle(ctx, { cardBorderColorDark: "transparent" })} />
              <TildaInlineColorField compact label="Цвет звезд" value={color(ctx, "secondaryButtonBgDark", color(ctx, "secondaryButtonBgLight", "#ff9f0a"))} placeholder={color(ctx, "secondaryButtonBgLight", "#ff9f0a")} onChange={(value) => updateStyle(ctx, { secondaryButtonBgDark: value })} onClear={() => updateStyle(ctx, { secondaryButtonBgDark: "transparent" })} />
              <TildaInlineColorField compact label="Линии рейтинга" value={color(ctx, "fieldBorderColorDark", "#303642")} placeholder="#303642" onChange={(value) => updateStyle(ctx, { fieldBorderColorDark: value })} onClear={() => updateStyle(ctx, { fieldBorderColorDark: "transparent" })} />
            </div>
          )}
        </div>
      );
    }
    return <RatingSettingsPanel block={ctx.block} activeTheme={ctx.activeTheme} updateBlock={ctx.updateBlock} />;
  }

  return (
    <div className="px-1 pb-8 pt-1 text-sm text-[color:var(--bp-muted)]">
      Раздел настроек пока пуст.
    </div>
  );
}

