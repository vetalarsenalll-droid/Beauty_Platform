"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteDraft, SitePageKey, SiteEntityPages } from "@/lib/site-builder";
import { ProjectPublishButton } from "./project-publish-button";

export type ProjectSeoSettings = {
  pageKey: string;
  title: string;
  description: string;
  ogImageUrl: string;
  keywords: string;
  canonicalUrl: string;
  noIndex: boolean;
  noFollow: boolean;
};

export type ProjectBlockTag = {
  blockId: string;
  index: number;
  type: string;
  title: string;
  subtitle: string;
  seoTitleTag: string;
  seoSubtitleTag: string;
};

export type ProjectPageRow = {
  pageKey: string;
  label: string;
  path: string;
  editorHref: string;
  publishPage: SitePageKey | null;
  publishEntity: { type: keyof SiteEntityPages; id: string } | null;
  blocksCount: number;
  hasUnpublishedChanges: boolean;
  seo: ProjectSeoSettings;
  blockTags: ProjectBlockTag[];
};

type ProjectClientProps = {
  initialDraft: SiteDraft;
  pages: ProjectPageRow[];
};

const TABS = ["main", "badge", "social", "seo"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  main: "Главное",
  badge: "Бейджик",
  social: "Соцсети",
  seo: "SEO",
};
const TAG_OPTIONS = ["", "h1", "h2", "h3", "h4", "h5", "h6", "div"] as const;

function findCoverDefaults(row: ProjectPageRow) {
  const cover = row.blockTags.find((block) => block.type === "cover") ?? row.blockTags[0];
  return {
    title: cover?.title?.trim() || row.label,
    description: cover?.subtitle?.trim() || cover?.title?.trim() || "",
  };
}

function updateBlockTagInDraft(
  draft: SiteDraft,
  pageKey: string,
  blockId: string,
  patch: { seoTitleTag?: string; seoSubtitleTag?: string }
) {
  const next: SiteDraft = JSON.parse(JSON.stringify(draft));
  const updateBlocks = (blocks: SiteDraft["blocks"] | undefined) => {
    if (!blocks) return false;
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return false;
    block.data = { ...block.data, ...patch };
    return true;
  };

  if (pageKey.startsWith("location:")) {
    updateBlocks(next.entityPages?.locations?.[pageKey.split(":")[1]]);
  } else if (pageKey.startsWith("service:")) {
    updateBlocks(next.entityPages?.services?.[pageKey.split(":")[1]]);
  } else if (pageKey.startsWith("specialist:")) {
    updateBlocks(next.entityPages?.specialists?.[pageKey.split(":")[1]]);
  } else if (pageKey.startsWith("promo:")) {
    updateBlocks(next.entityPages?.promos?.[pageKey.split(":")[1]]);
  } else if (pageKey === "home") {
    const updated = updateBlocks(next.pages?.home);
    if (!updated) updateBlocks(next.blocks);
    next.blocks = next.pages?.home ?? next.blocks;
  } else {
    updateBlocks(next.pages?.[pageKey as SitePageKey]);
  }
  return next;
}

export default function ProjectClient({ initialDraft, pages }: ProjectClientProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [rows, setRows] = useState(pages);
  const [activePageKey, setActivePageKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("main");
  const [saving, setSaving] = useState(false);
  const activeRow = useMemo(
    () => rows.find((row) => row.pageKey === activePageKey) ?? null,
    [activePageKey, rows]
  );
  const defaults = activeRow ? findCoverDefaults(activeRow) : { title: "", description: "" };

  const updateSeo = (patch: Partial<ProjectSeoSettings>) => {
    if (!activeRow) return;
    setRows((prev) =>
      prev.map((row) =>
        row.pageKey === activeRow.pageKey ? { ...row, seo: { ...row.seo, ...patch } } : row
      )
    );
  };

  const updateBlockTag = (
    blockId: string,
    patch: { seoTitleTag?: string; seoSubtitleTag?: string }
  ) => {
    if (!activeRow) return;
    setRows((prev) =>
      prev.map((row) =>
        row.pageKey === activeRow.pageKey
          ? {
              ...row,
              blockTags: row.blockTags.map((block) =>
                block.blockId === blockId ? { ...block, ...patch } : block
              ),
            }
          : row
      )
    );
    setDraft((prev) => updateBlockTagInDraft(prev, activeRow.pageKey, blockId, patch));
  };

  const saveSettings = async () => {
    if (!activeRow) return;
    setSaving(true);
    try {
      await fetch("/api/v1/crm/settings/seo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageSettings: [activeRow.seo] }),
      });
      await fetch("/api/v1/crm/settings/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftJson: draft, publish: false }),
      });
      router.refresh();
      setActivePageKey(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-4 sm:p-6">
        <div className="mb-4 text-sm font-medium text-[color:var(--bp-muted)]">
          Страницы проекта
        </div>
        <div className="divide-y divide-[color:var(--bp-stroke)]">
          {rows.map((row) => (
            <div key={row.pageKey} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="text-sm font-semibold text-[color:var(--bp-ink)]">{row.label}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[color:var(--bp-muted)]">
                  <span className="font-mono">{row.path}</span>
                  <span>Блоков: {row.blocksCount}</span>
                </div>
                {row.hasUnpublishedChanges && (
                  <div className="mt-1 text-xs font-medium text-[#b45309]">
                    Последние изменения не опубликованы
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivePageKey(row.pageKey);
                    setActiveTab("main");
                  }}
                  className="rounded-full border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:bg-[color:var(--bp-paper)]"
                >
                  Настройки
                </button>
                <Link
                  href={row.editorHref || "#"}
                  aria-hidden={!row.editorHref}
                  tabIndex={row.editorHref ? undefined : -1}
                  className={`rounded-full border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:bg-[color:var(--bp-paper)] ${
                    row.editorHref ? "" : "hidden"
                  }`}
                >
                  Редактировать
                </Link>
                {row.publishPage ? (
                  <ProjectPublishButton
                    draftJson={draft}
                    pageKey={row.publishPage}
                    publishEntity={row.publishEntity}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeRow ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-10">
          <div className="w-full max-w-3xl bg-[color:var(--bp-panel)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--bp-stroke)] px-6 py-5">
              <div>
                <div className="text-lg font-semibold">Настройки страницы</div>
                <div className="mt-1 text-xs font-mono text-[color:var(--bp-muted)]">
                  {activeRow.path}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePageKey(null)}
                className="text-2xl leading-none text-[color:var(--bp-muted)]"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="flex gap-6 overflow-x-auto border-b border-[color:var(--bp-stroke)] px-6">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 py-4 text-sm ${
                    activeTab === tab
                      ? "border-[color:var(--bp-ink)] text-[color:var(--bp-ink)]"
                      : "border-transparent text-[color:var(--bp-muted)]"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            <div className="px-6 py-7">
              {activeTab === "main" ? (
                <div className="grid gap-5">
                  <label className="text-sm">
                    Заголовок
                    <input
                      value={activeRow.seo.title}
                      onChange={(event) => updateSeo({ title: event.target.value })}
                      placeholder={defaults.title}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Описание
                    <textarea
                      value={activeRow.seo.description}
                      onChange={(event) => updateSeo({ description: event.target.value })}
                      placeholder={defaults.description}
                      rows={3}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Адрес страницы
                    <input
                      value={activeRow.path}
                      readOnly
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 font-mono text-[color:var(--bp-muted)] outline-none"
                    />
                  </label>
                </div>
              ) : null}

              {activeTab === "badge" ? (
                <div className="grid gap-5">
                  <div className="text-center">
                    <div className="text-lg font-medium">Бейджик страницы</div>
                    <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
                      По умолчанию используется изображение из обложки или карточки сущности.
                    </p>
                  </div>
                  <label className="text-sm">
                    Картинка бейджика / OG
                    <input
                      value={activeRow.seo.ogImageUrl}
                      onChange={(event) => updateSeo({ ogImageUrl: event.target.value })}
                      placeholder="https://..."
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  {activeRow.seo.ogImageUrl ? (
                    <Image
                      src={activeRow.seo.ogImageUrl}
                      alt=""
                      width={960}
                      height={503}
                      unoptimized
                      className="mx-auto aspect-[1.91/1] w-full max-w-lg object-cover"
                    />
                  ) : null}
                </div>
              ) : null}

              {activeTab === "social" ? (
                <div className="grid gap-5">
                  <div className="mx-auto w-full max-w-lg border border-[color:var(--bp-stroke)] bg-white p-4 shadow-sm">
                    {activeRow.seo.ogImageUrl ? (
                      <Image
                        src={activeRow.seo.ogImageUrl}
                        alt=""
                        width={960}
                        height={503}
                        unoptimized
                        className="aspect-[1.91/1] w-full object-cover"
                      />
                    ) : null}
                    <div className="mt-3 text-base font-semibold text-blue-700">
                      {activeRow.seo.title || defaults.title}
                    </div>
                    <div className="mt-1 text-xs text-green-700">https://ваш-домен{activeRow.path}</div>
                    <div className="mt-2 text-sm text-slate-700">
                      {activeRow.seo.description || defaults.description}
                    </div>
                  </div>
                  <label className="text-sm">
                    Заголовок для соцсетей
                    <input
                      value={activeRow.seo.title}
                      onChange={(event) => updateSeo({ title: event.target.value })}
                      placeholder={defaults.title}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                </div>
              ) : null}

              {activeTab === "seo" ? (
                <div className="grid gap-5">
                  <div className="mx-auto w-full max-w-lg border border-[color:var(--bp-stroke)] bg-white p-4 shadow-sm">
                    <div className="text-base font-medium text-blue-700">
                      {activeRow.seo.title || defaults.title}
                    </div>
                    <div className="mt-1 text-xs text-green-700">https://ваш-домен{activeRow.path}</div>
                    <div className="mt-2 text-sm text-slate-700">
                      {activeRow.seo.description || defaults.description}
                    </div>
                  </div>
                  <label className="text-sm">
                    Заголовок
                    <input
                      value={activeRow.seo.title}
                      onChange={(event) => updateSeo({ title: event.target.value })}
                      placeholder={defaults.title}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Описание
                    <textarea
                      value={activeRow.seo.description}
                      onChange={(event) => updateSeo({ description: event.target.value })}
                      placeholder={defaults.description}
                      rows={2}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Ключевые слова
                    <input
                      value={activeRow.seo.keywords}
                      onChange={(event) => updateSeo({ keywords: event.target.value })}
                      placeholder="уход, стрижка, окрашивание"
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Каноническая ссылка
                    <input
                      value={activeRow.seo.canonicalUrl}
                      onChange={(event) => updateSeo({ canonicalUrl: event.target.value })}
                      placeholder={`https://ваш-домен${activeRow.path}`}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={activeRow.seo.noIndex}
                      onChange={(event) => updateSeo({ noIndex: event.target.checked })}
                    />
                    Запретить поисковикам индексировать эту страницу
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={activeRow.seo.noFollow}
                      onChange={(event) => updateSeo({ noFollow: event.target.checked })}
                    />
                    Запретить поисковой системе переходить по ссылкам на странице
                  </label>

                  {activeRow.blockTags.length ? (
                    <div className="mt-2 border-t border-[color:var(--bp-stroke)] pt-5">
                      <div className="text-sm font-semibold">SEO-теги блоков</div>
                      <div className="mt-3 grid gap-3">
                        {activeRow.blockTags.map((block) => (
                          <div
                            key={block.blockId}
                            className="grid gap-3 rounded-2xl border border-[color:var(--bp-stroke)] p-3 md:grid-cols-[minmax(0,1fr)_120px_120px]"
                          >
                            <div>
                              <div className="text-sm font-medium">
                                {block.title || block.subtitle || `${block.type} #${block.index + 1}`}
                              </div>
                              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{block.type}</div>
                            </div>
                            <label className="text-xs">
                              Заголовок
                              <select
                                value={block.seoTitleTag}
                                onChange={(event) =>
                                  updateBlockTag(block.blockId, { seoTitleTag: event.target.value })
                                }
                                className="mt-1 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-transparent px-2 py-2"
                              >
                                {TAG_OPTIONS.map((tag) => (
                                  <option key={tag} value={tag}>
                                    {tag || "Не задан"}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs">
                              Подзаголовок
                              <select
                                value={block.seoSubtitleTag}
                                onChange={(event) =>
                                  updateBlockTag(block.blockId, { seoSubtitleTag: event.target.value })
                                }
                                className="mt-1 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-transparent px-2 py-2"
                              >
                                {TAG_OPTIONS.map((tag) => (
                                  <option key={tag} value={tag}>
                                    {tag || "Не задан"}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--bp-stroke)] px-6 py-5">
              <button
                type="button"
                onClick={() => setActivePageKey(null)}
                className="rounded-full border border-[color:var(--bp-stroke)] px-5 py-2 text-sm"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={saveSettings}
                disabled={saving}
                className="rounded-full bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
