
"use client";

import { useEffect, useState } from "react";
import {
  BLOCK_LABELS,
  BLOCK_VARIANTS,
  type BlockType,
  type SiteBlock,
  type SiteDraft,
  type SiteTheme,
  makeBlockId,
  normalizeDraft,
  type SitePageKey,
} from "@/lib/site-builder";
import { buildBookingLink } from "@/lib/booking-links";

type PublicPageData = {
  id: number;
  status: string;
  draftJson: SiteDraft;
  publishedVersionId: number | null;
};

type AccountInfo = {
  id: number;
  name: string;
  slug: string;
  publicSlug: string | null;
  timeZone: string;
};

type LocationItem = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  geo: { lat: number; lng: number } | null;
  coverUrl: string | null;
};

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: number;
  coverUrl: string | null;
};

type SpecialistItem = {
  id: number;
  name: string;
  level: string | null;
  locationIds: number[];
  coverUrl: string | null;
};

type PromoItem = {
  id: number;
  name: string;
  type: "PERCENT" | "FIXED";
  value: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  codes: string[];
};

type WorkPhotos = {
  locations: Array<{ entityId: string; url: string }>;
  services: Array<{ entityId: string; url: string }>;
  specialists: Array<{ entityId: string; url: string }>;
};

type AccountProfile = {
  description: string;
  phone?: string;
  email?: string;
  address?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  maxUrl?: string;
  vkUrl?: string;
  viberUrl?: string;
  pinterestUrl?: string;
};

type Branding = {
  logoUrl: string | null;
  coverUrl: string | null;
};

type SiteClientProps = {
  initialPublicPage: PublicPageData;
  account: AccountInfo;
  accountProfile: AccountProfile;
  branding: Branding;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];
  workPhotos: WorkPhotos;
};

const variantsLabel: Record<"v1" | "v2", string> = {
  v1: "Вариант 1",
  v2: "Вариант 2",
};

const PAGE_LABELS: Record<SitePageKey, string> = {
  home: "Главная",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  promos: "Промо/скидки",
};

const PAGE_KEYS = Object.keys(PAGE_LABELS) as SitePageKey[];

const THEME_FONTS = [
  { label: "Prata", heading: "Prata, serif", body: "Manrope, sans-serif" },
  { label: "Playfair", heading: "\"Playfair Display\", serif", body: "Manrope, sans-serif" },
  { label: "Manrope", heading: "Manrope, sans-serif", body: "Manrope, sans-serif" },
  { label: "Montserrat", heading: "Montserrat, sans-serif", body: "Montserrat, sans-serif" },
];

const defaultBlockData: Record<BlockType, Record<string, unknown>> = {
  cover: {
    title: "Салон красоты",
    subtitle: "Онлайн-запись и лучшие мастера рядом",
    description: "Выберите услугу, мастера и удобное время.",
    buttonText: "Записаться",
    showButton: true,
    align: "left",
    imageSource: { type: "account" },
  },
  about: {
    title: "О нас",
    text: "",
    showContacts: true,
  },
  locations: {
    title: "Локации",
    subtitle: "Выберите удобное место",
    mode: "all",
    ids: [],
    showButton: true,
    buttonText: "Записаться",
  },
  services: {
    title: "Услуги",
    subtitle: "Популярные услуги",
    mode: "all",
    ids: [],
    showPrice: true,
    showDuration: true,
    showButton: true,
    buttonText: "Записаться",
    locationId: null,
    specialistId: null,
  },
  specialists: {
    title: "Специалисты",
    subtitle: "Команда профессионалов",
    mode: "all",
    ids: [],
    locationId: null,
    showButton: true,
    buttonText: "Записаться",
  },
  works: {
    title: "Работы",
    subtitle: "Наши последние работы",
    source: "locations",
    mode: "all",
    ids: [],
  },
  reviews: {
    title: "Отзывы",
    subtitle: "Что говорят клиенты",
    limit: 6,
  },
  contacts: {
    title: "Контакты",
    subtitle: "Связаться с нами",
    locationId: null,
    showMap: false,
  },
  promos: {
    title: "Промо и скидки",
    subtitle: "Актуальные предложения и промокоды",
    mode: "all",
    ids: [],
    useCurrent: false,
    showButton: false,
    buttonText: "Записаться",
  },
};

function createBlock(type: BlockType): SiteBlock {
  return {
    id: makeBlockId(),
    type,
    variant: "v1",
    data: { ...defaultBlockData[type] },
  };
}

export default function SiteClient({
  initialPublicPage,
  account,
  accountProfile,
  branding,
  locations,
  services,
  specialists,
  promos,
  workPhotos,
}: SiteClientProps) {
  const [publicPage, setPublicPage] = useState(initialPublicPage);
  const [draft, setDraft] = useState<SiteDraft>(() =>
    normalizeDraft(initialPublicPage.draftJson)
  );
  const [activePage, setActivePage] = useState<SitePageKey>("home");
  const activeBlocks = draft.pages?.[activePage] ?? draft.blocks;
  const [selectedId, setSelectedId] = useState<string | null>(
    activeBlocks[0]?.id ?? null
  );
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBlocks.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !activeBlocks.some((block) => block.id === selectedId)) {
      setSelectedId(activeBlocks[0]?.id ?? null);
    }
  }, [activeBlocks, selectedId]);
  const [message, setMessage] = useState<string | null>(null);

  const selectedBlock = activeBlocks.find((block) => block.id === selectedId) ?? null;

  const updateBlock = (id: string, updater: (block: SiteBlock) => SiteBlock) => {
    setDraft((prev) => {
      const current = prev.pages?.[activePage] ?? prev.blocks;
      const nextBlocks = current.map((block) =>
        block.id === id ? updater(block) : block
      );
      const pages = { ...(prev.pages ?? {}), [activePage]: nextBlocks };
      const homeBlocks = pages.home ?? prev.blocks;
      return { ...prev, pages, blocks: homeBlocks };
    });
  };

  const updateTheme = (patch: Partial<SiteTheme>) => {
    setDraft((prev) => ({
      ...prev,
      theme: { ...prev.theme, ...patch },
    }));
  };

  const updateBlocks = (nextBlocks: SiteBlock[]) => {
    setDraft((prev) => {
      const pages = { ...(prev.pages ?? {}), [activePage]: nextBlocks };
      const homeBlocks = pages.home ?? prev.blocks;
      return { ...prev, pages, blocks: homeBlocks };
    });
  };

  const addBlock = (type: BlockType) => {
    const block = createBlock(type);
    updateBlocks([...(draft.pages?.[activePage] ?? draft.blocks), block]);
    setSelectedId(block.id);
  };

  const removeBlock = (id: string) => {
    updateBlocks(activeBlocks.filter((block) => block.id !== id));
    if (selectedId === id) {
      const next = activeBlocks.find((block) => block.id !== id);
      setSelectedId(next?.id ?? null);
    }
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    const idx = activeBlocks.findIndex((block) => block.id === id);
    if (idx < 0) return;
    const next = [...activeBlocks];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    updateBlocks(next);
  };

  const savePublic = async (publish: boolean) => {
    setSaving("public");
    setMessage(null);
    const payloadDraft = {
      ...draft,
      blocks: draft.pages?.home ?? draft.blocks,
    };
    const response = await fetch("/api/v1/crm/settings/public-page", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftJson: payloadDraft, publish }),
    });
    if (response.ok) {
      const data = await response.json();
      setPublicPage(data.data);
      setMessage(publish ? "Страница опубликована." : "Черновик сохранен.");
    } else {
      setMessage("Не удалось сохранить страницу.");
    }
    setSaving(null);
  };

  const publicUrl = account.publicSlug ? `/${account.publicSlug}` : null;

  const themeStyle: Record<string, string> = {
    "--bp-accent": draft.theme.accentColor,
    "--bp-surface": draft.theme.surfaceColor,
    "--bp-panel": draft.theme.panelColor,
    "--bp-ink": draft.theme.textColor,
    "--bp-muted": draft.theme.mutedColor,
    "--site-accent": draft.theme.accentColor,
    "--site-surface": draft.theme.surfaceColor,
    "--site-panel": draft.theme.panelColor,
    "--site-text": draft.theme.textColor,
    "--site-muted": draft.theme.mutedColor,
    "--site-font-heading": draft.theme.fontHeading,
    "--site-font-body": draft.theme.fontBody,
  };

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[640px] flex-col gap-6">
      {message && (
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Конструктор сайта</h2>
            <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
              Статус: {publicPage.status}
            </div>
            {publicUrl && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                Публичная ссылка: {publicUrl}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-5 py-2 text-sm"
              >
                Открыть сайт
              </a>
            )}
            <button
              type="button"
              onClick={() => savePublic(false)}
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-5 py-2 text-sm"
              disabled={saving === "public"}
            >
              {saving === "public" ? "Сохранение..." : "Сохранить черновик"}
            </button>
            <button
              type="button"
              onClick={() => savePublic(true)}
              className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
              disabled={saving === "public"}
            >
              Опубликовать
            </button>
          </div>
        </div>
      </section>

        <div className="grid h-full gap-6 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
          <aside className="space-y-4 overflow-y-auto pr-1">
            <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
              <div className="text-sm font-semibold">Страницы сайта</div>
              <div className="mt-3 flex flex-col gap-2">
                {PAGE_KEYS.map((pageKey) => {
                  const active = pageKey === activePage;
                  return (
                    <button
                      key={pageKey}
                      type="button"
                      onClick={() => setActivePage(pageKey)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        active
                          ? "border-[color:var(--bp-accent)] bg-white text-[color:var(--bp-ink)]"
                          : "border-[color:var(--bp-stroke)] bg-white text-[color:var(--bp-muted)]"
                      }`}
                    >
                      {PAGE_LABELS[pageKey]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
              <div className="text-sm font-semibold">Библиотека блоков</div>
              <div className="mt-3 flex flex-col gap-2">
              {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm"
                >
                  <span>{BLOCK_LABELS[type]}</span>
                  <span className="text-xs text-[color:var(--bp-muted)]">Добавить</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
            <div className="text-sm font-semibold">Структура страницы</div>
            <div className="mt-3 space-y-2">
              {activeBlocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    block.id === selectedId
                      ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-panel)]"
                      : "border-[color:var(--bp-stroke)] bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(block.id)}
                    className="flex w-full items-center justify-between"
                  >
                    <span>{BLOCK_LABELS[block.type]}</span>
                    <span className="text-xs text-[color:var(--bp-muted)]">
                      {index + 1}
                    </span>
                  </button>
                </div>
              ))}
              {activeBlocks.length === 0 && (
                <div className="text-xs text-[color:var(--bp-muted)]">
                  Блоков пока нет. Добавьте первый блок.
                </div>
              )}
            </div>
          </div>
        </aside>

        <main
          className="h-full overflow-y-auto rounded-[32px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-6 shadow-[var(--bp-shadow)]"
          style={{
            ...themeStyle,
            backgroundColor: draft.theme.surfaceColor,
            color: draft.theme.textColor,
            fontFamily: draft.theme.fontBody,
          }}
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            {activeBlocks.map((block) => (
              <BlockPreview
                key={block.id}
                block={block}
                account={account}
                accountProfile={accountProfile}
                branding={branding}
                locations={locations}
                services={services}
                specialists={specialists}
                promos={promos}
                workPhotos={workPhotos}
                theme={draft.theme}
                onSelect={() => setSelectedId(block.id)}
                isSelected={block.id === selectedId}
                onMoveUp={() => moveBlock(block.id, "up")}
                onMoveDown={() => moveBlock(block.id, "down")}
                onRemove={() => removeBlock(block.id)}
              />
            ))}
            {activeBlocks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] bg-white px-4 py-10 text-center text-sm text-[color:var(--bp-muted)]">
                Добавьте блок, чтобы начать собирать страницу.
              </div>
            )}
          </div>
        </main>

        <aside className="space-y-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
            <div className="text-sm font-semibold">Глобальные стили</div>
            <ThemeEditor theme={draft.theme} onChange={updateTheme} />
          </div>
          <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
            <div className="text-sm font-semibold">Настройки блока</div>
            {selectedBlock ? (
              <BlockEditor
                block={selectedBlock}
                locations={locations}
                services={services}
                specialists={specialists}
                promos={promos}
                onChange={(next) => updateBlock(selectedBlock.id, () => next)}
              />
            ) : (
              <div className="mt-3 text-xs text-[color:var(--bp-muted)]">
                Выберите блок, чтобы изменить настройки.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ThemeEditor({
  theme,
  onChange,
}: {
  theme: SiteTheme;
  onChange: (patch: Partial<SiteTheme>) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <label className="text-sm">
        Пара шрифтов
        <select
          value={`${theme.fontHeading}||${theme.fontBody}`}
          onChange={(event) => {
            const [heading, body] = event.target.value.split("||");
            onChange({ fontHeading: heading, fontBody: body });
          }}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
        >
          {THEME_FONTS.map((font) => (
            <option
              key={font.label}
              value={`${font.heading}||${font.body}`}
            >
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <ColorField
          label="Акцент"
          value={theme.accentColor}
          onChange={(value) => onChange({ accentColor: value })}
        />
        <ColorField
          label="Фон"
          value={theme.surfaceColor}
          onChange={(value) => onChange({ surfaceColor: value })}
        />
        <ColorField
          label="Панели"
          value={theme.panelColor}
          onChange={(value) => onChange({ panelColor: value })}
        />
        <ColorField
          label="Текст"
          value={theme.textColor}
          onChange={(value) => onChange({ textColor: value })}
        />
      </div>
      <label className="text-sm">
        Радиус блоков: {theme.radius}px
        <input
          type="range"
          min={8}
          max={40}
          step={2}
          value={theme.radius}
          onChange={(event) => onChange({ radius: Number(event.target.value) })}
          className="mt-2 w-full"
        />
      </label>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-6 rounded"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full text-xs text-[color:var(--bp-muted)] outline-none"
        />
      </div>
    </label>
  );
}

function BlockEditor({
  block,
  locations,
  services,
  specialists,
  promos,
  onChange,
}: {
  block: SiteBlock;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];
  onChange: (next: SiteBlock) => void;
}) {
  const updateData = (patch: Record<string, unknown>) => {
    onChange({ ...block, data: { ...block.data, ...patch } });
  };

  const variantOptions = BLOCK_VARIANTS[block.type];

  return (
    <div className="mt-4 space-y-4">
      <label className="text-sm">
        Вариант
        <select
          value={block.variant}
          onChange={(event) =>
            onChange({
              ...block,
              variant: event.target.value as "v1" | "v2",
            })
          }
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
        >
          {variantOptions.map((variant) => (
            <option key={variant} value={variant}>
              {variantsLabel[variant]}
            </option>
          ))}
        </select>
      </label>

      {block.type === "cover" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <FieldTextarea
            label="Описание"
            value={(block.data.description as string) ?? ""}
            onChange={(value) => updateData({ description: value })}
          />
          <label className="text-sm">
            Выравнивание
            <select
              value={(block.data.align as string) ?? "left"}
              onChange={(event) => updateData({ align: event.target.value })}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            >
              <option value="left">Слева</option>
              <option value="center">По центру</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showButton)}
              onChange={(event) => updateData({ showButton: event.target.checked })}
            />
            Показывать кнопку записи
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.buttonText as string) ?? ""}
            onChange={(value) => updateData({ buttonText: value })}
          />

          <CoverImageEditor
            data={block.data}
            locations={locations}
            services={services}
            specialists={specialists}
            onChange={updateData}
          />
        </>
      )}

      {block.type === "about" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldTextarea
            label="Текст"
            value={(block.data.text as string) ?? ""}
            onChange={(value) => updateData({ text: value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showContacts)}
              onChange={(event) => updateData({ showContacts: event.target.checked })}
            />
            Показывать контакты из профиля
          </label>
        </>
      )}

      {block.type === "locations" && (
        <EntityListEditor
          block={block}
          items={locations.map((item) => ({ id: item.id, label: item.name }))}
          onChange={updateData}
        />
      )}

      {block.type === "services" && (
        <>
          <EntityListEditor
            block={block}
            items={services.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />
          <label className="text-sm">
            Фильтр по локации
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Фильтр по специалисту
            <select
              value={String(block.data.specialistId ?? "")}
              onChange={(event) =>
                updateData({
                  specialistId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {specialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showPrice)}
              onChange={(event) => updateData({ showPrice: event.target.checked })}
            />
            Показывать цену
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showDuration)}
              onChange={(event) =>
                updateData({ showDuration: event.target.checked })
              }
            />
            Показывать длительность
          </label>
        </>
      )}

      {block.type === "specialists" && (
        <>
          <EntityListEditor
            block={block}
            items={specialists.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />
          <label className="text-sm">
            Локация для записи
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {block.type === "promos" && (
        <EntityListEditor
          block={block}
          items={promos.map((item) => ({ id: item.id, label: item.name }))}
          onChange={updateData}
        />
      )}

      {block.type === "works" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Источник работ
            <select
              value={(block.data.source as string) ?? "locations"}
              onChange={(event) => updateData({ source: event.target.value })}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            >
              <option value="locations">Локации</option>
              <option value="specialists">Специалисты</option>
              <option value="services">Услуги</option>
            </select>
          </label>
          <EntityListEditor
            block={block}
            items={
              (block.data.source as string) === "services"
                ? services.map((item) => ({ id: item.id, label: item.name }))
                : (block.data.source as string) === "specialists"
                  ? specialists.map((item) => ({ id: item.id, label: item.name }))
                  : locations.map((item) => ({ id: item.id, label: item.name }))
            }
            onChange={updateData}
          />
        </>
      )}

      {block.type === "reviews" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Количество отзывов
            <input
              type="number"
              min={1}
              max={24}
              value={Number(block.data.limit ?? 6)}
              onChange={(event) =>
                updateData({
                  limit: event.target.value ? Number(event.target.value) : 6,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            />
          </label>
        </>
      )}

      {block.type === "contacts" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Локация для контактов
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {block.type !== "cover" &&
        block.type !== "about" &&
        block.type !== "works" &&
        block.type !== "reviews" &&
        block.type !== "contacts" && (
          <>
            <FieldText
              label="Заголовок"
              value={(block.data.title as string) ?? ""}
              onChange={(value) => updateData({ title: value })}
            />
            <FieldText
              label="Подзаголовок"
              value={(block.data.subtitle as string) ?? ""}
              onChange={(value) => updateData({ subtitle: value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(block.data.showButton)}
                onChange={(event) =>
                  updateData({ showButton: event.target.checked })
                }
              />
              Показывать кнопку записи
            </label>
            <FieldText
              label="Текст кнопки"
              value={(block.data.buttonText as string) ?? "Записаться"}
              onChange={(value) => updateData({ buttonText: value })}
            />
          </>
        )}
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
      />
    </label>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
      />
    </label>
  );
}

function EntityListEditor({
  block,
  items,
  onChange,
}: {
  block: SiteBlock;
  items: Array<{ id: number; label: string }>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const mode = (block.data.mode as string) ?? "all";
  const selected = new Set<number>(
    Array.isArray(block.data.ids) ? (block.data.ids as number[]) : []
  );
  const useCurrent = Boolean(block.data.useCurrent);

  return (
    <>
      <FieldText
        label="Заголовок"
        value={(block.data.title as string) ?? ""}
        onChange={(value) => onChange({ title: value })}
      />
      <FieldText
        label="Подзаголовок"
        value={(block.data.subtitle as string) ?? ""}
        onChange={(value) => onChange({ subtitle: value })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={useCurrent}
          onChange={(event) => {
            const checked = event.target.checked;
            onChange({
              useCurrent: checked,
              mode: checked ? "selected" : mode,
              ids: checked ? [] : Array.from(selected),
            });
          }}
        />
        Использовать текущую страницу
      </label>
      <label className="text-sm">
        Отображение
        <select
          value={mode}
          onChange={(event) => onChange({ mode: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
        >
          <option value="all">Все</option>
          <option value="selected">Выбранные</option>
        </select>
      </label>
      {mode === "selected" && (
        <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-white p-3 text-xs">
          <div className="mb-2 text-[color:var(--bp-muted)]">Выберите элементы</div>
          <div className="max-h-48 space-y-2 overflow-auto pr-2">
            {items.map((item) => {
              const checked = selected.has(item.id);
              return (
                <label key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      onChange({ ids: Array.from(next) });
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
            {items.length === 0 && (
              <div className="text-[color:var(--bp-muted)]">
                Пока нет данных.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CoverImageEditor({
  data,
  locations,
  services,
  specialists,
  onChange,
}: {
  data: Record<string, unknown>;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const imageSource = (data.imageSource as { type?: string; id?: number; url?: string }) ?? {
    type: "account",
  };

  const setSource = (next: { type: string; id?: number | null; url?: string }) => {
    onChange({ imageSource: next });
  };

  return (
    <div className="space-y-3">
      <label className="text-sm">
        Источник обложки
        <select
          value={imageSource.type ?? "account"}
          onChange={(event) => setSource({ type: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
        >
          <option value="account">Профиль аккаунта</option>
          <option value="location">Локация</option>
          <option value="specialist">Специалист</option>
          <option value="service">Услуга</option>
          <option value="custom">Своя картинка (URL)</option>
          <option value="none">Без картинки</option>
        </select>
      </label>

      {imageSource.type === "location" && (
        <label className="text-sm">
          Локация
          <select
            value={String(imageSource.id ?? "")}
            onChange={(event) =>
              setSource({
                type: "location",
                id: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
          >
            <option value="">Не выбрано</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {imageSource.type === "specialist" && (
        <label className="text-sm">
          Специалист
          <select
            value={String(imageSource.id ?? "")}
            onChange={(event) =>
              setSource({
                type: "specialist",
                id: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
          >
            <option value="">Не выбрано</option>
            {specialists.map((specialist) => (
              <option key={specialist.id} value={specialist.id}>
                {specialist.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {imageSource.type === "service" && (
        <label className="text-sm">
          Услуга
          <select
            value={String(imageSource.id ?? "")}
            onChange={(event) =>
              setSource({
                type: "service",
                id: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
          >
            <option value="">Не выбрано</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {imageSource.type === "custom" && (
        <FieldText
          label="URL картинки"
          value={imageSource.url ?? ""}
          onChange={(value) => setSource({ type: "custom", url: value })}
        />
      )}
    </div>
  );
}

function BlockPreview({
  block,
  account,
  accountProfile,
  branding,
  locations,
  services,
  specialists,
  promos,
  workPhotos,
  theme,
  onSelect,
  isSelected,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  block: SiteBlock;
  account: AccountInfo;
  accountProfile: AccountProfile;
  branding: Branding;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];
  workPhotos: WorkPhotos;
  theme: SiteTheme;
  onSelect: () => void;
  isSelected: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const containerClass = `border ${
    isSelected ? "border-[color:var(--bp-accent)]" : "border-[color:var(--bp-stroke)]"
  } p-6 shadow-[var(--bp-shadow-soft)]`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="text-left"
    >
      <div
        className={`${containerClass} relative`}
        style={{
          borderRadius: theme.radius,
          backgroundColor: theme.panelColor,
          color: theme.textColor,
          fontFamily: theme.fontBody,
        }}
      >
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMoveUp();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--bp-stroke)] bg-white text-xs text-[color:var(--bp-ink)] shadow-sm"
            aria-label="Переместить вверх"
            title="Вверх"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onMoveDown();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--bp-stroke)] bg-white text-xs text-[color:var(--bp-ink)] shadow-sm"
            aria-label="Переместить вниз"
            title="Вниз"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white text-xs text-red-600 shadow-sm"
            aria-label="Удалить блок"
            title="Удалить"
          >
            ×
          </button>
        </div>
          {renderBlock(
            block,
            account,
            accountProfile,
            branding,
            locations,
            services,
            specialists,
            promos,
            workPhotos
          )}
      </div>
    </div>
  );
}

function renderBlock(
  block: SiteBlock,
  account: AccountInfo,
  accountProfile: AccountProfile,
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  promos: PromoItem[],
  workPhotos: WorkPhotos
) {
  switch (block.type) {
    case "cover":
      return renderCover(block, account, branding, locations, services, specialists);
    case "about":
      return renderAbout(block, account, accountProfile);
    case "locations":
      return renderLocations(block, account, locations);
    case "services":
      return renderServices(block, account, services);
    case "specialists":
      return renderSpecialists(block, account, specialists);
    case "promos":
      return renderPromos(block, promos);
    case "works":
      return renderWorks(block, workPhotos);
    case "reviews":
      return renderReviews(block);
    case "contacts":
      return renderContacts(block, account, accountProfile, locations);
    default:
      return null;
  }
}

function resolveEntities<T extends { id: number }>(
  mode: string,
  ids: number[],
  items: T[]
) {
  if (mode === "selected" && ids.length > 0) {
    const set = new Set(ids);
    return items.filter((item) => set.has(item.id));
  }
  return items;
}

function renderCover(
  block: SiteBlock,
  account: AccountInfo,
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[]
) {
  const data = block.data as Record<string, unknown>;
  const title = (data.title as string) || account.name;
  const subtitle = (data.subtitle as string) || "";
  const description = (data.description as string) || "";
  const align = (data.align as string) === "center" ? "center" : "left";
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const imageSource = (data.imageSource as { type?: string; id?: number; url?: string }) ?? {
    type: "account",
  };
  const imageUrl = resolveCoverImage(imageSource, branding, locations, services, specialists);

  return (
    <div className={`grid gap-6 ${imageUrl ? "md:grid-cols-[1.2fr_1fr]" : ""}`}>
      <div className={align === "center" ? "text-center" : "text-left"}>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Сайт {account.name}
        </div>
        <h2
          className="mt-3 text-3xl font-semibold"
          style={{ fontFamily: "var(--site-font-heading)" }}
        >
          {title}
        </h2>
        {subtitle && <p className="mt-2 text-lg text-[color:var(--bp-muted)]">{subtitle}</p>}
        {description && <p className="mt-3 text-sm text-[color:var(--bp-muted)]">{description}</p>}
        {showButton && account.publicSlug && (
          <a
            href={buildBookingLink({ publicSlug: account.publicSlug })}
            className="mt-5 inline-flex rounded-full bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
          >
            {buttonText}
          </a>
        )}
      </div>
      {imageUrl && (
        <div className="overflow-hidden rounded-3xl border border-[color:var(--bp-stroke)]">
          <img src={imageUrl} alt="" className="h-56 w-full object-cover" />
        </div>
      )}
    </div>
  );
}

function resolveCoverImage(
  imageSource: { type?: string; id?: number; url?: string },
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[]
) {
  if (imageSource.type === "custom") return imageSource.url ?? null;
  if (imageSource.type === "none") return null;
  if (imageSource.type === "account") return branding.coverUrl ?? null;
  if (imageSource.type === "location") {
    return locations.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  if (imageSource.type === "service") {
    return services.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  if (imageSource.type === "specialist") {
    return specialists.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  return null;
}

function renderAbout(block: SiteBlock, account: AccountInfo, accountProfile: AccountProfile) {
  const data = block.data as Record<string, unknown>;
  const profileText = accountProfile.description || "";
  const showContacts = Boolean(data.showContacts);
  return (
    <div>
      <h3
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "О нас"}
      </h3>
      <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
        {(data.text as string) || profileText || "Заполните описание в профиле аккаунта или прямо здесь."}
      </p>
      {showContacts && (
        <div className="mt-4 text-xs text-[color:var(--bp-muted)]">
          Контакты будут подтягиваться из профиля аккаунта.
        </div>
      )}
      <div className="mt-3 text-xs text-[color:var(--bp-muted)]">Аккаунт: {account.name}</div>
    </div>
  );
}
function renderLocations(block: SiteBlock, account: AccountInfo, locations: LocationItem[]) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const items = useCurrent ? locations.slice(0, 1) : resolveEntities(mode, ids, locations);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h3
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Локации"}
      </h3>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((location) => (
          <div key={location.id} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
            {location.coverUrl && (
              <img src={location.coverUrl} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />
            )}
            <div className="text-base font-semibold">{location.name}</div>
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{location.address}</div>
            {location.phone && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">Телефон: {location.phone}</div>
            )}
            {showButton && account.publicSlug && (
              <a
                href={buildBookingLink({
                  publicSlug: account.publicSlug,
                  locationId: location.id,
                  scenario: "serviceFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
              >
                {buttonText}
              </a>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет локаций для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderServices(block: SiteBlock, account: AccountInfo, services: ServiceItem[]) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const items = useCurrent ? services.slice(0, 1) : resolveEntities(mode, ids, services);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const showPrice = data.showPrice !== false;
  const showDuration = data.showDuration !== false;
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const specialistId = typeof data.specialistId === "number" ? data.specialistId : null;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h3
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Услуги"}
      </h3>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((service) => (
          <div key={service.id} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
            {service.coverUrl && (
              <img src={service.coverUrl} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />
            )}
            <div className="text-base font-semibold">{service.name}</div>
            {service.description && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                {service.description}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--bp-muted)]">
              {showDuration && <span>{service.baseDurationMin} мин</span>}
              {showPrice && <span>{service.basePrice} ₽</span>}
            </div>
            {showButton && account.publicSlug && (
              <a
                href={buildBookingLink({
                  publicSlug: account.publicSlug,
                  locationId,
                  specialistId,
                  serviceId: service.id,
                  scenario: specialistId ? "specialistFirst" : "serviceFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
              >
                {buttonText}
              </a>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет услуг для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderSpecialists(block: SiteBlock, account: AccountInfo, specialists: SpecialistItem[]) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const items = useCurrent ? specialists.slice(0, 1) : resolveEntities(mode, ids, specialists);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h3
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Специалисты"}
      </h3>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {items.map((specialist) => (
          <div key={specialist.id} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
            {specialist.coverUrl && (
              <img src={specialist.coverUrl} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />
            )}
            <div className="text-base font-semibold">{specialist.name}</div>
            {specialist.level && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{specialist.level}</div>
            )}
            {showButton && account.publicSlug && (
              <a
                href={buildBookingLink({
                  publicSlug: account.publicSlug,
                  locationId,
                  specialistId: specialist.id,
                  scenario: "specialistFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
              >
                {buttonText}
              </a>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет специалистов для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderPromos(block: SiteBlock, promos: PromoItem[]) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const items = useCurrent ? promos.slice(0, 1) : resolveEntities(mode, ids, promos);

  return (
    <div>
      <h3
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Промо и скидки"}
      </h3>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((promo) => (
          <div
            key={promo.id}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm"
          >
            <div className="text-base font-semibold">{promo.name}</div>
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
              {promo.type === "PERCENT" ? `${promo.value}%` : `${promo.value} ₽`}
              {promo.startsAt || promo.endsAt ? " · " : ""}
              {promo.startsAt ? `с ${promo.startsAt}` : ""}
              {promo.endsAt ? ` по ${promo.endsAt}` : ""}
            </div>
            {promo.codes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {promo.codes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  >
                    {code}
                  </span>
                ))}
              </div>
            )}
            {!promo.isActive && (
              <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                Неактивно
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет активных промо.
          </div>
        )}
      </div>
    </div>
  );
}

function renderWorks(block: SiteBlock, workPhotos: WorkPhotos) {
  const data = block.data as Record<string, unknown>;
  const source = (data.source as string) ?? "locations";
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const items =
    source === "services"
      ? workPhotos.services
      : source === "specialists"
        ? workPhotos.specialists
        : workPhotos.locations;
  const filtered = mode === "selected" && ids.length > 0
    ? items.filter((item) => ids.includes(Number(item.entityId)))
    : items;

  return (
    <div>
      <h3
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Работы"}
      </h3>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {filtered.slice(0, 8).map((item, idx) => (
          <img key={`${item.entityId}-${idx}`} src={item.url} alt="" className="h-28 w-full rounded-xl object-cover" />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет фото работ для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderReviews(block: SiteBlock) {
  const data = block.data as Record<string, unknown>;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  return (
    <div>
      <h3
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Отзывы"}
      </h3>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((idx) => (
          <div key={idx} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)]">
            Отзывы будут отображаться здесь после их появления.
          </div>
        ))}
      </div>
    </div>
  );
}

function renderContacts(
  block: SiteBlock,
  account: AccountInfo,
  accountProfile: AccountProfile,
  locations: LocationItem[]
) {
  const data = block.data as Record<string, unknown>;
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const location = locationId
    ? locations.find((item) => item.id === locationId)
    : locations[0];
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <div>
        <h3
          className="text-2xl font-semibold"
          style={{ fontFamily: "var(--site-font-heading)" }}
        >
          {(data.title as string) || "Контакты"}
        </h3>
        {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
        <div className="mt-4 space-y-2 text-sm text-[color:var(--bp-muted)]">
          <div>Аккаунт: {account.name}</div>
          {accountProfile.phone && <div>Телефон: {accountProfile.phone}</div>}
          {accountProfile.email && <div>Email: {accountProfile.email}</div>}
          {(accountProfile.address || location?.address) && (
            <div>Адрес: {accountProfile.address || location?.address}</div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-xs text-[color:var(--bp-muted)]">
        Здесь можно будет подключить карту.
      </div>
    </div>
  );
}


