import { PAGE_KEYS, PAGE_LABELS } from "@/features/site-builder/crm/site-client-core";
import { renderCoverFlatTextInput } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../../runtime/contracts";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Slide = {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  buttonPage: string | null;
  buttonHref: string;
  imageUrl: string;
};

function normalizeSlides(raw: unknown): Slide[] {
  const input = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  const slides = input
    .map((item, index) => {
      const id = String(item.id ?? `slide-${index + 1}`);
      return {
        id,
        title: String(item.title ?? ""),
        description: String(item.description ?? ""),
        buttonText: String(item.buttonText ?? ""),
        buttonPage: (item.buttonPage as string) ?? null,
        buttonHref: String(item.buttonHref ?? ""),
        imageUrl: String(item.imageUrl ?? ""),
      };
    })
    .filter((s) => s.id.trim() !== "");
  if (slides.length > 0) return slides;
  return [
    {
      id: "slide-1",
      title: "Удобная онлайн-запись",
      description: "Выберите услугу, специалиста и время в несколько кликов.",
      buttonText: "Подробнее",
      buttonPage: "booking",
      buttonHref: "",
      imageUrl: "",
    },
  ];
}

export function CoverV2ContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const slides = normalizeSlides(block.data.coverSlides);
  const updateData = (patch: Record<string, unknown>) =>
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  const updateSlides = (next: Slide[]) => updateData({ coverSlides: next });

  const [libraryImages, setLibraryImages] = useState<Array<{ id: number; url: string }>>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetSlideId, setUploadTargetSlideId] = useState<string | null>(null);
  const [openLibraryForSlideId, setOpenLibraryForSlideId] = useState<string | null>(null);
  const [expandedSlideIds, setExpandedSlideIds] = useState<string[]>([]);
  const [pendingDeleteImage, setPendingDeleteImage] = useState<{ id: number; url: string } | null>(null);
  const [pendingDeleteImageSlideId, setPendingDeleteImageSlideId] = useState<string | null>(null);
  const [removingImageId, setRemovingImageId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const fetchLibrary = async (retry401 = true) => {
      const response = await fetch("/api/v1/crm/account/media?type=siteCover", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401 && retry401) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return fetchLibrary(false);
      }
      return response;
    };
    const load = async () => {
      setLibraryLoading(true);
      setLibraryError(null);
      try {
        const response = await fetchLibrary();
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          if (active) setLibraryError("Не удалось загрузить изображения.");
          return;
        }
        const itemsRaw = payload?.data?.items;
        const items = Array.isArray(itemsRaw)
          ? itemsRaw
              .map((item) => {
                if (!item || typeof item !== "object") return null;
                const record = item as Record<string, unknown>;
                const id = record.id;
                const url = record.url;
                if (typeof id !== "number" || !Number.isFinite(id)) return null;
                if (typeof url !== "string" || url.trim().length === 0) return null;
                return { id, url } as const;
              })
              .filter((item): item is { id: number; url: string } => item !== null)
          : [];
        if (!active) return;
        setLibraryImages(items);
      } catch {
        if (active) setLibraryError("Не удалось загрузить изображения.");
      } finally {
        if (active) setLibraryLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Keep expanded ids in sync with slides list.
    const ids = new Set(slides.map((s) => s.id));
    setExpandedSlideIds((prev) => {
      // Important: `slides` is a freshly normalized array each render, so this effect
      // can run very часто. Avoid state updates when nothing actually changed.
      let changed = false;
      const next: string[] = [];
      for (const id of prev) {
        if (ids.has(id)) next.push(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
    if (openLibraryForSlideId !== null && !ids.has(openLibraryForSlideId)) {
      setOpenLibraryForSlideId(null);
    }
    if (uploadTargetSlideId !== null && !ids.has(uploadTargetSlideId)) {
      setUploadTargetSlideId(null);
    }
    if (pendingDeleteImageSlideId !== null && !ids.has(pendingDeleteImageSlideId)) {
      setPendingDeleteImageSlideId(null);
      setPendingDeleteImage(null);
    }
  }, [slides, openLibraryForSlideId, uploadTargetSlideId, pendingDeleteImageSlideId]);

  const uploadToLibrary = async (file: File): Promise<{ id: number; url: string } | null> => {
    const formData = new FormData();
    formData.append("type", "siteCover");
    formData.append("file", file);
    setUploading(true);
    setLibraryError(null);
    try {
      const response = await fetch("/api/v1/crm/account/media", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.data?.url !== "string" || typeof payload?.data?.id !== "number") {
        setLibraryError("Не удалось загрузить изображение.");
        return null;
      }
      const next = { id: payload.data.id as number, url: String(payload.data.url) };
      setLibraryImages((prev) => [next, ...prev.filter((img) => img.id !== next.id && img.url !== next.url)]);
      return next;
    } catch {
      setLibraryError("Не удалось загрузить изображение.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const updateSlideById = (slideId: string, patch: Partial<Slide>) => {
    updateSlides(
      slides.map((s) => (s.id === slideId ? { ...s, ...patch } : s))
    );
  };

  const clearImageUrlEverywhere = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    updateSlides(
      slides.map((s) => (s.imageUrl === trimmed ? { ...s, imageUrl: "" } : s))
    );
  };

  const removeLibraryImage = async (image: { id: number; url: string }) => {
    setRemovingImageId(image.id);
    setLibraryError(null);
    try {
      const response = await fetch(`/api/v1/crm/account/media/${image.id}`, { method: "DELETE" });
      if (!response.ok) {
        setLibraryError("Не удалось удалить изображение.");
        return;
      }
      setLibraryImages((prev) => prev.filter((item) => item.id !== image.id));
      clearImageUrlEverywhere(image.url);
      setPendingDeleteImage(null);
      setPendingDeleteImageSlideId(null);
    } catch {
      setLibraryError("Не удалось удалить изображение.");
    } finally {
      setRemovingImageId(null);
    }
  };

  const isAllExpanded = expandedSlideIds.length > 0 && expandedSlideIds.length === slides.length;
  const toggleAllSlides = () => {
    setExpandedSlideIds(isAllExpanded ? [] : slides.map((s) => s.id));
  };

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          const targetId = uploadTargetSlideId;
          if (!file || !targetId) return;
          void (async () => {
            const uploaded = await uploadToLibrary(file);
            if (uploaded) updateSlideById(targetId, { imageUrl: uploaded.url });
          })();
          event.currentTarget.value = "";
        }}
      />


      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Слайды
        </div>
        <button
          type="button"
          onClick={toggleAllSlides}
          className="inline-flex items-center gap-2 px-0 py-2 text-xs text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
        >
          <span className="text-sm leading-none">{isAllExpanded ? "▴" : "▾"}</span>
          {isAllExpanded ? "Свернуть все" : "Развернуть все"}
        </button>
      </div>

      {slides.map((slide, index) => {
        const updateSlide = (patch: Partial<Slide>) => updateSlideById(slide.id, patch);
        const moveSlide = (dir: -1 | 1) => {
          const target = index + dir;
          if (target < 0 || target >= slides.length) return;
          const next = [...slides];
          [next[index], next[target]] = [next[target], next[index]];
          updateSlides(next);
        };
        const removeSlide = () => {
          if (slides.length <= 1) return;
          const slideId = slide.id;
          updateSlides(slides.filter((s) => s.id !== slideId));
          setExpandedSlideIds((prev) => prev.filter((id) => id !== slideId));
          if (openLibraryForSlideId === slideId) setOpenLibraryForSlideId(null);
          if (uploadTargetSlideId === slideId) setUploadTargetSlideId(null);
          if (pendingDeleteImageSlideId === slideId) {
            setPendingDeleteImageSlideId(null);
            setPendingDeleteImage(null);
          }
        };

        const isExpanded = expandedSlideIds.includes(slide.id);
        const toggleExpanded = () => {
          setExpandedSlideIds((prev) =>
            prev.includes(slide.id) ? prev.filter((id) => id !== slide.id) : [...prev, slide.id]
          );
        };

        return (
          <div
            key={slide.id}
            className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
          >
            <div className="flex items-center justify-between gap-2 p-4">
              <button
                type="button"
                onClick={toggleExpanded}
                className="flex min-w-0 items-center gap-2 text-left"
                aria-label={isExpanded ? "Свернуть слайд" : "Развернуть слайд"}
              >
                <span className="text-sm leading-none text-[color:var(--bp-muted)]">
                  {isExpanded ? "▴" : "▾"}
                </span>
                <span className="text-sm font-semibold">Слайд {index + 1}</span>
                {slide.title.trim() ? (
                  <span className="truncate text-sm text-[color:var(--bp-muted)]">
                    {slide.title.trim()}
                  </span>
                ) : null}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    moveSlide(-1);
                  }}
                  className="rounded-md border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    moveSlide(1);
                  }}
                  className="rounded-md border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  disabled={index === slides.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeSlide();
                  }}
                  className="rounded-md border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  disabled={slides.length <= 1}
                >
                  Удалить
                </button>
              </div>
            </div>

            {isExpanded ? (
            <div className="space-y-3 px-4 pb-4">
              {renderCoverFlatTextInput("Заголовок", slide.title, (value) => updateSlide({ title: value }))}
              <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                <div className="min-h-[32px] leading-4">Описание</div>
                <textarea
                  value={slide.description}
                  onChange={(event) => updateSlide({ description: event.target.value })}
                  rows={5}
                  className="mt-2 w-full rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                />
              </label>
              {renderCoverFlatTextInput("Текст кнопки", slide.buttonText, (value) => updateSlide({ buttonText: value }))}

              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Страница кнопки
                </div>
                <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
                  <select
                    value={slide.buttonPage ?? ""}
                    onChange={(event) =>
                      updateSlide({ buttonPage: event.target.value || null, buttonHref: "" })
                    }
                    className="w-full appearance-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
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
                    <option value="">Не выбрано</option>
                    {PAGE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {PAGE_LABELS[key]}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                    ▾
                  </span>
                </div>
              </label>

              {renderCoverFlatTextInput("Ссылка кнопки (внешняя)", slide.buttonHref, (value) =>
                updateSlide({ buttonHref: value, buttonPage: null })
              )}

              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Изображение слайда
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-32 overflow-hidden rounded-md bg-[color:var(--bp-base)]">
                    {slide.imageUrl ? (
                      <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--bp-muted)]">
                        Нет
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    {slide.imageUrl ? "Изображение выбрано" : "Изображение не выбрано"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadTargetSlideId(slide.id);
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                    className="inline-flex h-9 items-center justify-center rounded-[4px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm disabled:opacity-60"
                  >
                    {uploading ? "Загрузка..." : "Загрузить файл"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenLibraryForSlideId((prev) => (prev === slide.id ? null : slide.id))
                    }
                    className="inline-flex h-9 items-center justify-center rounded-[4px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm"
                  >
                    Выбрать из загруженных
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSlide({ imageUrl: "" })}
                    disabled={!slide.imageUrl}
                    className="inline-flex h-9 items-center justify-center rounded-[4px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm disabled:opacity-60"
                  >
                    Убрать
                  </button>
                </div>

                {openLibraryForSlideId === slide.id && libraryError ? (
                  <div className="text-xs text-[#c2410c]">{libraryError}</div>
                ) : null}
                {openLibraryForSlideId === slide.id && libraryLoading ? (
                  <div className="text-xs text-[color:var(--bp-muted)]">Загрузка изображений...</div>
                ) : null}

                {openLibraryForSlideId === slide.id && libraryImages.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                    {libraryImages.map((image) => {
                      const isSelected = slide.imageUrl === image.url;
                      const isPendingDelete =
                        pendingDeleteImage?.id === image.id && pendingDeleteImageSlideId === slide.id;
                      return (
                        <div
                          key={image.id}
                          className={`relative overflow-hidden rounded-lg border bg-[color:var(--bp-paper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bp-save-close,var(--bp-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bp-paper)] ${
                            isSelected
                              ? "border-[color:var(--bp-save-close,var(--bp-accent))]"
                              : "border-[color:var(--bp-stroke)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              updateSlide({ imageUrl: image.url });
                              setOpenLibraryForSlideId(null);
                            }}
                            className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bp-save-close,var(--bp-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bp-paper)]"
                            disabled={removingImageId === image.id || isPendingDelete}
                            aria-label="Выбрать изображение"
                          >
                            <div className="flex aspect-[16/10] w-full items-center justify-center bg-[color:var(--bp-base)]">
                              <img src={image.url} alt="" className="h-full w-full object-cover" />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (isPendingDelete) {
                                setPendingDeleteImage(null);
                                setPendingDeleteImageSlideId(null);
                                return;
                              }
                              setPendingDeleteImage(image);
                              setPendingDeleteImageSlideId(slide.id);
                            }}
                            disabled={removingImageId === image.id}
                            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[11px] text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)] disabled:opacity-60"
                            aria-label="Удалить изображение"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M6 6l1 16h10l1-16" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

              </div>
            </div>
            ) : null}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => {
          const slideId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          updateSlides([
            ...slides,
            {
              id: slideId,
              title: "Новый слайд",
              description: "Добавьте описание слайда",
              buttonText: "Подробнее",
              buttonPage: "booking",
              buttonHref: "",
              imageUrl: "",
            },
          ]);
        }}
        className="w-full rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm font-semibold"
      >
        Добавить слайд
      </button>
      {pendingDeleteImage && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4"
              onClick={() => {
                if (removingImageId !== null) return;
                setPendingDeleteImage(null);
                setPendingDeleteImageSlideId(null);
              }}
            >
              <div
                className="w-full max-w-[460px] rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-lg"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="text-base font-semibold">
                  Вы уверены, что хотите удалить изображение?
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingDeleteImage(null);
                      setPendingDeleteImageSlideId(null);
                    }}
                    className="rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-xs"
                    disabled={removingImageId !== null}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeLibraryImage(pendingDeleteImage)}
                    className="rounded-md bg-[#dc2626] px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                    disabled={removingImageId !== null}
                  >
                    {removingImageId === pendingDeleteImage.id ? "Удаление..." : "Удалить"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

