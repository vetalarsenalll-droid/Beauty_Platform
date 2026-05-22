import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import { renderCoverFlatTextInput } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../../runtime/contracts";
import { flatNumber, textValue, updateData } from "../../runtime/ui/flat-placeholder-panels";

type AishaAssetOption = { name: string; label: string; url: string };
type PreviewBounds = { left: number; top: number; width: number; height: number };

const aishaAssetListCache: Record<string, AishaAssetOption[] | undefined> = {};
const aishaAssetListRequests: Record<string, Promise<AishaAssetOption[]> | undefined> = {};

function LoadingAssetsLabel() {
  return (
    <div className="flex h-16 items-center justify-center text-sm text-[color:var(--bp-muted)]">
      <span>Загрузка</span>
      <span className="ml-1 inline-flex translate-y-[2px] items-end gap-0.5" aria-hidden="true">
        <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:160ms]" />
        <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:320ms]" />
      </span>
    </div>
  );
}

function normalizeAishaText(ctx: CrmPanelCtx, key: string, fallback = "Ассистент") {
  const value = textValue(ctx, key, fallback).trim();
  if (!value) return fallback;
  if (key === "title" && (value === "AI-ассистент записи" || value === "AI-ассистент")) return "Ассистент";
  if (key === "label" && (value === "AI Ассистент" || value === "AI-ассистент" || value === "AI-чат")) return "Ассистент";
  return value;
}

function normalizeAssetItems(payload: unknown): AishaAssetOption[] {
  const items =
    payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  return items.filter(
    (item: unknown): item is AishaAssetOption =>
      Boolean(
        item &&
          typeof item === "object" &&
          typeof (item as AishaAssetOption).name === "string" &&
          typeof (item as AishaAssetOption).label === "string" &&
          typeof (item as AishaAssetOption).url === "string"
      )
  );
}

function loadAssetItems(endpoint: string) {
  if (aishaAssetListCache[endpoint]) {
    return Promise.resolve(aishaAssetListCache[endpoint]);
  }

  aishaAssetListRequests[endpoint] ??= fetch(endpoint)
    .then((response) => (response.ok ? response.json() : { items: [] }))
    .then((payload) => {
      const items = normalizeAssetItems(payload);
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
  const endpoint = "/api/v1/site-builder/aisha-icons";
  const [items, setItems] = useState<AishaAssetOption[]>(aishaAssetListCache[endpoint] ?? []);
  const [loading, setLoading] = useState(!aishaAssetListCache[endpoint]);
  const [open, setOpen] = useState(Boolean(selectedUrl));

  useEffect(() => {
    let cancelled = false;
    setLoading(!aishaAssetListCache[endpoint]);
    loadAssetItems(endpoint).then((nextItems) => {
      if (!cancelled) {
        setItems(nextItems);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedItem = items.find((item) => item.url === selectedUrl) ?? null;

  return (
    <div className="space-y-3 border-t border-[color:var(--bp-stroke)] pt-4">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="flex w-full items-center justify-between text-left">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">Иконка виджета</span>
        <span className="text-xs text-[color:var(--bp-muted)]">
          {selectedItem?.label ?? "Не выбрана"} {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
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
          {loading && items.length === 0 ? (
            <LoadingAssetsLabel />
          ) : (
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
          )}
        </div>
      ) : null}
    </div>
  );
}

function AishaChatBackgroundPicker({ ctx }: { ctx: CrmPanelCtx }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const data = ctx.block.data as Record<string, unknown>;
  const selectedUrl = typeof data.chatBackgroundImageUrl === "string" ? data.chatBackgroundImageUrl : "";
  const endpoint = "/api/v1/site-builder/aisha-backgrounds";
  const [items, setItems] = useState<AishaAssetOption[]>(aishaAssetListCache[endpoint] ?? []);
  const [loading, setLoading] = useState(!aishaAssetListCache[endpoint]);
  const [open, setOpen] = useState(Boolean(selectedUrl));
  const [previewItem, setPreviewItem] = useState<AishaAssetOption | null>(null);
  const [previewBounds, setPreviewBounds] = useState<PreviewBounds | null>(null);

  const closePreview = () => {
    setPreviewItem(null);
    setPreviewBounds(null);
  };

  const openPreview = (item: AishaAssetOption) => {
    const panel = rootRef.current?.closest("aside");
    const panelRect = panel?.getBoundingClientRect();
    const headerRect = panel?.firstElementChild?.getBoundingClientRect();
    if (panelRect) {
      const top = headerRect ? Math.max(panelRect.top, headerRect.bottom) : panelRect.top;
      setPreviewBounds({
        left: panelRect.left,
        top,
        width: panelRect.width,
        height: Math.max(120, panelRect.bottom - top),
      });
    } else {
      setPreviewBounds(null);
    }
    setPreviewItem(item);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(!aishaAssetListCache[endpoint]);
    loadAssetItems(endpoint).then((nextItems) => {
      if (!cancelled) {
        setItems(nextItems);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!previewItem) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewItem]);

  const selectedItem = items.find((item) => item.url === selectedUrl) ?? null;

  return (
    <div ref={rootRef} className="space-y-3 border-t border-[color:var(--bp-stroke)] pt-4">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="flex w-full items-center justify-between text-left">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">Фон чата</span>
        <span className="text-xs text-[color:var(--bp-muted)]">
          {selectedItem?.label ?? "Не выбран"} {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
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
          {loading && items.length === 0 ? (
            <LoadingAssetsLabel />
          ) : (
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
                      onClick={() => openPreview(item)}
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
          )}
        </div>
      ) : null}

      {previewItem ? createPortal(
        <div
          className="fixed z-[1000] flex items-center justify-center overflow-hidden bg-black/60 p-6"
          style={
            previewBounds
              ? {
                  left: previewBounds.left,
                  top: previewBounds.top,
                  width: previewBounds.width,
                  height: previewBounds.height,
                }
              : { inset: 0 }
          }
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label={`Просмотр фона ${previewItem.label}`}
        >
          <div className="flex h-full w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <div className="relative inline-block max-h-full max-w-full overflow-hidden rounded-md shadow-2xl">
              <img
                src={previewItem.url}
                alt={previewItem.label}
                className="block max-w-full object-contain"
                style={{ maxHeight: previewBounds ? Math.max(80, previewBounds.height - 48) : "calc(100vh - 48px)" }}
              />
              <button type="button" onClick={closePreview} className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center text-[34px] font-medium leading-none text-black transition hover:text-black/70" aria-label="Закрыть просмотр">
                ×
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

export function AI001ContentPanel(ctx: CrmPanelCtx) {
  const data = ctx.block.data as Record<string, unknown>;

  return (
    <div className="space-y-6 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {renderCoverFlatTextInput("Заголовок виджета", normalizeAishaText(ctx, "title"), (value) => updateData(ctx, { title: value }))}
      {renderCoverFlatTextInput("Имя ассистента", normalizeAishaText(ctx, "assistantName"), (value) => updateData(ctx, { assistantName: value }))}
      {renderCoverFlatTextInput("Текст кнопки", normalizeAishaText(ctx, "label"), (value) => updateData(ctx, { label: value }))}
      <FlatCheckbox
        checked={data.keepWidgetButtonText !== false}
        onChange={(checked) => updateData(ctx, { keepWidgetButtonText: checked })}
        label="Оставить текст кнопки"
      />
      {flatNumber("Размер виджета", Number(data.widgetIconSizePx) || 48, (value) => updateData(ctx, { widgetIconSizePx: value }), 24, 120)}
      <AishaWidgetIconPicker ctx={ctx} />
      <AishaChatBackgroundPicker ctx={ctx} />
    </div>
  );
}
