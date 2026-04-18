import { SOCIAL_LABELS } from "@/features/site-builder/crm/site-client-core";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import { renderCoverFlatTextInput } from "@/features/site-builder/crm/cover-settings";
import type { CrmPanelCtx } from "../../runtime/contracts";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SocialKey = keyof typeof SOCIAL_LABELS;

type ImageSource = {
  type?: string;
  url?: string;
};

function resolveSocialHrefByKey(accountProfile: CrmPanelCtx["accountProfile"], key: SocialKey): string | null {
  const rawValue =
    key === "website"
      ? accountProfile.websiteUrl
      : key === "instagram"
        ? accountProfile.instagramUrl
        : key === "whatsapp"
          ? accountProfile.whatsappUrl
          : key === "telegram"
            ? accountProfile.telegramUrl
            : key === "max"
              ? accountProfile.maxUrl
              : key === "vk"
                ? accountProfile.vkUrl
                : key === "viber"
                  ? accountProfile.viberUrl
                  : key === "pinterest"
                    ? accountProfile.pinterestUrl
                    : key === "facebook"
                      ? accountProfile.facebookUrl
                      : key === "tiktok"
                        ? accountProfile.tiktokUrl
                        : key === "youtube"
                          ? accountProfile.youtubeUrl
                          : key === "twitter"
                            ? accountProfile.twitterUrl
                            : key === "dzen"
                              ? accountProfile.dzenUrl
                              : accountProfile.okUrl;
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!trimmed) return null;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

export function CoverV1ContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const updateData = (patch: Record<string, unknown>) =>
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));

  const [libraryImages, setLibraryImages] = useState<Array<{ id: number; url: string }>>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openLibrary, setOpenLibrary] = useState(false);
  const [pendingDeleteImage, setPendingDeleteImage] = useState<{ id: number; url: string } | null>(null);
  const [removingImageId, setRemovingImageId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [customSelectedId, setCustomSelectedId] = useState<number | null>(null);

  const imageSource: ImageSource = (block.data.imageSource as ImageSource) ?? { type: "none" };
  const previewUrl =
    imageSource.type === "custom"
      ? (imageSource.url && imageSource.url.trim().length > 0 ? imageSource.url : "")
      : imageSource.type === "account"
        ? (ctx.branding.coverUrl ?? "")
        : "";

  const setSource = (next: ImageSource) => {
    updateData({ imageSource: next });
  };

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
    if (imageSource.type !== "custom") return;
    const currentUrl = typeof imageSource.url === "string" ? imageSource.url.trim() : "";
    if (currentUrl.length > 0) return;
    const first = libraryImages[0];
    if (!first) return;
    if (customSelectedId !== first.id) setCustomSelectedId(first.id);
    setSource({ type: "custom", url: first.url });
  }, [libraryImages, customSelectedId, imageSource.type, imageSource.url]);

  const uploadToLibrary = async (file: File): Promise<{ id: number; url: string } | null> => {
    const formData = new FormData();
    formData.append("type", "siteCover");
    formData.append("file", file);
    setUploading(true);
    setLibraryError(null);
    try {
      const response = await fetch("/api/v1/crm/account/media", { method: "POST", body: formData });
      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.data?.url !== "string" || typeof payload?.data?.id !== "number") {
        setLibraryError("Не удалось загрузить изображение.");
        return null;
      }
      const next = { id: payload.data.id as number, url: String(payload.data.url) };
      setLibraryImages((prev) => [next, ...prev.filter((img) => img.id !== next.id && img.url !== next.url)]);
      setCustomSelectedId(next.id);
      setSource({ type: "custom", url: next.url });
      return next;
    } catch {
      setLibraryError("Не удалось загрузить изображение.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const selectCustomImage = (next: { id: number; url: string }) => {
    if (customSelectedId !== next.id) setCustomSelectedId(next.id);
    setSource({ type: "custom", url: next.url });
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
      if (imageSource.type === "custom" && imageSource.url === image.url) {
        setSource({ type: "none" });
      }
      setPendingDeleteImage(null);
    } catch {
      setLibraryError("Не удалось удалить изображение.");
    } finally {
      setRemovingImageId(null);
    }
  };

  const availableSecondarySources = (Object.keys(SOCIAL_LABELS) as SocialKey[]).filter((key) =>
    Boolean(resolveSocialHrefByKey(ctx.accountProfile, key))
  );
  const showSecondaryButton =
    block.data.showSecondaryButton === true || block.data.showSecondaryButton === "true";
  const secondaryButtonSource = (block.data.secondaryButtonSource as string) ?? "";
  const effectiveSecondaryButtonSource = secondaryButtonSource === "auto" ? "" : secondaryButtonSource;
  const selectedSecondarySourceMissing =
    effectiveSecondaryButtonSource !== "" &&
    !(availableSecondarySources as string[]).includes(effectiveSecondaryButtonSource);

  useEffect(() => {
    if (secondaryButtonSource === "auto") {
      updateData({ secondaryButtonSource: "" });
    }
  }, [secondaryButtonSource]);

  return (
    <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
      {renderCoverFlatTextInput(
        "Заголовок",
        (block.data.title as string) ?? "",
        (value) => updateData({ title: value })
      )}
      {renderCoverFlatTextInput(
        "Подзаголовок",
        (block.data.subtitle as string) ?? "",
        (value) => updateData({ subtitle: value })
      )}
      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        <div className="min-h-[32px] leading-4">Описание</div>
        <textarea
          value={(block.data.description as string) ?? ""}
          onChange={(event) => updateData({ description: event.target.value })}
          rows={5}
          className="mt-2 w-full rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
        />
      </label>

      <div className="grid grid-cols-[auto,1fr] items-end gap-4">
        <FlatCheckbox
          checked={Boolean(block.data.showButton)}
          onChange={(checked) => updateData({ showButton: checked })}
          label="Показывать кнопку записи"
        />
        {renderCoverFlatTextInput(
          "Текст кнопки",
          (block.data.buttonText as string) ?? "",
          (value) => updateData({ buttonText: value })
        )}
      </div>

      <FlatCheckbox
        checked={showSecondaryButton}
        onChange={(checked) => updateData({ showSecondaryButton: checked })}
        label="Показывать вторую кнопку (соцсети)"
      />
      {showSecondaryButton && (
        <>
          {renderCoverFlatTextInput(
            "Текст второй кнопки",
            (block.data.secondaryButtonText as string) ?? "Наши соцсети",
            (value) => updateData({ secondaryButtonText: value })
          )}
          {renderCoverFlatTextInput(
            "Ссылка кнопки (внешняя)",
            (block.data.secondaryButtonHref as string) ?? "",
            (value) => updateData({ secondaryButtonHref: value })
          )}
          <label className="block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
              Ссылка второй кнопки
            </div>
            <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
              <select
                value={effectiveSecondaryButtonSource}
                onChange={(event) => updateData({ secondaryButtonSource: event.target.value })}
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
                {selectedSecondarySourceMissing && (
                  <option value={effectiveSecondaryButtonSource}>
                    {effectiveSecondaryButtonSource} (не заполнено в профиле)
                  </option>
                )}
                {availableSecondarySources.map((key) => (
                  <option key={key} value={key}>
                    {SOCIAL_LABELS[key]}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                ▾
              </span>
            </div>
          </label>
          {availableSecondarySources.length === 0 && (
            <div className="text-xs text-[color:var(--bp-muted)]">
              В профиле аккаунта нет заполненных ссылок для второй кнопки.
            </div>
          )}
        </>
      )}

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Изображение слайда
        </div>
        <div className="relative border-b border-[color:var(--bp-stroke)] pb-1">
          <select
            value={imageSource.type ?? "none"}
            onChange={(event) => {
              const nextType = event.target.value;
              if (nextType === "custom") {
                setSource({ type: "custom", url: imageSource.url });
              } else {
                setSource({ type: nextType });
              }
            }}
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
            <option value="none">Не выбрано</option>
            <option value="account">Профиль аккаунта</option>
            <option value="custom">Своё изображение</option>
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
            ▾
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative h-20 w-32 overflow-hidden rounded-md bg-[color:var(--bp-base)]">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--bp-muted)]">
                Нет
              </div>
            )}
          </div>
          <div className="text-xs text-[color:var(--bp-muted)]">
            {previewUrl ? "Изображение выбрано" : "Изображение не выбрано"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void uploadToLibrary(file);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm disabled:opacity-60"
          >
            {uploading ? "Загрузка..." : "Загрузить файл"}
          </button>
          <button
            type="button"
            onClick={() => setOpenLibrary((prev) => !prev)}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm"
          >
            Выбрать из загруженных
          </button>
          <button
            type="button"
            onClick={() => setSource({ type: "none" })}
            disabled={!previewUrl}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm disabled:opacity-60"
          >
            Убрать
          </button>
        </div>

        {openLibrary && libraryError ? (
          <div className="text-xs text-[#c2410c]">{libraryError}</div>
        ) : null}
        {openLibrary && libraryLoading ? (
          <div className="text-xs text-[color:var(--bp-muted)]">Загрузка изображений...</div>
        ) : null}

        {openLibrary && libraryImages.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
            {libraryImages.map((image) => {
              const isSelected = imageSource.type === "custom" && imageSource.url === image.url;
              const isPendingDelete = pendingDeleteImage?.id === image.id;
              return (
                <div
                  key={image.id}
                  className={`relative rounded-lg border bg-[color:var(--bp-paper)] ${
                    isSelected
                      ? "border-[color:var(--bp-save-close,var(--bp-accent))]"
                      : "border-[color:var(--bp-stroke)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectCustomImage(image)}
                    className="block w-full"
                    disabled={removingImageId === image.id || isPendingDelete}
                    aria-label="Выбрать изображение"
                  >
                    <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-[inherit] bg-[color:var(--bp-base)]">
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDeleteImage((prev) => (prev?.id === image.id ? null : image));
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
      {pendingDeleteImage && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4"
              onClick={() => {
                if (removingImageId !== null) return;
                setPendingDeleteImage(null);
              }}
            >
              <div
                className="w-full max-w-[460px] rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-lg"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="text-base font-semibold leading-5">
                  Вы уверены, что хотите удалить изображение?
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteImage(null)}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-xs"
                    disabled={removingImageId !== null}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeLibraryImage(pendingDeleteImage)}
                    className="inline-flex h-8 items-center justify-center rounded-md bg-[#dc2626] px-3 text-xs font-medium text-white disabled:opacity-60"
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
