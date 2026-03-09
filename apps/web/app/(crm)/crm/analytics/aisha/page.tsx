import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsTabs } from "../_components/analytics-tabs";

const DEFAULT_DAYS = 30;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = [20, 50, 100] as const;
const MAX_PAGE_LINKS = 7;

type TurnPayload = {
  intent?: string | null;
  route?: string | null;
  routeReason?: string | null;
  uiKind?: string | null;
  actionType?: string | null;
  nluSource?: string | null;
};

type TopicFilter = "all" | "booking" | "services" | "specialists" | "complaints" | "smalltalk";
type BookingFilter = "all" | "with_booking" | "completed_booking" | "without_booking";

type SearchParamsShape = Record<string, string | string[] | undefined>;

const COMPLAINT_KEYWORDS = [
  "не понрав",
  "жалоб",
  "претензи",
  "плохо",
  "ужас",
  "испорти",
  "криво",
  "грубо",
  "хам",
  "некачествен",
  "недоволь",
];

const SERVICE_KEYWORDS = ["услуг", "цена", "стоим", "прайс", "маник", "педик", "ресниц", "бров"];
const SPECIALIST_KEYWORDS = ["специал", "мастер", "кто делает", "кто выполняет"];

function asPayload(value: unknown): TurnPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>;
  return {
    intent: typeof v.intent === "string" ? v.intent : null,
    route: typeof v.route === "string" ? v.route : null,
    routeReason: typeof v.routeReason === "string" ? v.routeReason : null,
    uiKind: typeof v.uiKind === "string" ? v.uiKind : null,
    actionType: typeof v.actionType === "string" ? v.actionType : null,
    nluSource: typeof v.nluSource === "string" ? v.nluSource : null,
  };
}

function fDateTime(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(value);
}

function fInt(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function toPct(value: number, total: number) {
  if (!total) return "0%";
  const pct = (value / total) * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

function routeLabel(route: string) {
  switch (route) {
    case "booking-flow":
      return "Сценарий записи";
    case "chat-only":
      return "Свободный диалог";
    case "client-actions":
      return "Действия клиента";
    default:
      return route;
  }
}

function intentLabel(intent: string) {
  const map: Record<string, string> = {
    greeting: "Приветствие",
    smalltalk: "Разговор",
    out_of_scope: "Вне тематики",
    abuse_or_toxic: "Негатив/токсичность",
    post_completion_smalltalk: "Пост-общение",
    ask_services: "Запрос услуг",
    ask_price: "Запрос цены",
    ask_specialists: "Запрос специалистов",
    ask_availability: "Запрос свободного времени",
    booking_start: "Старт записи",
    booking_set_service: "Выбор услуги",
    my_bookings: "Мои записи",
    my_stats: "Моя статистика",
    cancel_my_booking: "Отмена записи",
    reschedule_my_booking: "Перенос записи",
    identity: "Вопрос про ассистента",
    capabilities: "Возможности ассистента",
    contact_address: "Вопрос про адрес",
    contact_phone: "Вопрос про телефон",
    working_hours: "Вопрос про график",
    unknown: "Неопределенный запрос",
  };
  return map[intent] ?? intent;
}

function nluSourceLabel(source: string) {
  if (source === "fallback") return "Резервный разбор";
  if (source === "llm") return "LLM-разбор";
  return source;
}

function draftStatusLabel(status: string) {
  const map: Record<string, string> = {
    COLLECTING: "Сбор данных",
    WAITING_CONFIRMATION: "Ожидает подтверждения",
    WAITING_CONSENT: "Ожидает согласия",
    COMPLETED: "Завершен",
  };
  return map[status] ?? status;
}

function pickParam(raw: SearchParamsShape, key: string) {
  const value = raw[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parsePositiveInt(value: string, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function isComplaintText(text: string) {
  const t = text.toLowerCase();
  return COMPLAINT_KEYWORDS.some((k) => t.includes(k));
}

function includesAny(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

function buildQueryString(params: {
  q: string;
  days: number;
  mode: BookingFilter;
  topic: TopicFilter;
  pageSize: number;
  page: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.days !== DEFAULT_DAYS) sp.set("days", String(params.days));
  if (params.mode !== "all") sp.set("mode", params.mode);
  if (params.topic !== "all") sp.set("topic", params.topic);
  if (params.pageSize !== DEFAULT_PAGE_SIZE) sp.set("pageSize", String(params.pageSize));
  if (params.page > 1) sp.set("page", String(params.page));
  return sp.toString();
}

function paginationWindow(current: number, total: number, maxLinks: number) {
  if (total <= maxLinks) return Array.from({ length: total }, (_, i) => i + 1);
  const half = Math.floor(maxLinks / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + maxLinks - 1);
  start = Math.max(1, end - maxLinks + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

type PageProps = {
  searchParams?: SearchParamsShape | Promise<SearchParamsShape>;
};

export default async function AishaAnalyticsPage({ searchParams }: PageProps) {
  const session = await requireCrmPermission("crm.analytics.read");
  const accountId = session.accountId;
  const rawParams = (await Promise.resolve(searchParams ?? {})) as SearchParamsShape;

  const q = pickParam(rawParams, "q").trim();
  const days = Math.min(365, parsePositiveInt(pickParam(rawParams, "days"), DEFAULT_DAYS));
  const modeRaw = pickParam(rawParams, "mode");
  const topicRaw = pickParam(rawParams, "topic");
  const pageSizeRaw = parsePositiveInt(pickParam(rawParams, "pageSize"), DEFAULT_PAGE_SIZE);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE;
  const mode: BookingFilter =
    modeRaw === "with_booking" || modeRaw === "completed_booking" || modeRaw === "without_booking"
      ? modeRaw
      : "all";
  const topic: TopicFilter =
    topicRaw === "booking" ||
    topicRaw === "services" ||
    topicRaw === "specialists" ||
    topicRaw === "complaints" ||
    topicRaw === "smalltalk"
      ? topicRaw
      : "all";

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const threadWhere: any = {
    accountId,
    createdAt: { gte: since },
  };
  if (q) {
    threadWhere.messages = {
      some: {
        content: { contains: q, mode: "insensitive" },
      },
    };
  }

  const complaintMessageWhere = {
    role: "user",
    thread: { accountId, createdAt: { gte: since } },
    OR: COMPLAINT_KEYWORDS.map((k) => ({ content: { contains: k, mode: "insensitive" as const } })),
  };

  const [threadsMeta, actionsPeriod, complaintThreadsRows] = await Promise.all([
    prisma.aiThread.findMany({
      where: threadWhere,
      orderBy: { id: "desc" },
      select: {
        id: true,
        createdAt: true,
        clientId: true,
        bookingDraft: { select: { status: true } },
        actions: {
          where: { actionType: "public_ai_turn", status: "COMPLETED" },
          orderBy: { id: "asc" },
          select: { payload: true },
        },
      },
    }),
    prisma.aiAction.findMany({
      where: {
        actionType: "public_ai_turn",
        status: "COMPLETED",
        createdAt: { gte: since },
        thread: { accountId },
      },
      select: { threadId: true, payload: true },
    }),
    prisma.aiMessage.findMany({
      where: complaintMessageWhere,
      select: { threadId: true },
      distinct: ["threadId"],
    }),
  ]);

  const complaintThreadIds = new Set(complaintThreadsRows.map((x) => x.threadId));
  const threadIntentMap = new Map<number, Set<string>>();
  const threadRouteMap = new Map<number, Set<string>>();
  const threadOpenBookingMap = new Map<number, boolean>();

  for (const action of actionsPeriod) {
    const p = asPayload(action.payload);
    const intents = threadIntentMap.get(action.threadId) ?? new Set<string>();
    if (p.intent) intents.add(p.intent);
    threadIntentMap.set(action.threadId, intents);

    const routes = threadRouteMap.get(action.threadId) ?? new Set<string>();
    if (p.route) routes.add(p.route);
    threadRouteMap.set(action.threadId, routes);

    if (p.actionType === "open_booking") threadOpenBookingMap.set(action.threadId, true);
  }

  const filteredThreadIds = threadsMeta
    .filter((thread) => {
      const hasOpenBooking = threadOpenBookingMap.get(thread.id) === true;
      const hasBooking =
        hasOpenBooking ||
        (threadRouteMap.get(thread.id)?.has("booking-flow") ?? false) ||
        thread.bookingDraft?.status === "COMPLETED" ||
        thread.bookingDraft?.status === "WAITING_CONFIRMATION" ||
        thread.bookingDraft?.status === "WAITING_CONSENT";
      const hasComplaint = complaintThreadIds.has(thread.id);

      if (mode === "with_booking" && !hasBooking) return false;
      if (mode === "completed_booking" && thread.bookingDraft?.status !== "COMPLETED") return false;
      if (mode === "without_booking" && hasBooking) return false;

      if (topic === "complaints") return hasComplaint;

      const intents = threadIntentMap.get(thread.id) ?? new Set<string>();
      if (topic === "booking") {
        return (
          hasBooking ||
          intents.has("booking_start") ||
          intents.has("booking_set_service") ||
          intents.has("ask_availability")
        );
      }
      if (topic === "services") {
        return intents.has("ask_services") || intents.has("ask_price");
      }
      if (topic === "specialists") {
        return intents.has("ask_specialists");
      }
      if (topic === "smalltalk") {
        return (
          intents.has("smalltalk") ||
          intents.has("out_of_scope") ||
          intents.has("greeting") ||
          intents.has("post_completion_smalltalk")
        );
      }
      return true;
    })
    .map((x) => x.id);

  const totalFiltered = filteredThreadIds.length;
  const filteredThreadIdsSet = new Set(filteredThreadIds);
  const filteredThreadsMeta = threadsMeta.filter((thread) => filteredThreadIdsSet.has(thread.id));
  const filteredUniqueClients = new Set(
    filteredThreadsMeta.map((t) => t.clientId).filter((id): id is number => typeof id === "number"),
  ).size;

  const filteredComplaintThreadIds = new Set(filteredThreadIds.filter((id) => complaintThreadIds.has(id)));

  const [filteredUserMessagesTotal, filteredAssistantMessagesTotal, filteredComplaintMessagesTotal] =
    filteredThreadIds.length > 0
      ? await Promise.all([
          prisma.aiMessage.count({ where: { role: "user", threadId: { in: filteredThreadIds } } }),
          prisma.aiMessage.count({ where: { role: "assistant", threadId: { in: filteredThreadIds } } }),
          prisma.aiMessage.count({
            where: {
              role: "user",
              threadId: { in: filteredThreadIds },
              OR: COMPLAINT_KEYWORDS.map((k) => ({ content: { contains: k, mode: "insensitive" as const } })),
            },
          }),
        ])
      : [0, 0, 0];

  const intentTop = new Map<string, number>();
  const routeTop = new Map<string, number>();
  let turnsTotal = 0;
  let bookingFlowTurns = 0;
  let openBookingTurns = 0;
  let fallbackTurns = 0;

  for (const action of actionsPeriod) {
    if (!filteredThreadIdsSet.has(action.threadId)) continue;
    const p = asPayload(action.payload);
    turnsTotal += 1;
    if (p.route === "booking-flow") bookingFlowTurns += 1;
    if (p.actionType === "open_booking") openBookingTurns += 1;
    if (p.nluSource === "fallback") fallbackTurns += 1;
    if (p.intent) intentTop.set(p.intent, (intentTop.get(p.intent) ?? 0) + 1);
    if (p.route) routeTop.set(p.route, (routeTop.get(p.route) ?? 0) + 1);
  }

  const completedDraftThreads = filteredThreadsMeta.filter((t) => t.bookingDraft?.status === "COMPLETED").length;
  const consentWaitThreads = filteredThreadsMeta.filter(
    (t) => t.bookingDraft?.status === "WAITING_CONSENT" || t.bookingDraft?.status === "WAITING_CONFIRMATION",
  ).length;
  const avgDialogLen = filteredThreadsMeta.length
    ? ((filteredUserMessagesTotal + filteredAssistantMessagesTotal) / filteredThreadsMeta.length).toFixed(1)
    : "0.0";

  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const reqPage = parsePositiveInt(pickParam(rawParams, "page"), 1);
  const page = Math.min(Math.max(1, reqPage), totalPages);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageIds = filteredThreadIds.slice(start, end);

  const pageThreadsRaw = pageIds.length
    ? await prisma.aiThread.findMany({
        where: { id: { in: pageIds } },
        select: {
          id: true,
          createdAt: true,
          clientId: true,
          bookingDraft: { select: { status: true } },
          messages: {
            select: { role: true, content: true, createdAt: true },
            orderBy: { id: "asc" },
          },
          actions: {
            where: { actionType: "public_ai_turn", status: "COMPLETED" },
            select: { payload: true },
            orderBy: { id: "asc" },
          },
        },
      })
    : [];

  const pageOrder = new Map(pageIds.map((id, i) => [id, i]));
  const pageThreads = pageThreadsRaw.sort((a, b) => (pageOrder.get(a.id) ?? 0) - (pageOrder.get(b.id) ?? 0));

  const topIntents = [...intentTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topRoutes = [...routeTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const baseParams = { q, days, mode, topic, pageSize };
  const pages = paginationWindow(page, totalPages, MAX_PAGE_LINKS);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Раздел аналитики</p>
        <h1 className="text-2xl font-semibold tracking-tight">Аналитика AI-ассистента Аиши</h1>
        <p className="text-[color:var(--bp-muted)]">
          Полная аналитика по диалогам Аиши: жалобы, качество распознавания, путь к записи и детальные логи диалогов.
        </p>
        <AnalyticsTabs active="aisha" />
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6" method="get">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs text-[color:var(--bp-muted)]" htmlFor="aisha-q">
              Поиск по диалогам
            </label>
            <input
              id="aisha-q"
              name="q"
              defaultValue={q}
              placeholder="Текст сообщения или ключевая фраза"
              className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-base)] px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[color:var(--bp-muted)]" htmlFor="aisha-days">
              Период
            </label>
            <select
              id="aisha-days"
              name="days"
              defaultValue={String(days)}
              className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-base)] px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)]"
            >
              <option value="7">7 дней</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
              <option value="180">180 дней</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[color:var(--bp-muted)]" htmlFor="aisha-mode">
              Тип диалога
            </label>
            <select
              id="aisha-mode"
              name="mode"
              defaultValue={mode}
              className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-base)] px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)]"
            >
              <option value="all">Все</option>
              <option value="with_booking">С шагами записи</option>
              <option value="completed_booking">Завершён записью</option>
              <option value="without_booking">Без выхода в запись</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[color:var(--bp-muted)]" htmlFor="aisha-topic">
              Тематика
            </label>
            <select
              id="aisha-topic"
              name="topic"
              defaultValue={topic}
              className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-base)] px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)]"
            >
              <option value="all">Все темы</option>
              <option value="booking">Запись</option>
              <option value="services">Услуги/цены</option>
              <option value="specialists">Специалисты</option>
              <option value="complaints">Жалобы</option>
              <option value="smalltalk">Свободный разговор</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[color:var(--bp-muted)]" htmlFor="aisha-page-size">
              На странице
            </label>
            <select
              id="aisha-page-size"
              name="pageSize"
              defaultValue={String(pageSize)}
              className="w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-base)] px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)]"
            >
              {PAGE_SIZES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="page" value="1" />
          <div className="xl:col-span-6 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm transition hover:border-[color:var(--bp-accent)]"
            >
              Применить фильтры
            </button>
            <Link
              href="/crm/analytics/aisha"
              className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm text-[color:var(--bp-muted)] transition hover:border-[color:var(--bp-accent)] hover:text-[color:var(--bp-ink)]"
            >
              Сбросить фильтры
            </Link>
          </div>
          <div className="xl:col-span-6 text-xs text-[color:var(--bp-muted)]">
            `С шагами записи` = диалог дошёл до сценария записи или перехода к форме. `Завершён записью` = черновик
            записи завершён.
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Диалоги</div>
          <div className="mt-2 text-2xl font-semibold">{fInt(totalFiltered)}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">Уникальных клиентов: {fInt(filteredUniqueClients)}</div>
        </article>
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Сообщения</div>
          <div className="mt-2 text-2xl font-semibold">{fInt(filteredUserMessagesTotal + filteredAssistantMessagesTotal)}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
            Клиент: {fInt(filteredUserMessagesTotal)}, Аиша: {fInt(filteredAssistantMessagesTotal)}, средняя длина диалога: {avgDialogLen}
          </div>
        </article>
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Жалобы</div>
          <div className="mt-2 text-2xl font-semibold">{fInt(filteredComplaintThreadIds.size)}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
            Сообщений с жалобами: {fInt(filteredComplaintMessagesTotal)} ({toPct(filteredComplaintThreadIds.size, totalFiltered)} диалогов)
          </div>
        </article>
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Записи из Аиши</div>
          <div className="mt-2 text-2xl font-semibold">{fInt(completedDraftThreads)}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
            Переходов к записи: {fInt(openBookingTurns)}, шагов в сценарии записи: {fInt(bookingFlowTurns)}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Качество распознавания</h2>
          <div className="mt-3 grid gap-2 text-sm text-[color:var(--bp-muted)]">
            <div>Всего ходов ассистента: {fInt(turnsTotal)}</div>
            <div>
              Ходов с резервным разбором: {fInt(fallbackTurns)} ({toPct(fallbackTurns, turnsTotal)})
            </div>
            <div>Диалогов в ожидании подтверждения/согласия: {fInt(consentWaitThreads)}</div>
            <div>Завершенных черновиков записи: {fInt(completedDraftThreads)}</div>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Топ сценариев диалога</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {topRoutes.length ? (
                topRoutes.map(([name, count]) => (
                  <span
                    key={name}
                    className="rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-soft)] px-3 py-1 text-xs"
                  >
                    {routeLabel(name)}: {fInt(count)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-[color:var(--bp-muted)]">Нет данных.</span>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Топ запросов клиентов</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {topIntents.length ? (
              topIntents.map(([name, count]) => (
                <span
                  key={name}
                  className="rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-soft)] px-3 py-1 text-xs"
                >
                  {intentLabel(name)}: {fInt(count)}
                </span>
              ))
            ) : (
              <span className="text-sm text-[color:var(--bp-muted)]">Нет данных.</span>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Диалоги Аиши</h2>
            <p className="mt-1 text-sm text-[color:var(--bp-muted)]">
              Найдено {fInt(totalFiltered)} диалогов по фильтрам. Показано {fInt(pageThreads.length)}.
            </p>
          </div>
          <div className="text-sm text-[color:var(--bp-muted)]">
            Страница {fInt(page)} из {fInt(totalPages)}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {totalPages > 1 ? (
            <>
              {page > 1 ? (
                <Link
                  href={`/crm/analytics/aisha?${buildQueryString({ ...baseParams, page: page - 1 })}`}
                  className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm transition hover:border-[color:var(--bp-accent)]"
                >
                  Назад
                </Link>
              ) : null}
              {pages.map((p) => (
                <Link
                  key={p}
                  href={`/crm/analytics/aisha?${buildQueryString({ ...baseParams, page: p })}`}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm transition",
                    p === page
                      ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-soft)]"
                      : "border-[color:var(--bp-stroke)] hover:border-[color:var(--bp-accent)]",
                  ].join(" ")}
                >
                  {p}
                </Link>
              ))}
              {page < totalPages ? (
                <Link
                  href={`/crm/analytics/aisha?${buildQueryString({ ...baseParams, page: page + 1 })}`}
                  className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm transition hover:border-[color:var(--bp-accent)]"
                >
                  Далее
                </Link>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {pageThreads.length ? (
            pageThreads.map((thread) => {
              const threadComplaint = thread.messages.some(
                (m) => m.role === "user" && isComplaintText(m.content),
              );
              const turnPayloads = thread.actions.map((a) => asPayload(a.payload));
              const threadHasBookingOpen = turnPayloads.some((p) => p.actionType === "open_booking");
              const threadIntents = [
                ...new Set(turnPayloads.map((p) => p.intent).filter((x): x is string => Boolean(x))),
              ].slice(0, 8);
              const threadRoutes = [
                ...new Set(turnPayloads.map((p) => p.route).filter((x): x is string => Boolean(x))),
              ].slice(0, 4);
              const threadNluSources = [
                ...new Set(turnPayloads.map((p) => p.nluSource).filter((x): x is string => Boolean(x))),
              ].slice(0, 3);
              const hasServiceTopic = thread.messages.some((m) =>
                m.role === "user" ? includesAny(m.content, SERVICE_KEYWORDS) : false,
              );
              const hasSpecialistTopic = thread.messages.some((m) =>
                m.role === "user" ? includesAny(m.content, SPECIALIST_KEYWORDS) : false,
              );

              return (
                <details
                  key={thread.id}
                  className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-base)] p-4"
                >
                  <summary className="cursor-pointer list-none">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">Диалог #{thread.id}</span>
                      <span className="text-xs text-[color:var(--bp-muted)]">{fDateTime(thread.createdAt)}</span>
                      {threadComplaint ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                          Есть жалоба
                        </span>
                      ) : null}
                      {threadHasBookingOpen ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          Доведен до шага записи
                        </span>
                      ) : null}
                      {hasServiceTopic ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                          Тема: услуги
                        </span>
                      ) : null}
                      {hasSpecialistTopic ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                          Тема: специалисты
                        </span>
                      ) : null}
                      {thread.bookingDraft?.status ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                          Статус: {draftStatusLabel(thread.bookingDraft.status)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--bp-muted)]">
                      {threadRoutes.map((r) => (
                        <span
                          key={`${thread.id}-r-${r}`}
                          className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-0.5"
                        >
                          Сценарий: {routeLabel(r)}
                        </span>
                      ))}
                      {threadIntents.map((i) => (
                        <span
                          key={`${thread.id}-i-${i}`}
                          className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-0.5"
                        >
                          Запрос: {intentLabel(i)}
                        </span>
                      ))}
                      {threadNluSources.map((s) => (
                        <span
                          key={`${thread.id}-s-${s}`}
                          className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-0.5"
                        >
                          Разбор: {nluSourceLabel(s)}
                        </span>
                      ))}
                    </span>
                  </summary>

                  <div className="mt-3 max-h-[420px] space-y-2 overflow-auto pr-1">
                    {thread.messages.map((m, idx) => (
                      <div
                        key={`${thread.id}-${idx}`}
                        className={[
                          "rounded-xl px-3 py-2 text-sm",
                          m.role === "assistant"
                            ? "bg-[color:var(--bp-paper)]"
                            : "bg-[color:var(--bp-soft)]",
                        ].join(" ")}
                      >
                        <div className="mb-1 text-[11px] uppercase tracking-wide text-[color:var(--bp-muted)]">
                          {m.role === "assistant" ? "Аиша" : "Клиент"} · {fDateTime(m.createdAt)}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })
          ) : (
            <div className="rounded-xl border border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
              По выбранным фильтрам диалогов не найдено.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}



