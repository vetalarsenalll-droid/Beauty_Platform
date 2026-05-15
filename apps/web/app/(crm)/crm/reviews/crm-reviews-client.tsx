"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { UnoptimizedImage } from "@/components/unoptimized-image";

export type CrmReviewStatus = "PUBLISHED" | "PENDING" | "HIDDEN";

export type CrmReviewItem = {
  id: number;
  accountId: number;
  clientId: number;
  appointmentId: number | null;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  rating: number;
  comment: string | null;
  status: CrmReviewStatus;
  replyText: string | null;
  repliedAt: string | null;
  repliedByUserId: number | null;
  repliedByUserName: string | null;
  moderationReason: string | null;
  moderationMatchedWords: string[];
  moderatedAt: string | null;
  moderatedByUserId: number | null;
  createdAt: string;
  photoUrls: string[];
  replyPhotos: Array<{ assetId: number; url: string }>;
  client: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  appointment: {
    startAt: string;
    locationName: string | null;
    specialistName: string | null;
    serviceNames: string[];
  } | null;
};

type AuditLog = {
  id: number;
  action: string;
  actorName: string;
  createdAt: string;
};

type ReviewSettings = {
  reviewAutoPublish: boolean;
  reviewAllowReplies: boolean;
  reviewModerationMode: string;
  reviewModerationWords: string[];
  reviewModerationMinRating: number | null;
};

type CrmReviewsClientProps = {
  reviews: CrmReviewItem[];
  settings: ReviewSettings;
  total: number;
  pageSize: number;
};

const statusLabels: Record<CrmReviewStatus, string> = {
  PUBLISHED: "Опубликован",
  PENDING: "На модерации",
  HIDDEN: "Скрыт",
};

const statusTone: Record<CrmReviewStatus, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  PENDING: "bg-amber-50 text-amber-700 border-amber-100",
  HIDDEN: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const tabs = [
  { key: "all", label: "Все" },
  { key: "pending", label: "На модерации" },
  { key: "published", label: "Опубликованные" },
  { key: "hidden", label: "Скрытые" },
  { key: "unanswered", label: "Без ответа" },
  { key: "photos", label: "С фото" },
] as const;

const templates = [
  "Спасибо за отзыв! Нам очень приятно, что вы остались довольны.",
  "Спасибо, что поделились впечатлениями. Нам жаль, что опыт оказался неидеальным, мы разберем ситуацию внутри команды.",
  "Спасибо за обратную связь. Пожалуйста, свяжитесь с нами удобным способом, чтобы мы могли уточнить детали и помочь.",
];

function clientName(review: CrmReviewItem) {
  return [review.client.firstName, review.client.lastName].filter(Boolean).join(" ") || review.client.phone || review.client.email || "Клиент";
}

function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function stars(rating: number) {
  const value = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="whitespace-nowrap text-[#ff9f0a]" aria-label={`Оценка ${value} из 5`}>
      {"★".repeat(value)}
      <span className="text-[color:var(--bp-stroke)]">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function searchText(review: CrmReviewItem) {
  return [
    clientName(review),
    review.client.phone,
    review.client.email,
    review.comment,
    review.replyText,
    review.entityLabel,
    review.entityType,
    review.appointment?.locationName,
    review.appointment?.specialistName,
    ...(review.appointment?.serviceNames ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
      <div className="text-xs font-medium text-[color:var(--bp-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[color:var(--bp-ink)]">{value}</div>
      {sub ? <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{sub}</div> : null}
    </div>
  );
}

export default function CrmReviewsClient({ reviews, settings, total, pageSize }: CrmReviewsClientProps) {
  const [items, setItems] = useState(reviews);
  const [totalCount, setTotalCount] = useState(total);
  const [reviewSettings, setReviewSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (text: string, tone: "success" | "error" = "success") => setToast({ text, tone });

  const patchItem = (id: number, patch: Partial<CrmReviewItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const stats = useMemo(() => {
    const published = items.filter((review) => review.status === "PUBLISHED");
    const replyIntervals = items
      .filter((review) => review.replyText && review.repliedAt)
      .map((review) => (new Date(review.repliedAt as string).getTime() - new Date(review.createdAt).getTime()) / 36e5)
      .filter((hours) => Number.isFinite(hours) && hours >= 0);

    return {
      total: totalCount,
      loaded: items.length,
      published: published.length,
      pending: items.filter((review) => review.status === "PENDING").length,
      hidden: items.filter((review) => review.status === "HIDDEN").length,
      unanswered: items.filter((review) => !review.replyText).length,
      withPhotos: items.filter((review) => review.photoUrls.length > 0).length,
      avg: published.length > 0 ? published.reduce((sum, review) => sum + review.rating, 0) / published.length : 0,
      avgReplyHours: replyIntervals.length > 0 ? replyIntervals.reduce((sum, hours) => sum + hours, 0) / replyIntervals.length : null,
    };
  }, [items, totalCount]);

  const filteredReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return items
      .filter((review) => {
        if (activeTab === "pending" && review.status !== "PENDING") return false;
        if (activeTab === "published" && review.status !== "PUBLISHED") return false;
        if (activeTab === "hidden" && review.status !== "HIDDEN") return false;
        if (activeTab === "unanswered" && review.replyText) return false;
        if (activeTab === "photos" && review.photoUrls.length === 0) return false;
        if (rating !== "all" && review.rating !== Number(rating)) return false;
        if (entityType !== "all" && review.entityType !== entityType) return false;
        if (normalizedQuery && !searchText(review).includes(normalizedQuery)) return false;

        const createdAt = new Date(review.createdAt).getTime();
        if (from && createdAt < from) return false;
        if (to && createdAt > to) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sort === "low-rating") return a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === "high-rating") return b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === "unanswered") return (a.replyText ? 1 : 0) - (b.replyText ? 1 : 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [activeTab, dateFrom, dateTo, entityType, items, query, rating, sort]);

  const selectedReview = items.find((review) => review.id === selectedReviewId) ?? null;

  const loadMore = async () => {
    setLoadingMore(true);
    const response = await fetch(`/api/v1/crm/reviews?offset=${items.length}&limit=${pageSize}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.data?.reviews) {
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...payload.data.reviews.filter((item: CrmReviewItem) => !known.has(item.id))];
      });
      setTotalCount(payload.data.total ?? totalCount);
    } else {
      notify(payload?.error?.message ?? "Не удалось загрузить следующую страницу", "error");
    }
    setLoadingMore(false);
  };

  const updateStatus = async (id: number, status: CrmReviewStatus) => {
    setBusy(true);
    const response = await fetch(`/api/v1/crm/reviews/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      patchItem(id, {
        status: payload.data.status,
        moderatedAt: payload.data.moderatedAt,
        moderatedByUserId: payload.data.moderatedByUserId,
      });
      notify("Статус отзыва обновлен");
    } else {
      notify(payload?.error?.message ?? "Не удалось обновить статус", "error");
    }
    setBusy(false);
  };

  const saveReply = async (id: number, replyText: string) => {
    setBusy(true);
    const response = await fetch(`/api/v1/crm/reviews/${id}/reply`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyText }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      patchItem(id, {
        replyText: payload.data.replyText,
        repliedAt: payload.data.repliedAt,
        repliedByUserId: payload.data.repliedByUserId,
        repliedByUserName: payload.data.repliedByUserName,
      });
      notify(replyText.trim() ? "Ответ сохранен" : "Ответ удален");
    } else {
      notify(payload?.error?.message ?? "Не удалось сохранить ответ", "error");
    }
    setBusy(false);
  };

  const updateReplyPhotos = (id: number, replyPhotos: CrmReviewItem["replyPhotos"]) => {
    patchItem(id, { replyPhotos });
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const response = await fetch("/api/v1/crm/reviews/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewAutoPublish: form.get("reviewAutoPublish") === "on",
        reviewAllowReplies: form.get("reviewAllowReplies") === "on",
        reviewModerationMode: form.get("reviewModerationMode"),
        reviewModerationMinRating: form.get("reviewModerationMinRating") || null,
        reviewModerationWords: String(form.get("reviewModerationWords") ?? ""),
      }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      setReviewSettings(payload.data);
      notify("Настройки отзывов сохранены");
    } else {
      notify(payload?.error?.message ?? "Не удалось сохранить настройки", "error");
    }
    setBusy(false);
  };

  const applyBulkStatus = async (status: CrmReviewStatus) => {
    if (selectedIds.length === 0) return;
    setBusy(true);
    const response = await fetch("/api/v1/crm/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, status }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      const ids = new Set<number>(payload.data.ids);
      setItems((current) =>
        current.map((item) =>
          ids.has(item.id)
            ? { ...item, status: payload.data.status, moderatedAt: payload.data.moderatedAt, moderatedByUserId: payload.data.moderatedByUserId }
            : item
        )
      );
      setSelectedIds([]);
      notify("Массовое действие выполнено");
    } else {
      notify(payload?.error?.message ?? "Не удалось выполнить массовое действие", "error");
    }
    setBusy(false);
  };

  const visibleIds = filteredReviews.map((review) => review.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className="flex flex-col gap-6">
      {toast ? (
        <div className={`fixed right-5 top-5 z-[70] max-w-sm rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl ${toast.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
          {toast.text}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Средний рейтинг" value={stats.avg ? stats.avg.toFixed(1).replace(".", ",") : "0,0"} sub={`${stats.published} опубликовано`} />
        <StatCard label="Всего отзывов" value={stats.total} sub={`Загружено ${stats.loaded}`} />
        <StatCard label="Опубликовано" value={stats.published} />
        <StatCard label="На модерации" value={stats.pending} />
        <StatCard label="Скрыто" value={stats.hidden} />
        <StatCard label="Без ответа" value={stats.unanswered} />
        <StatCard label="Среднее время ответа" value={stats.avgReplyHours === null ? "-" : `${Math.round(stats.avgReplyHours)} ч`} sub={`${stats.withPhotos} с фото`} />
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Отзывы</h1>
            <p className="mt-1 text-sm text-[color:var(--bp-muted)]">Модерация, поиск, ответы и фото по отзывам аккаунта, услуг, специалистов и локаций.</p>
          </div>

          <form onSubmit={saveSettings} className="grid gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-bg)] p-4 text-sm lg:min-w-[460px]">
            <label className="flex items-center gap-3">
              <input name="reviewAutoPublish" type="checkbox" defaultChecked={reviewSettings.reviewAutoPublish} />
              Публиковать новые отзывы сразу
            </label>
            <label className="flex items-center gap-3">
              <input name="reviewAllowReplies" type="checkbox" defaultChecked={reviewSettings.reviewAllowReplies} />
              Разрешить ответы компании
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[color:var(--bp-muted)]">Режим модерации</span>
              <select name="reviewModerationMode" defaultValue={reviewSettings.reviewModerationMode} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm">
                <option value="auto">Автопубликация + правила</option>
                <option value="publish">Публиковать сразу</option>
                <option value="all">Все новые на модерацию</option>
                <option value="words">На модерацию только по словам</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[color:var(--bp-muted)]">Порог оценки для модерации</span>
              <select name="reviewModerationMinRating" defaultValue={reviewSettings.reviewModerationMinRating ?? ""} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm">
                <option value="">Не использовать</option>
                <option value="1">1 звезда и ниже</option>
                <option value="2">2 звезды и ниже</option>
                <option value="3">3 звезды и ниже</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[color:var(--bp-muted)]">Слова и фразы для модерации</span>
              <textarea name="reviewModerationWords" defaultValue={reviewSettings.reviewModerationWords.join("\n")} rows={3} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm" placeholder={"ужас\nобман\nне советую"} />
            </label>
            <button className="rounded-xl bg-[color:var(--bp-ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
              Сохранить настройки
            </button>
          </form>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-full px-4 py-2 text-xs font-semibold ${activeTab === tab.key ? "bg-[color:var(--bp-ink)] text-white" : "border border-[color:var(--bp-stroke)] bg-white text-[color:var(--bp-muted)]"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_0.8fr_0.9fr]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по клиенту, отзыву, услуге, специалисту, локации" className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)]" />
          <select value={rating} onChange={(event) => setRating(event.target.value)} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm">
            <option value="all">Все оценки</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} звезд</option>)}
          </select>
          <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm">
            <option value="all">Все объекты</option>
            <option value="account">Аккаунт</option>
            <option value="service">Услуга</option>
            <option value="specialist">Специалист</option>
            <option value="location">Локация</option>
          </select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm" />
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm">
            <option value="newest">Новые</option>
            <option value="oldest">Старые</option>
            <option value="low-rating">Низкая оценка</option>
            <option value="high-rating">Высокая оценка</option>
            <option value="unanswered">Без ответа</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--bp-muted)]">
          <span>Найдено: {filteredReviews.length} из {items.length} загруженных</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => setSelectedIds(event.target.checked ? visibleIds : [])}
              />
              Выбрать видимые
            </label>
            <span>Выбрано: {selectedIds.length}</span>
            <button type="button" onClick={() => applyBulkStatus("PUBLISHED")} disabled={busy || selectedIds.length === 0} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Опубликовать</button>
            <button type="button" onClick={() => applyBulkStatus("PENDING")} disabled={busy || selectedIds.length === 0} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold disabled:opacity-50">На модерацию</button>
            <button type="button" onClick={() => applyBulkStatus("HIDDEN")} disabled={busy || selectedIds.length === 0} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Скрыть</button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)]">
          {filteredReviews.length === 0 ? (
            <div className="p-6 text-sm text-[color:var(--bp-muted)]">Отзывы по выбранным фильтрам не найдены.</div>
          ) : (
            <div className="divide-y divide-[color:var(--bp-stroke)]">
              {filteredReviews.map((review) => (
                <ReviewCard
                  key={`${review.id}:${review.replyText ?? ""}`}
                  review={review}
                  settings={reviewSettings}
                  selected={selectedIds.includes(review.id)}
                  onSelect={(checked) => setSelectedIds((current) => checked ? Array.from(new Set([...current, review.id])) : current.filter((id) => id !== review.id))}
                  onOpen={() => setSelectedReviewId(review.id)}
                  onStatus={updateStatus}
                  onReply={saveReply}
                  onReplyPhotos={updateReplyPhotos}
                  disabled={busy}
                />
              ))}
            </div>
          )}
        </div>

        {items.length < totalCount ? (
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {loadingMore ? "Загрузка..." : `Загрузить еще ${Math.min(pageSize, totalCount - items.length)}`}
            </button>
          </div>
        ) : null}
      </section>

      {selectedReview ? (
        <ReviewDrawer
          key={`${selectedReview.id}:${selectedReview.replyText ?? ""}`}
          review={selectedReview}
          settings={reviewSettings}
          onClose={() => setSelectedReviewId(null)}
          onStatus={updateStatus}
          onReply={saveReply}
          onReplyPhotos={updateReplyPhotos}
          disabled={busy}
        />
      ) : null}
    </div>
  );
}

function ReviewCard({
  review,
  settings,
  selected,
  disabled,
  onSelect,
  onOpen,
  onStatus,
  onReply,
  onReplyPhotos,
}: {
  review: CrmReviewItem;
  settings: ReviewSettings;
  selected: boolean;
  disabled: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
  onStatus: (id: number, status: CrmReviewStatus) => void;
  onReply: (id: number, replyText: string) => void;
  onReplyPhotos: (id: number, replyPhotos: CrmReviewItem["replyPhotos"]) => void;
}) {
  const isNegative = review.rating <= 2;
  const [replyText, setReplyText] = useState(review.replyText ?? "");

  return (
    <article className={`grid gap-4 p-5 xl:grid-cols-[260px_1fr_220px] ${isNegative ? "bg-rose-50/45" : "bg-white"}`}>
      <div>
        <label className="mb-3 flex items-center gap-2 text-xs text-[color:var(--bp-muted)]">
          <input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} />
          Выбрать
        </label>
        <button type="button" onClick={onOpen} className="text-left font-semibold text-[color:var(--bp-ink)] hover:underline">{clientName(review)}</button>
        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{formatDate(review.createdAt, true)}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone[review.status]}`}>{statusLabels[review.status]}</span>
          {!review.replyText ? <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">Без ответа</span> : null}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          {stars(review.rating)}
          <span className="rounded-full bg-[color:var(--bp-chip)] px-3 py-1 text-xs text-[color:var(--bp-muted)]">{review.entityLabel}</span>
          {review.appointment?.serviceNames.length ? <span className="text-xs text-[color:var(--bp-muted)]">{review.appointment.serviceNames.join(", ")}</span> : null}
        </div>
        {review.comment ? <p className="mt-3 text-sm leading-6 text-[color:var(--bp-ink)]">{review.comment}</p> : null}
        {review.moderationReason ? <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{review.moderationReason}</div> : null}
        {review.photoUrls.length ? <PhotoStrip urls={review.photoUrls} /> : null}
        {review.repliedByUserName ? <div className="mt-3 text-xs text-[color:var(--bp-muted)]">Ответил: {review.repliedByUserName}</div> : null}
        <ReplyEditor
          review={review}
          value={replyText}
          onChange={setReplyText}
          onSave={(nextReplyText) => onReply(review.id, nextReplyText)}
          onReplyPhotos={onReplyPhotos}
          allowReplies={settings.reviewAllowReplies}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-2">
        {(["PUBLISHED", "PENDING", "HIDDEN"] as CrmReviewStatus[]).map((status) => (
          <button key={status} className="w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-left text-sm font-semibold disabled:bg-[color:var(--bp-chip)] disabled:text-[color:var(--bp-muted)]" disabled={disabled || review.status === status} type="button" onClick={() => onStatus(review.id, status)}>
            {statusLabels[status]}
          </button>
        ))}
        <button type="button" onClick={onOpen} className="w-full rounded-xl bg-[color:var(--bp-ink)] px-3 py-2 text-left text-sm font-semibold text-white">Детали</button>
        <Link href={`/crm/clients/${review.clientId}`} className="w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold">Открыть клиента</Link>
        {review.appointmentId ? <Link href={`/crm/calendar?appointmentId=${review.appointmentId}`} className="w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold">Открыть запись</Link> : null}
      </div>
    </article>
  );
}

function ReplyEditor({
  review,
  value,
  allowReplies,
  disabled,
  onChange,
  onSave,
  onReplyPhotos,
}: {
  review: CrmReviewItem;
  value: string;
  allowReplies: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onSave: (replyText: string) => void;
  onReplyPhotos: (id: number, replyPhotos: CrmReviewItem["replyPhotos"]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const uploadReplyPhoto = async (file: File | null) => {
    if (!file) return;
    setMediaBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/v1/crm/reviews/${review.id}/reply/media`, { method: "POST", body: formData });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.data?.url && payload?.data?.assetId) {
      onReplyPhotos(review.id, [...review.replyPhotos, { assetId: payload.data.assetId, url: payload.data.url }]);
    }
    setMediaBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteReplyPhoto = async (assetId: number) => {
    setMediaBusy(true);
    const response = await fetch(`/api/v1/crm/reviews/${review.id}/reply/media/${assetId}`, { method: "DELETE" });
    if (response.ok) onReplyPhotos(review.id, review.replyPhotos.filter((photo) => photo.assetId !== assetId));
    setMediaBusy(false);
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        {templates.map((template, index) => (
          <button key={index} type="button" onClick={() => onChange(template)} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold">
            Шаблон {index + 1}
          </button>
        ))}
      </div>
      <textarea value={value} onChange={(event) => onChange(event.target.value.slice(0, 1000))} disabled={!allowReplies} maxLength={1000} className="min-h-20 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)] disabled:opacity-60" placeholder="Ответ" />
      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={!allowReplies || disabled} type="button" onClick={() => onSave(value)}>Сохранить ответ</button>
        {review.replyText ? <button className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold disabled:opacity-60" disabled={!allowReplies || disabled} type="button" onClick={() => { onChange(""); onSave(""); }}>Удалить ответ</button> : null}
        <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(event) => uploadReplyPhoto(event.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!allowReplies || mediaBusy || review.replyPhotos.length >= 5} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold disabled:opacity-60">Добавить фото</button>
        <button type="button" onClick={() => setPreview((current) => !current)} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold">Предпросмотр</button>
        <span className="text-xs text-[color:var(--bp-muted)]">{value.length}/1000</span>
      </div>
      {review.replyPhotos.length ? (
        <div className="flex flex-wrap gap-2">
          {review.replyPhotos.map((photo) => (
            <div key={photo.assetId} className="relative h-20 w-20 overflow-hidden rounded-xl border border-[color:var(--bp-stroke)]">
              <UnoptimizedImage src={photo.url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => deleteReplyPhoto(photo.assetId)} disabled={mediaBusy} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold shadow disabled:opacity-60">Удалить</button>
            </div>
          ))}
        </div>
      ) : null}
      {preview ? (
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-bg)] p-4 text-sm">
          <div className="font-semibold">Ответ</div>
          {value ? <div className="mt-1 whitespace-pre-wrap">{value}</div> : <div className="mt-1 text-[color:var(--bp-muted)]">Текст ответа пустой.</div>}
          {review.replyPhotos.length ? <PhotoStrip urls={review.replyPhotos.map((photo) => photo.url)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PhotoStrip({ urls }: { urls: string[] }) {
  return (
    <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
      {urls.slice(0, 8).map((url, index) => (
        <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-xl border border-[color:var(--bp-stroke)]">
          <UnoptimizedImage src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function ReviewDrawer({
  review,
  settings,
  disabled,
  onClose,
  onStatus,
  onReply,
  onReplyPhotos,
}: {
  review: CrmReviewItem;
  settings: ReviewSettings;
  disabled: boolean;
  onClose: () => void;
  onStatus: (id: number, status: CrmReviewStatus) => void;
  onReply: (id: number, replyText: string) => void;
  onReplyPhotos: (id: number, replyPhotos: CrmReviewItem["replyPhotos"]) => void;
}) {
  const [replyText, setReplyText] = useState(review.replyText ?? "");
  const auditKey = `${review.id}:${review.status}:${review.replyText ?? ""}:${review.replyPhotos.length}`;
  const [auditState, setAuditState] = useState<{ key: string; logs: AuditLog[] }>({ key: "", logs: [] });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/crm/reviews/${review.id}/audit`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setAuditState({ key: auditKey, logs: Array.isArray(payload?.data?.logs) ? payload.data.logs : [] });
      })
      .catch(() => {
        if (!cancelled) setAuditState({ key: auditKey, logs: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [auditKey, review.id]);

  const auditBusy = auditState.key !== auditKey;
  const logs = auditState.logs;

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-[color:var(--bp-paper)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-[color:var(--bp-muted)]">Отзыв #{review.id}</div>
            <h2 className="mt-1 text-2xl font-semibold">{clientName(review)}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold">Закрыть</button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {stars(review.rating)}
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone[review.status]}`}>{statusLabels[review.status]}</span>
          <span className="text-sm text-[color:var(--bp-muted)]">{formatDate(review.createdAt, true)}</span>
        </div>
        <dl className="mt-6 grid gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-bg)] p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-[color:var(--bp-muted)]">Объект</dt><dd className="mt-1 font-medium">{review.entityLabel}</dd></div>
          <div><dt className="text-[color:var(--bp-muted)]">Контакты</dt><dd className="mt-1 font-medium">{[review.client.phone, review.client.email].filter(Boolean).join(" · ") || "Не указаны"}</dd></div>
          <div><dt className="text-[color:var(--bp-muted)]">Локация</dt><dd className="mt-1 font-medium">{review.appointment?.locationName ?? "Не привязана"}</dd></div>
          <div><dt className="text-[color:var(--bp-muted)]">Специалист</dt><dd className="mt-1 font-medium">{review.appointment?.specialistName ?? "Не привязан"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[color:var(--bp-muted)]">Услуги</dt><dd className="mt-1 font-medium">{review.appointment?.serviceNames.join(", ") || "Не привязаны"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[color:var(--bp-muted)]">Модерация</dt><dd className="mt-1 font-medium">{review.moderationReason ? `${review.moderationReason}${review.moderatedAt ? ` · ${formatDate(review.moderatedAt, true)}` : ""}` : "Причина не указана"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[color:var(--bp-muted)]">Кто ответил</dt><dd className="mt-1 font-medium">{review.repliedByUserName ?? "Ответ еще не сохранен"}</dd></div>
        </dl>
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Текст отзыва</h3>
          <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4 text-sm leading-6">{review.comment || "Текст не указан."}</p>
        </div>
        {review.photoUrls.length ? <div className="mt-6"><h3 className="text-sm font-semibold">Фото клиента</h3><PhotoStrip urls={review.photoUrls} /></div> : null}
        <ReplyEditor review={review} value={replyText} onChange={setReplyText} onSave={(nextReplyText) => onReply(review.id, nextReplyText)} onReplyPhotos={onReplyPhotos} allowReplies={settings.reviewAllowReplies} disabled={disabled} />
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          {(["PUBLISHED", "PENDING", "HIDDEN"] as CrmReviewStatus[]).map((status) => (
            <button key={status} className="w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm font-semibold disabled:bg-[color:var(--bp-chip)] disabled:text-[color:var(--bp-muted)]" disabled={disabled || review.status === status} type="button" onClick={() => onStatus(review.id, status)}>
              {statusLabels[status]}
            </button>
          ))}
        </div>
        <div className="mt-8">
          <h3 className="text-sm font-semibold">История действий</h3>
          <div className="mt-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-white">
            {auditBusy ? (
              <div className="p-4 text-sm text-[color:var(--bp-muted)]">Загрузка истории...</div>
            ) : logs.length === 0 ? (
              <div className="p-4 text-sm text-[color:var(--bp-muted)]">История пока пустая.</div>
            ) : (
              <div className="divide-y divide-[color:var(--bp-stroke)]">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 text-sm">
                    <div className="font-medium">{log.action}</div>
                    <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{log.actorName} · {formatDate(log.createdAt, true)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
