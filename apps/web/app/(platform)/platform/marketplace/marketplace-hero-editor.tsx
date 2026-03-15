"use client";

import { useMemo, useState } from "react";
import {
  HERO_SETTING_KEY,
  HeroConfig,
  HeroLinkType,
  HeroSlide,
  isSlideReady,
} from "@/lib/marketplace-hero";

type AccountOption = { id: number; name: string; slug: string };
type LocationOption = { id: number; name: string; accountId: number };
type ServiceOption = { id: number; name: string; accountId: number };
type SpecialistOption = { id: number; label: string; accountId: number };

type MarketplaceHeroEditorProps = {
  initialConfig: HeroConfig;
  accounts: AccountOption[];
  locations: LocationOption[];
  services: ServiceOption[];
  specialists: SpecialistOption[];
};

type HeroSectionKey = "main" | "sideTop" | "sideBottom";

const MAIN_COUNT = 6;
const SIDE_COUNT = 3;

const LINK_TYPES: Array<{ value: HeroLinkType; label: string }> = [
  { value: "ai_assistant", label: "AI‑ассистент" },
  { value: "account", label: "Аккаунт (салон)" },
  { value: "location", label: "Локация (филиал)" },
  { value: "specialist", label: "Мастер" },
  { value: "service", label: "Услуга" },
  { value: "collection", label: "Подборка/рейтинг" },
  { value: "url", label: "Внешняя ссылка" },
];

const collectionPresets = [
  { key: "top-rated", label: "Топ по рейтингу" },
  { key: "trending", label: "Тренды" },
  { key: "express", label: "Экспресс‑записи" },
  { key: "ai-picks", label: "Подборки AI" },
];

function createEmptySlide(index: number): HeroSlide {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `slide_${Date.now()}_${index}_${Math.random().toString(16).slice(2)}`;
  return {
    id,
    isActive: false,
    tag: "",
    title: "",
    subtitle: "",
    description: "",
    ctaLabel: "",
    imageUrl: "",
    linkType: "ai_assistant",
    accountId: null,
    entityId: null,
    url: "",
    collectionKey: "",
  };
}

function ensureCount(slides: HeroSlide[], count: number) {
  const next = slides.slice(0, count);
  if (next.length < count) {
    for (let i = next.length; i < count; i += 1) {
      next.push(createEmptySlide(i));
    }
  }
  return next;
}

function seedConfig(config: HeroConfig) {
  return {
    main: ensureCount(config.main ?? [], MAIN_COUNT),
    sideTop: ensureCount(config.sideTop ?? [], SIDE_COUNT),
    sideBottom: ensureCount(config.sideBottom ?? [], SIDE_COUNT),
    settings: {
      autoplayMainSec:
        config.settings?.autoplayMainSec ??
        (config.settings?.autoplayMainMs
          ? Math.max(2, Math.round(config.settings.autoplayMainMs / 1000))
          : 6),
      autoplaySideSec:
        config.settings?.autoplaySideSec ??
        (config.settings?.autoplaySideMs
          ? Math.max(2, Math.round(config.settings.autoplaySideMs / 1000))
          : 6),
      showDotsMain: config.settings?.showDotsMain ?? true,
      showDotsSide: config.settings?.showDotsSide ?? true,
      pauseOnHover: config.settings?.pauseOnHover ?? true,
    },
  };
}

export default function MarketplaceHeroEditor({
  initialConfig,
  accounts,
  locations,
  services,
  specialists,
}: MarketplaceHeroEditorProps) {
  const [hero, setHero] = useState<HeroConfig>(() => seedConfig(initialConfig));
  const [activeSection, setActiveSection] = useState<
    keyof HeroConfig | "settings"
  >("main");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const accountById = useMemo(
    () => new Map(accounts.map((item) => [item.id, item])),
    [accounts]
  );

  const locationOptions = useMemo(
    () =>
      locations.map((item) => ({
        id: item.id,
        label: `${item.name} · ${accountById.get(item.accountId)?.name ?? "Аккаунт"}`,
      })),
    [locations, accountById]
  );

  const serviceOptions = useMemo(
    () =>
      services.map((item) => ({
        id: item.id,
        label: `${item.name} · ${accountById.get(item.accountId)?.name ?? "Аккаунт"}`,
      })),
    [services, accountById]
  );

  const specialistOptions = useMemo(
    () =>
      specialists.map((item) => ({
        id: item.id,
        label: `${item.label} · ${accountById.get(item.accountId)?.name ?? "Аккаунт"}`,
      })),
    [specialists, accountById]
  );

  const validation = useMemo(() => {
    const sections = [
      { key: "main", label: "Большая карточка", count: MAIN_COUNT },
      { key: "sideTop", label: "Маленькая карточка 1", count: SIDE_COUNT },
      { key: "sideBottom", label: "Маленькая карточка 2", count: SIDE_COUNT },
    ] as const;

    const errors: string[] = [];
    let assistantCount = 0;

    sections.forEach((section) => {
      const slides = hero[section.key];
      const ready = slides.filter((slide) => isSlideReady(slide));
      assistantCount += slides.filter(
        (slide) => slide.isActive && slide.linkType === "ai_assistant"
      ).length;
      if (ready.length < section.count) {
        errors.push(
          `${section.label}: заполнено ${ready.length} из ${section.count}`
        );
      }
    });

    if (assistantCount === 0) {
      errors.push("Добавьте хотя бы один слайд с рекламой AI‑ассистента.");
    }

    return errors;
  }, [hero]);

  const updateSlide = (
    section: HeroSectionKey,
    index: number,
    patch: Partial<HeroSlide>
  ) => {
    setHero((prev) => {
      const next = { ...prev };
      const slides = [...(next[section] ?? [])] as HeroSlide[];
      slides[index] = { ...slides[index], ...patch };
      next[section] = slides;
      return next;
    });
  };

  const updateSettings = (patch: Partial<HeroConfig["settings"]>) => {
    setHero((prev) => ({
      ...prev,
      settings: { ...(prev.settings ?? {}), ...patch },
    }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            {
              key: HERO_SETTING_KEY,
              valueJson: hero,
            },
          ],
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setMessage(payload?.error?.message ?? "Не удалось сохранить витрину");
        return;
      }
      setMessage("Витрина сохранена");
    } catch {
      setMessage("Не удалось сохранить витрину");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Карточки витрины</h2>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Большая карточка содержит 6 слайдов, две маленькие — по 3. Карточки
            должны быть кликабельными и вести на нужные страницы.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "Сохранение..." : "Сохранить витрину"}
        </button>
      </div>

      {validation.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold">Что нужно заполнить:</div>
          <ul className="mt-2 space-y-1">
            {validation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 text-sm text-[color:var(--bp-muted)]">{message}</div>
      ) : null}

      <div className="mt-6">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-2">
          {[
            { key: "main", label: "Большая карточка (6)" },
            { key: "sideTop", label: "Маленькая карточка 1 (3)" },
            { key: "sideBottom", label: "Маленькая карточка 2 (3)" },
            { key: "settings", label: "Настройки" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSection(tab.key as keyof HeroConfig)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeSection === tab.key
                  ? "bg-white text-[color:var(--bp-ink)] shadow-[var(--bp-shadow)]"
                  : "text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeSection === "main" ? (
            <HeroSectionEditor
              title="Большая карточка"
              slides={hero.main}
              onChange={(index, patch) => updateSlide("main", index, patch)}
              accounts={accounts}
              locations={locationOptions}
              services={serviceOptions}
              specialists={specialistOptions}
              uploading={uploading}
              setUploading={setUploading}
            />
          ) : null}
          {activeSection === "sideTop" ? (
            <HeroSectionEditor
              title="Маленькая карточка 1"
              slides={hero.sideTop}
              onChange={(index, patch) => updateSlide("sideTop", index, patch)}
              accounts={accounts}
              locations={locationOptions}
              services={serviceOptions}
              specialists={specialistOptions}
              uploading={uploading}
              setUploading={setUploading}
            />
          ) : null}
          {activeSection === "sideBottom" ? (
            <HeroSectionEditor
              title="Маленькая карточка 2"
              slides={hero.sideBottom}
              onChange={(index, patch) => updateSlide("sideBottom", index, patch)}
              accounts={accounts}
              locations={locationOptions}
              services={serviceOptions}
              specialists={specialistOptions}
              uploading={uploading}
              setUploading={setUploading}
            />
          ) : null}
          {activeSection === "settings" ? (
            <HeroSettingsEditor
              settings={hero.settings ?? {}}
              onChange={updateSettings}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HeroSectionEditor({
  title,
  slides,
  onChange,
  accounts,
  locations,
  services,
  specialists,
  uploading,
  setUploading,
}: {
  title: string;
  slides: HeroSlide[];
  onChange: (index: number, patch: Partial<HeroSlide>) => void;
  accounts: AccountOption[];
  locations: Array<{ id: number; label: string }>;
  services: Array<{ id: number; label: string }>;
  specialists: Array<{ id: number; label: string }>;
  uploading: Record<string, boolean>;
  setUploading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-4 grid gap-3">
        {slides.map((slide, index) => (
          <SlideEditor
            key={slide.id}
            index={index}
            slide={slide}
            onChange={(patch) => onChange(index, patch)}
            accounts={accounts}
            locations={locations}
            services={services}
            specialists={specialists}
            uploading={uploading}
            setUploading={setUploading}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

function SlideEditor({
  slide,
  index,
  onChange,
  accounts,
  locations,
  services,
  specialists,
  uploading,
  setUploading,
  defaultOpen,
}: {
  slide: HeroSlide;
  index: number;
  onChange: (patch: Partial<HeroSlide>) => void;
  accounts: AccountOption[];
  locations: Array<{ id: number; label: string }>;
  services: Array<{ id: number; label: string }>;
  specialists: Array<{ id: number; label: string }>;
  uploading: Record<string, boolean>;
  setUploading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  defaultOpen: boolean;
}) {
  const uploadImage = async (file: File) => {
    setUploading((prev) => ({ ...prev, [slide.id]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/platform/marketplace/hero-media", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Не удалось загрузить файл");
      }
      onChange({ imageUrl: payload.data?.url ?? "" });
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error ? error.message : "Не удалось загрузить файл"
      );
    } finally {
      setUploading((prev) => ({ ...prev, [slide.id]: false }));
    }
  };

  return (
    <details
      className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-4"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          Слайд {index + 1}
          {slide.title ? (
            <span className="text-xs font-normal text-[color:var(--bp-muted)]">
              · {slide.title}
            </span>
          ) : null}
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={slide.isActive}
            onChange={(event) => onChange({ isActive: event.target.checked })}
          />
          Активен
        </label>
      </summary>

      <div className="mt-3 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Тег
            <input
              value={slide.tag ?? ""}
              onChange={(event) => onChange({ tag: event.target.value })}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Заголовок
            <input
              value={slide.title}
              onChange={(event) => onChange({ title: event.target.value })}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Подзаголовок
            <input
              value={slide.subtitle ?? ""}
              onChange={(event) => onChange({ subtitle: event.target.value })}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Описание
            <textarea
              value={slide.description ?? ""}
              onChange={(event) => onChange({ description: event.target.value })}
              className="min-h-[90px] rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Текст кнопки
            <input
              value={slide.ctaLabel ?? ""}
              onChange={(event) => onChange({ ctaLabel: event.target.value })}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 text-xs text-[color:var(--bp-muted)]">
          Фото для карточки
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-xs font-semibold text-[color:var(--bp-ink)]">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadImage(file);
                }}
              />
              {uploading[slide.id] ? "Загрузка..." : "Загрузить фото"}
            </label>
            {slide.imageUrl ? (
              <button
                type="button"
                onClick={() => onChange({ imageUrl: "" })}
                className="text-xs text-[color:var(--bp-muted)] underline"
              >
                Удалить фото
              </button>
            ) : null}
          </div>
          {slide.imageUrl ? (
            <div className="mt-2 overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-white">
              <img
                src={slide.imageUrl}
                alt="Превью"
                className="h-48 w-full object-cover"
              />
            </div>
          ) : (
            <div className="mt-2 rounded-2xl border border-dashed border-[color:var(--bp-stroke)] bg-white px-3 py-6 text-center text-xs text-[color:var(--bp-muted)]">
              Фото не выбрано
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
          Тип перехода
          <select
            value={slide.linkType}
            onChange={(event) =>
              onChange({ linkType: event.target.value as HeroLinkType })
            }
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          >
            {LINK_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {slide.linkType === "account" || slide.linkType === "ai_assistant" ? (
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Аккаунт
            <select
              value={slide.accountId ?? ""}
              onChange={(event) =>
                onChange({
                  accountId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            >
              <option value="">Не выбран</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {slide.linkType === "location" ? (
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Локация
            <select
              value={slide.entityId ?? ""}
              onChange={(event) =>
                onChange({
                  entityId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            >
              <option value="">Не выбрано</option>
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {slide.linkType === "service" ? (
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Услуга
            <select
              value={slide.entityId ?? ""}
              onChange={(event) =>
                onChange({
                  entityId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            >
              <option value="">Не выбрано</option>
              {services.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {slide.linkType === "specialist" ? (
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Мастер
            <select
              value={slide.entityId ?? ""}
              onChange={(event) =>
                onChange({
                  entityId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            >
              <option value="">Не выбран</option>
              {specialists.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {slide.linkType === "collection" ? (
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Подборка
            <select
              value={slide.collectionKey ?? ""}
              onChange={(event) =>
                onChange({ collectionKey: event.target.value })
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            >
              <option value="">Не выбрано</option>
              {collectionPresets.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {slide.linkType === "url" ? (
          <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
            Ссылка
            <input
              value={slide.url ?? ""}
              onChange={(event) => onChange({ url: event.target.value })}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
        ) : null}
      </div>
    </details>
  );
}

function HeroSettingsEditor({
  settings,
  onChange,
}: {
  settings: NonNullable<HeroConfig["settings"]>;
  onChange: (patch: Partial<HeroConfig["settings"]>) => void;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-4">
      <div className="text-sm font-semibold">Настройки витрины</div>
      <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
        Настройте скорость перелистывания и отображение индикаторов.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
          Скорость большой карточки (сек)
          <input
            type="number"
            min={2}
            step={1}
            value={settings.autoplayMainSec ?? 6}
            onChange={(event) =>
              onChange({
                autoplayMainSec: Number(event.target.value) || 6,
              })
            }
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
          Скорость маленьких карточек (сек)
          <input
            type="number"
            min={2}
            step={1}
            value={settings.autoplaySideSec ?? 6}
            onChange={(event) =>
              onChange({
                autoplaySideSec: Number(event.target.value) || 6,
              })
            }
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.showDotsMain ?? true}
            onChange={(event) =>
              onChange({ showDotsMain: event.target.checked })
            }
          />
          Индикаторы на большой карточке
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.showDotsSide ?? true}
            onChange={(event) =>
              onChange({ showDotsSide: event.target.checked })
            }
          />
          Индикаторы на маленьких карточках
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.pauseOnHover ?? true}
            onChange={(event) =>
              onChange({ pauseOnHover: event.target.checked })
            }
          />
          Пауза при наведении
        </label>
      </div>
    </div>
  );
}
