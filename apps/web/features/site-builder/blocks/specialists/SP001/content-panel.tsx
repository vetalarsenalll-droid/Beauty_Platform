import type { CrmPanelCtx } from "../../runtime/contracts";
import type { SiteSpecialistItem as SpecialistItem } from "@/features/site-builder/shared/site-data";
import { FlatCheckbox } from "@/features/site-builder/crm/site-renderer";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function renderSectionTitle(title: string) {
  return (
    <div className="border-b border-[color:var(--bp-stroke)] pb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
      {title}
    </div>
  );
}

function renderFlatTextInput(
  label: string,
  value: string,
  onChange: (value: string) => void,
  placeholder?: string
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        />
      </div>
    </label>
  );
}

function renderFlatSelect(
  label: string,
  value: string,
  onChange: (value: string) => void,
  options: Array<{ value: string; label: string }>
) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
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
          {"\u25BE"}
        </span>
      </div>
    </label>
  );
}

function renderFlatEntityListEditor(ctx: CrmPanelCtx, updateData: (patch: Record<string, unknown>) => void) {
  const block = ctx.block;
  const mode = (block.data.mode as string) ?? "all";
  const selected = new Set<number>(Array.isArray(block.data.ids) ? (block.data.ids as number[]) : []);
  const locationId = typeof block.data.locationId === "number" ? block.data.locationId : null;
  const locationSpecialists = locationId
    ? ctx.specialists.filter((item) => item.locationIds.includes(locationId))
    : ctx.specialists;
  const locationSpecialistIds = new Set(locationSpecialists.map((item) => item.id));

  return (
    <div className="space-y-5">
      {renderFlatSelect(
        "Список локаций",
        String(locationId ?? ""),
        (value) => {
          const nextLocationId = value ? Number(value) : null;
          const nextLocationSpecialists = nextLocationId
            ? ctx.specialists.filter((item) => item.locationIds.includes(nextLocationId))
            : ctx.specialists;
          const nextLocationSpecialistIds = new Set(nextLocationSpecialists.map((item) => item.id));
          updateData({
            locationId: nextLocationId,
            ids: Array.from(selected).filter((id) => nextLocationSpecialistIds.has(id)),
          });
        },
        [
          { value: "", label: "Все локации" },
          ...ctx.locations.map((location) => ({
            value: String(location.id),
            label: location.name,
          })),
        ]
      )}
      {renderFlatSelect("Список специалистов", mode, (value) => updateData({ mode: value }), [
        { value: "all", label: "Все" },
        { value: "selected", label: "Выбранные" },
      ])}
      {mode === "selected" ? (
        <div className="border-b border-[color:var(--bp-stroke)] pb-2">
          <div className="pb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Выберите элементы
          </div>
          <div className="max-h-48 space-y-3 overflow-auto pr-2">
            {locationSpecialists.map((item) => {
              const checked = selected.has(item.id);
              return (
                <div key={item.id} className="border-b border-[color:var(--bp-stroke)] pb-3">
                  <FlatCheckbox
                    checked={checked}
                    onChange={(nextChecked) => {
                      const next = new Set(
                        Array.from(selected).filter((id) => locationSpecialistIds.has(id))
                      );
                      if (nextChecked) next.add(item.id);
                      else next.delete(item.id);
                      updateData({ ids: Array.from(next) });
                    }}
                    label={item.name}
                  />
                </div>
              );
            })}
            {locationSpecialists.length === 0 ? (
              <div className="pb-3 text-sm text-[color:var(--bp-muted)]">
                В выбранной локации нет специалистов.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SpecialistCardEditor({
  specialist,
  levels,
  onUpdate,
}: {
  specialist: SpecialistItem;
  levels: Array<{ id: number; name: string }>;
  onUpdate?: (specialist: SpecialistItem) => void;
}) {
  const [firstName, setFirstName] = useState(specialist.firstName ?? specialist.name.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(specialist.lastName ?? specialist.name.split(" ").slice(1).join(" "));
  const [levelId, setLevelId] = useState(specialist.levelId != null ? String(specialist.levelId) : "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [removingPhotoId, setRemovingPhotoId] = useState<number | null>(null);
  const [pendingDeletePhoto, setPendingDeletePhoto] = useState<{ id: number; url: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFirstName(specialist.firstName ?? specialist.name.split(" ")[0] ?? "");
    setLastName(specialist.lastName ?? specialist.name.split(" ").slice(1).join(" "));
    setLevelId(specialist.levelId != null ? String(specialist.levelId) : "");
  }, [specialist]);

  const applySpecialistUpdate = (patch: Partial<SpecialistItem>) => {
    onUpdate?.({
      ...specialist,
      ...patch,
      photoUrls: patch.photoUrls ?? specialist.photoUrls,
      photoItems: patch.photoItems ?? specialist.photoItems,
    });
  };

  const saveSpecialist = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/crm/specialists/${specialist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          levelId: levelId ? Number(levelId) : null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(payload?.error?.message ?? "Не удалось сохранить специалиста.");
        return;
      }
      const updated = payload?.data;
      const nextFirstName = String(updated?.firstName ?? firstName);
      const nextLastName = String(updated?.lastName ?? lastName);
      const nextName = [nextFirstName, nextLastName].filter(Boolean).join(" ") || specialist.name;
      applySpecialistUpdate({
        firstName: nextFirstName,
        lastName: nextLastName,
        name: nextName,
        levelId: updated?.level?.id ?? null,
        level: updated?.level?.name ?? null,
      });
      setMessage("Сохранено");
    } catch {
      setMessage("Не удалось сохранить специалиста.");
    } finally {
      setSaving(false);
    }
  };

  const setCoverPhoto = async (photo: { id: number; url: string }) => {
    setMessage(null);
    const response = await fetch(`/api/v1/crm/specialists/${specialist.id}/media/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCover: true }),
    });
    if (!response.ok) {
      setMessage("Не удалось выбрать фотографию.");
      return;
    }
    const existingItems = specialist.photoItems ?? (specialist.photoUrls ?? []).map((url, index) => ({
      id: -index - 1,
      url,
      isCover: url === specialist.coverUrl,
    }));
    const hasPhoto = existingItems.some((item) => item.id === photo.id);
    const nextItems = (hasPhoto ? existingItems : [{ ...photo, isCover: true }, ...existingItems]).map((item) => ({
      ...item,
      isCover: item.id === photo.id,
    }));
    applySpecialistUpdate({
      coverUrl: photo.url,
      photoUrls: nextItems.map((item) => item.url),
      photoItems: nextItems,
    });
    setLibraryOpen(false);
    setMessage("Фотография обновлена");
  };

  const removeCoverPhoto = async () => {
    const currentCover = (specialist.photoItems ?? []).find(
      (item) => item.id > 0 && item.url === specialist.coverUrl
    );
    if (currentCover) {
      setMessage(null);
      const response = await fetch(`/api/v1/crm/specialists/${specialist.id}/media/${currentCover.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCover: false }),
      });
      if (!response.ok) {
        setMessage("Не удалось убрать фотографию.");
        return;
      }
    }
    applySpecialistUpdate({
      coverUrl: null,
      photoItems: (specialist.photoItems ?? []).map((item) => ({ ...item, isCover: false })),
    });
    setMessage("Фотография убрана");
  };

  const deletePhoto = async (photo: { id: number; url: string }) => {
    setRemovingPhotoId(photo.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/crm/specialists/${specialist.id}/media/${photo.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setMessage("Не удалось удалить фотографию.");
        return;
      }
      const nextItems = (specialist.photoItems ?? []).filter((item) => item.id !== photo.id);
      const wasCover = specialist.coverUrl === photo.url;
      applySpecialistUpdate({
        coverUrl: wasCover ? null : specialist.coverUrl,
        photoUrls: nextItems.map((item) => item.url),
        photoItems: nextItems,
      });
      setPendingDeletePhoto(null);
      setMessage("Фотография удалена");
    } catch {
      setMessage("Не удалось удалить фотографию.");
    } finally {
      setRemovingPhotoId(null);
    }
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("type", "specialist");
      formData.append("file", file);
      const response = await fetch(`/api/v1/crm/specialists/${specialist.id}/media`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      const uploaded = payload?.data;
      if (!response.ok || typeof uploaded?.id !== "number" || typeof uploaded?.url !== "string") {
        setMessage(payload?.error?.message ?? "Не удалось загрузить фотографию.");
        return;
      }
      await setCoverPhoto({ id: uploaded.id, url: uploaded.url });
    } catch {
      setMessage("Не удалось загрузить фотографию.");
    } finally {
      setUploading(false);
    }
  };

  const photos = specialist.photoItems ?? (specialist.photoUrls ?? []).map((url, index) => ({
    id: -index - 1,
    url,
    isCover: url === specialist.coverUrl,
  }));

  return (
    <div className="space-y-4 border-t border-[color:var(--bp-stroke)] px-4 pb-4 pt-3">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          {renderFlatTextInput("Имя", firstName, setFirstName)}
          {renderFlatTextInput("Фамилия", lastName, setLastName)}
        </div>
        {renderFlatSelect("Уровень", levelId, setLevelId, [
          { value: "", label: "Без уровня" },
          ...levels.map((level) => ({ value: String(level.id), label: level.name })),
        ])}
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Фотография
        </div>
        <div className="flex items-center gap-3">
          <div className="h-20 w-28 overflow-hidden rounded-md bg-[color:var(--bp-surface)]">
            {specialist.coverUrl ? (
              <img src={specialist.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-[color:var(--bp-muted)]">
                Нет фото
              </div>
            )}
          </div>
          <div className="min-w-0 text-xs text-[color:var(--bp-muted)]">
            {specialist.coverUrl ? "Фото специалиста выбрано" : "Фото специалиста не выбрано"}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file) void uploadPhoto(file);
            event.currentTarget.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center justify-center rounded-[4px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm disabled:opacity-60"
          >
            {uploading ? "Загрузка..." : "Загрузить файл"}
          </button>
          <button
            type="button"
            onClick={() => setLibraryOpen((prev) => !prev)}
            className="inline-flex h-9 items-center justify-center rounded-[4px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm"
          >
            Выбрать из загруженных
          </button>
          <button
            type="button"
            onClick={() => void removeCoverPhoto()}
            disabled={!specialist.coverUrl}
            className="inline-flex h-9 items-center justify-center rounded-[4px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm disabled:opacity-60"
          >
            Убрать
          </button>
        </div>
        {libraryOpen ? (
          photos.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
              {photos.map((photo) => {
                const isPendingDelete = pendingDeletePhoto?.id === photo.id;
                return (
                  <div
                    key={`${photo.id}:${photo.url}`}
                    className={`relative overflow-hidden rounded-md border bg-[color:var(--bp-paper)] ${
                      photo.url === specialist.coverUrl
                        ? "border-[color:var(--bp-save-close,var(--bp-accent))]"
                        : "border-[color:var(--bp-stroke)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => photo.id > 0 && void setCoverPhoto(photo)}
                      disabled={photo.id < 0 || removingPhotoId === photo.id || isPendingDelete}
                      className="block w-full disabled:opacity-60"
                      title={photo.id < 0 ? "Для выбора нужна перезагрузка страницы" : "Выбрать фотографию"}
                    >
                      <img src={photo.url} alt="" className="aspect-[4/3] w-full object-cover" />
                    </button>
                    {photo.id > 0 ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingDeletePhoto((prev) => (prev?.id === photo.id ? null : photo));
                        }}
                        disabled={removingPhotoId === photo.id}
                        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[11px] text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)] disabled:opacity-60"
                        aria-label="Удалить фотографию"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M6 6l1 16h10l1-16" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-[color:var(--bp-muted)]">Загруженных фотографий пока нет.</div>
          )
        ) : null}
      </div>

      {message ? <div className="text-xs text-[color:var(--bp-muted)]">{message}</div> : null}
      <button
        type="button"
        onClick={saveSpecialist}
        disabled={saving}
        className="inline-flex h-10 w-full items-center justify-center rounded-[4px] bg-[color:var(--bp-save,#000)] px-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Сохранение..." : "Сохранить специалиста"}
      </button>
      {pendingDeletePhoto && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4"
              onClick={() => {
                if (removingPhotoId !== null) return;
                setPendingDeletePhoto(null);
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
                    onClick={() => setPendingDeletePhoto(null)}
                    className="rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-xs"
                    disabled={removingPhotoId !== null}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePhoto(pendingDeletePhoto)}
                    className="rounded-md bg-[#dc2626] px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                    disabled={removingPhotoId !== null}
                  >
                    {removingPhotoId === pendingDeletePhoto.id ? "Удаление..." : "Удалить"}
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

function SpecialistCardsEditor({ ctx }: { ctx: CrmPanelCtx }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {renderSectionTitle("Карточки специалистов")}
      <div className="space-y-3">
        {ctx.specialists.map((specialist) => {
          const expanded = expandedId === specialist.id;
          return (
            <div
              key={specialist.id}
              className="overflow-hidden rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
            >
              <button
                type="button"
                onClick={() => setExpandedId((prev) => (prev === specialist.id ? null : specialist.id))}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <div className="h-14 w-16 shrink-0 overflow-hidden rounded-md bg-[color:var(--bp-surface)]">
                  {specialist.coverUrl ? (
                    <img src={specialist.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[color:var(--bp-ink)]">{specialist.name}</div>
                  <div className="truncate text-xs text-[color:var(--bp-muted)]">
                    {specialist.level || "Без уровня"}
                  </div>
                </div>
                <span className="text-sm text-[color:var(--bp-muted)]">{expanded ? "\u25B4" : "\u25BE"}</span>
              </button>
              {expanded ? (
                <SpecialistCardEditor
                  specialist={specialist}
                  levels={ctx.specialistLevels}
                  onUpdate={ctx.updateSpecialistItem}
                />
              ) : null}
            </div>
          );
        })}
        {ctx.specialists.length === 0 ? (
          <div className="text-sm text-[color:var(--bp-muted)]">В CRM пока нет специалистов.</div>
        ) : null}
      </div>
    </div>
  );
}

export function SP001ContentPanel(ctx: CrmPanelCtx) {
  const block = ctx.block;
  const activeSectionId = ctx.activePanelSectionId;
  const inSection = (...ids: string[]) =>
    ids.length === 0 || activeSectionId === null || ids.includes(activeSectionId);

  const updateData = (patch: Record<string, unknown>) => {
    ctx.updateBlock(block.id, (prev) => ({
      ...prev,
      data: { ...(prev.data as Record<string, unknown>), ...patch },
    }));
  };

  return (
    <div className="space-y-8 px-1 pb-8 pt-1" onClick={(event) => event.stopPropagation()}>
      {inSection("text") && (
        <div className="space-y-5">
          {renderFlatTextInput(
            "Заголовок",
            String(block.data.title ?? ""),
            (value) => updateData({ title: value }),
            "Специалисты"
          )}
          {renderFlatTextInput(
            "Описание",
            String(block.data.subtitle ?? ""),
            (value) => updateData({ subtitle: value }),
            "Выберите специалиста"
          )}
        </div>
      )}

      {inSection("catalog") && (
        <div className="space-y-5">
          {renderFlatEntityListEditor(ctx, updateData)}
          <SpecialistCardsEditor ctx={ctx} />
        </div>
      )}
    </div>
  );
}
