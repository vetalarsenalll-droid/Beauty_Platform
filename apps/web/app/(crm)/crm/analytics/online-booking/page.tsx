import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsTabs } from "../_components/analytics-tabs";
import { OnlineBookingFilters } from "./filters";

const DEFAULT_DAYS = 30;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZES = [10, 20, 50, 100] as const;
const MAX_PAGE_LINKS = 7;

type SearchParamsShape = Record<string, string | string[] | undefined>;

type TrendRow = {
  ymd: string;
  sessions: number;
  completed: number;
};

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
  if (pct > 0 && pct < 1) {
    return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(pct)}%`;
  }
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(pct))}%`;
}

function formatDayLabel(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(dt);
}

function formatYmdReadable(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(dt);
}

function splitStepsByCompletion<T extends { stepKey?: string | null }>(steps: T[]) {
  if (!steps.length) return [];
  const segments: Array<{ steps: T[]; completed: boolean; appointmentId: number | null }> = [];
  let current: T[] = [];
  for (const step of steps) {
    current.push(step);
    if (step.stepKey === "completed") {
      const appointmentId = extractAppointmentIdFromStep(step);
      segments.push({ steps: current, completed: true, appointmentId });
      current = [];
    }
  }
  if (current.length) {
    segments.push({ steps: current, completed: false, appointmentId: null });
  }
  return segments;
}

function extractAppointmentIdFromStep(step: any) {
  const raw = step?.payload?.appointmentId ?? step?.payload?.appointment_id ?? null;
  const num = Number(raw);
  return Number.isInteger(num) && num > 0 ? num : null;
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

function parseQueryDateRange(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return null;
  let y: number | null = null;
  let m: number | null = null;
  let d: number | null = null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const ru = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
    if (ru) {
      d = Number(ru[1]);
      m = Number(ru[2]);
      y = Number(ru[3]);
    }
  }
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Moscow day range in UTC (UTC+3)
  const utcStart = new Date(Date.UTC(y, m - 1, d, -3, 0, 0));
  const utcEnd = new Date(Date.UTC(y, m - 1, d + 1, -3, 0, 0));
  return { utcStart, utcEnd };
}

function buildQueryString(params: {
  q: string;
  period: string;
  status: string;
  pageSize: number;
  page: number;
  trendPage: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.period && params.period !== "month") sp.set("period", params.period);
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.pageSize && params.pageSize !== DEFAULT_PAGE_SIZE) sp.set("pageSize", String(params.pageSize));
  if (params.page > 1) sp.set("page", String(params.page));
  if (params.trendPage > 1) sp.set("trendPage", String(params.trendPage));
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

function toYmdInTz(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

type PageProps = {
  searchParams?: SearchParamsShape | Promise<SearchParamsShape>;
};

export default async function OnlineBookingAnalyticsPage({ searchParams }: PageProps) {
  const session = await requireCrmPermission("crm.analytics.read");
  const accountId = session.accountId;
  const rawParams = (await Promise.resolve(searchParams ?? {})) as SearchParamsShape;

  const q = pickParam(rawParams, "q").trim();
  const period = pickParam(rawParams, "period").trim() || "month";
  const status = pickParam(rawParams, "status").trim() || "all";
  const pageSize = parsePositiveInt(pickParam(rawParams, "pageSize"), DEFAULT_PAGE_SIZE);
  const safePageSize = (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
  const page = parsePositiveInt(pickParam(rawParams, "page"), 1);
  const trendPage = parsePositiveInt(pickParam(rawParams, "trendPage"), 1);
  const trendPageSize = 10;

  const periodDays = period === "year" ? 365 : period === "week" ? 7 : DEFAULT_DAYS;
  const since = new Date(Date.now() - periodDays * 86_400_000);

  const where: any = {
    accountId,
    startedAt: { gte: since },
  };

  if (q) {
    const dateRange = parseQueryDateRange(q);
    const orFilters: any[] = [
      { appointment: { client: { phone: { contains: q } } } },
      { appointment: { client: { firstName: { contains: q, mode: "insensitive" } } } },
      { appointment: { client: { lastName: { contains: q, mode: "insensitive" } } } },
      { appointment: { location: { name: { contains: q, mode: "insensitive" } } } },
      { appointment: { services: { some: { service: { name: { contains: q, mode: "insensitive" } } } } } },
      {
        appointment: {
          specialist: {
            user: { profile: { firstName: { contains: q, mode: "insensitive" } } },
          },
        },
      },
      {
        appointment: {
          specialist: {
            user: { profile: { lastName: { contains: q, mode: "insensitive" } } },
          },
        },
      },
    ];
    if (dateRange) {
      orFilters.push({
        appointment: { startAt: { gte: dateRange.utcStart, lt: dateRange.utcEnd } },
      });
    }
    where.OR = orFilters;
  }

  if (status === "completed") {
    where.appointmentId = { not: null };
  } else if (status === "incomplete") {
    where.appointmentId = null;
  }

  const db = prisma as any;
  const [totalFiltered, completedCount, sessions, filteredSessionIds, trendSessions, aiAssistantAppointments] = await Promise.all([
    db.onlineBookingSession.count({ where }),
    db.onlineBookingSession.count({ where: { ...where, appointmentId: { not: null } } }),
    db.onlineBookingSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * safePageSize,
      take: safePageSize,
      include: {
        appointment: {
          select: {
            id: true,
            startAt: true,
            status: true,
            client: { select: { firstName: true, lastName: true, phone: true } },
            location: { select: { name: true } },
            specialist: {
              select: {
                user: { select: { profile: { select: { firstName: true, lastName: true } } } },
              },
            },
            services: { select: { service: { select: { name: true } } } },
          },
        },
        steps: { orderBy: { createdAt: "asc" } },
      },
    }),
    q ? db.onlineBookingSession.findMany({ where, select: { id: true } }) : Promise.resolve([] as Array<{ id: number }>),
    db.onlineBookingSession.findMany({
      where,
      select: { startedAt: true, appointmentId: true },
    }),
    prisma.appointment.count({
      where: {
        accountId,
        source: "ai_assistant",
        startAt: { gte: since },
      },
    }),
  ]);

  const filteredIds = q ? filteredSessionIds.map((item: { id: number }) => item.id) : null;
  const steps = await db.onlineBookingStep.findMany({
    where: filteredIds
      ? { accountId, sessionId: { in: filteredIds }, createdAt: { gte: since } }
      : { accountId, createdAt: { gte: since } },
    select: {
      sessionId: true,
      stepKey: true,
      createdAt: true,
      stepTitle: true,
      locationId: true,
      serviceId: true,
      specialistId: true,
      date: true,
      time: true,
    },
  });

  const stepSessionsByKey = new Map<string, Set<number>>();
  for (const step of steps) {
    if (!step.stepKey) continue;
    if (!stepSessionsByKey.has(step.stepKey)) {
      stepSessionsByKey.set(step.stepKey, new Set());
    }
    stepSessionsByKey.get(step.stepKey)!.add(step.sessionId);
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / safePageSize));
  const pageLinks = paginationWindow(page, totalPages, MAX_PAGE_LINKS);

  const trendMap = new Map<string, TrendRow>();
  for (let i = periodDays - 1; i >= 0; i -= 1) {
    const dt = new Date(Date.now() - i * 86_400_000);
    const ymd = toYmdInTz(dt);
    trendMap.set(ymd, { ymd, sessions: 0, completed: 0 });
  }

  for (const item of trendSessions) {
    const ymd = toYmdInTz(item.startedAt);
    const row = trendMap.get(ymd);
    if (row) row.sessions += 1;
    if (row && item.appointmentId) row.completed += 1;
  }

  const trendRowsAll = Array.from(trendMap.values());
  const trendTotalPages = Math.max(1, Math.ceil(trendRowsAll.length / trendPageSize));
  const safeTrendPage = Math.min(Math.max(1, trendPage), trendTotalPages);
  const trendPageLinks = paginationWindow(safeTrendPage, trendTotalPages, MAX_PAGE_LINKS);
  const trendStart = (safeTrendPage - 1) * trendPageSize;
  const trendRows = trendRowsAll.slice(trendStart, trendStart + trendPageSize);

  const funnel = [
    { key: "start", label: "Старт записи", value: totalFiltered },
    {
      key: "location",
      label: "Выбрана локация",
      value: stepSessionsByKey.get("location")?.size ?? 0,
    },
    {
      key: "service",
      label: "Выбрана услуга",
      value: stepSessionsByKey.get("service")?.size ?? 0,
    },
    {
      key: "datetime",
      label: "Выбраны дата/время",
      value: stepSessionsByKey.get("datetime")?.size ?? 0,
    },
    {
      key: "specialist",
      label: "Выбран специалист",
      value: stepSessionsByKey.get("specialist")?.size ?? 0,
    },
    {
      key: "details",
      label: "Введены контакты",
      value: stepSessionsByKey.get("details")?.size ?? 0,
    },
    {
      key: "completed",
      label: "Завершено записью",
      value: completedCount,
    },
  ];

  const locationIds = new Set<number>();
  const serviceIds = new Set<number>();
  const specialistIds = new Set<number>();
  const appointmentIdsFromSteps = new Set<number>();
  for (const sessionItem of sessions) {
    for (const step of sessionItem.steps) {
      if (step.locationId) locationIds.add(step.locationId);
      if (step.serviceId) serviceIds.add(step.serviceId);
      if (step.specialistId) specialistIds.add(step.specialistId);
      const apptId = extractAppointmentIdFromStep(step);
      if (apptId) appointmentIdsFromSteps.add(apptId);
    }
    if (sessionItem.appointmentId) appointmentIdsFromSteps.add(sessionItem.appointmentId);
  }

  const [locations, services, specialists, appointmentDetails] = await Promise.all([
    locationIds.size
      ? prisma.location.findMany({
          where: { accountId, id: { in: Array.from(locationIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    serviceIds.size
      ? prisma.service.findMany({
          where: { accountId, id: { in: Array.from(serviceIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    specialistIds.size
      ? prisma.specialistProfile.findMany({
          where: { accountId, id: { in: Array.from(specialistIds) } },
          select: { id: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
        })
      : Promise.resolve([]),
    appointmentIdsFromSteps.size
      ? prisma.appointment.findMany({
          where: { accountId, id: { in: Array.from(appointmentIdsFromSteps) } },
          select: {
            id: true,
            startAt: true,
            status: true,
            client: { select: { firstName: true, lastName: true, phone: true } },
            location: { select: { name: true } },
            specialist: { select: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
            services: { select: { service: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const locationMap = new Map(locations.map((item) => [item.id, item.name]));
  const serviceMap = new Map(services.map((item) => [item.id, item.name]));
  const specialistMap = new Map(
    specialists.map((item) => [
      item.id,
      [item.user.profile?.firstName, item.user.profile?.lastName].filter(Boolean).join(" "),
    ])
  );
  const appointmentMap = new Map(appointmentDetails.map((item) => [item.id, item]));

  const bookingCards = sessions.flatMap((sessionItem: any) => {
    const segments = splitStepsByCompletion(sessionItem.steps);
    const lastCompletedIndex = segments.reduce((acc, seg, i) => (seg.completed ? i : acc), -1);
    return segments
      .filter((seg) => {
        if (status === "completed") return seg.completed;
        if (status === "incomplete") return !seg.completed;
        return true;
      })
      .map((seg, idx) => {
        const appointmentId =
          seg.appointmentId ?? (seg.completed && idx === lastCompletedIndex ? sessionItem.appointmentId : null);
        const appointment = appointmentId ? appointmentMap.get(appointmentId) : null;
        return {
          appointmentId,
          appointment,
          steps: seg.steps,
          completed: seg.completed,
          session: sessionItem,
        };
      });
  });

  return (
    <div className="flex flex-col gap-6">

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Сессии</div>
          <div className="mt-2 text-2xl font-semibold">{fInt(totalFiltered)}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
            Завершено записью: {fInt(completedCount)}
          </div>
        </article>
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Конверсия</div>
          <div className="mt-2 text-2xl font-semibold">{toPct(completedCount, totalFiltered)}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
            Завершено записью / старт
          </div>
        </article>
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Записи всего</div>
          <div className="mt-2 text-2xl font-semibold">{fInt(completedCount)}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">Создано из онлайн-записи</div>
        </article>
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Незавершенные</div>
          <div className="mt-2 text-2xl font-semibold">{fInt(Math.max(0, totalFiltered - completedCount))}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">Сессии без записи</div>
        </article>
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="text-sm text-[color:var(--bp-muted)]">Записи из AI-ассистента</div>
          <div className="mt-2 text-2xl font-semibold">{fInt(aiAssistantAppointments)}</div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">Созданы через AI-ассистента</div>
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <OnlineBookingFilters q={q} period={period} status={status} pageSize={safePageSize} />

      </section>

      <section className="min-w-0 grid w-full gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <article className="min-w-0 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="text-sm font-semibold">Воронка онлайн-записи</div>
          <div className="mt-4 grid gap-2">
            {funnel.map((item: { key: string; label: string; value: number }) => (
              <div
                key={item.key}
                className="min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
              >
                <div className="min-w-0 text-sm text-[color:var(--bp-ink)]">{item.label}</div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  {fInt(item.value)} ({toPct(item.value, totalFiltered)})
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="min-w-0 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="text-sm font-semibold">Тренд по дням</div>
          <div className="mt-4 min-w-0 w-full overflow-x-auto">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead className="text-xs uppercase text-[color:var(--bp-muted)]">
                <tr>
                  <th className="py-2 pr-4">День</th>
                  <th className="py-2 pr-4">Сессии</th>
                  <th className="py-2 pr-4">Завершены записью</th>
                  <th className="py-2">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {trendRows.map((row) => (
                  <tr key={row.ymd} className="border-t border-[color:var(--bp-stroke)]">
                    <td className="py-2 pr-4 text-[color:var(--bp-muted)]">
                      {formatDayLabel(row.ymd)}
                    </td>
                    <td className="py-2 pr-4">{fInt(row.sessions)}</td>
                    <td className="py-2 pr-4">{fInt(row.completed)}</td>
                    <td className="py-2">{toPct(row.completed, row.sessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--bp-muted)]">
            <span>Страница {safeTrendPage} из {trendTotalPages}</span>
            <span>·</span>
            <span>Всего дней: {fInt(trendRowsAll.length)}</span>
          </div>
          {trendTotalPages > 1 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {trendPageLinks.map((p) => {
                const qs = buildQueryString({ q, period, status, pageSize: safePageSize, page, trendPage: p });
                const href = qs ? `/crm/analytics/online-booking?${qs}` : "/crm/analytics/online-booking";
                return (
                  <Link
                    key={p}
                    href={href}
                    className={`rounded-xl border px-3 py-2 ${
                      p === safeTrendPage
                        ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-soft)] text-[color:var(--bp-ink)]"
                        : "border-[color:var(--bp-stroke)] text-[color:var(--bp-muted)] hover:border-[color:var(--bp-accent)] hover:text-[color:var(--bp-ink)]"
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <div className="mt-4 space-y-4">
          {[...bookingCards].sort((a: any, b: any) => {
            const aLast = a.steps[a.steps.length - 1]?.createdAt ?? a.session?.lastSeenAt ?? a.session?.startedAt;
            const bLast = b.steps[b.steps.length - 1]?.createdAt ?? b.session?.lastSeenAt ?? b.session?.startedAt;
            const aTime = aLast ? new Date(aLast).getTime() : 0;
            const bTime = bLast ? new Date(bLast).getTime() : 0;
            return bTime - aTime;
          }).map((item: any, index: number) => {
            const appointment = item.appointment ?? null;
            const clientName = appointment?.client
              ? [appointment.client.firstName, appointment.client.lastName].filter(Boolean).join(" ")
              : null;
            const appointmentService = appointment?.services?.[0]?.service?.name ?? null;
            const firstStepAt = item.steps[0]?.createdAt ?? null;
            const lastStepAt = item.steps[item.steps.length - 1]?.createdAt ?? null;
            return (
              <details
                key={`${item.session?.id ?? "session"}-${item.appointmentId ?? "no"}-${index}`}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {item.appointmentId ? `Запись #${item.appointmentId}` : "Попытка записи"}
                      </div>
                      <div className="text-xs text-[color:var(--bp-muted)]">
                        Старт: {firstStepAt ? fDateTime(firstStepAt) : fDateTime(item.session.startedAt)} · Последняя активность:{" "}
                        {lastStepAt ? fDateTime(lastStepAt) : fDateTime(item.session.lastSeenAt)}
                      </div>
                      {clientName || appointment?.client?.phone ? (
                        <div className="text-xs text-[color:var(--bp-muted)]">
                          Клиент: {clientName || "Без имени"}
                          {appointment?.client?.phone ? ` · ${appointment.client.phone}` : ""}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      {appointment?.startAt ? `Дата записи: ${fDateTime(appointment.startAt)}` : "Запись не завершена"}
                    </div>
                  </div>
                </summary>

                <div className="mt-4 space-y-3">
                  {appointmentService ? (
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      Услуга в записи: {appointmentService}
                    </div>
                  ) : null}
                  {appointment?.location?.name ||
                  appointment?.specialist?.user?.profile?.firstName ||
                  appointment?.specialist?.user?.profile?.lastName ? (
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      {appointment?.location?.name
                        ? `Локация: ${appointment.location.name}`
                        : ""}
                      {appointment?.location?.name &&
                      (appointment?.specialist?.user?.profile?.firstName ||
                        appointment?.specialist?.user?.profile?.lastName)
                        ? " · "
                        : ""}
                      {appointment?.specialist?.user?.profile ? (
                        <>
                          Специалист:{" "}
                          {[
                            appointment.specialist.user.profile.firstName,
                            appointment.specialist.user.profile.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
                    <div className="text-xs font-semibold text-[color:var(--bp-muted)]">
                      Шаги онлайн-записи
                    </div>
                    <div className="mt-2 space-y-3">
                      {item.steps.length === 0 ? (
                        <div className="text-xs text-[color:var(--bp-muted)]">Шаги не зафиксированы.</div>
                      ) : (
                        item.steps.map((step: any) => {
                          const parts: string[] = [];
                          if (step.locationId) {
                            parts.push(
                              `Локация: ${locationMap.get(step.locationId) ?? `#${step.locationId}`}`
                            );
                          }
                          if (step.serviceId) {
                            parts.push(
                              `Услуга: ${serviceMap.get(step.serviceId) ?? `#${step.serviceId}`}`
                            );
                          }
                          if (step.specialistId) {
                            parts.push(
                              `Специалист: ${specialistMap.get(step.specialistId) ?? `#${step.specialistId}`}`
                            );
                          }
                          if (step.date) parts.push(`Дата: ${formatYmdReadable(step.date)}`);
                          if (step.time) parts.push(`Время: ${step.time}`);
                          return (
                            <div key={step.id} className="text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{step.stepTitle || step.stepKey}</span>
                                <span className="text-[color:var(--bp-muted)]">{fDateTime(step.createdAt)}</span>
                              </div>
                              {parts.length ? (
                                <div className="text-[color:var(--bp-muted)]">{parts.join(" · ")}</div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        {totalPages > 1 ? (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            {pageLinks.map((p) => {
              const qs = buildQueryString({ q, period, status, pageSize: safePageSize, page: p, trendPage: safeTrendPage });
              const href = qs ? `/crm/analytics/online-booking?${qs}` : "/crm/analytics/online-booking";
              return (
                <Link
                  key={p}
                  href={href}
                  className={`rounded-xl border px-3 py-2 ${
                    p === page
                      ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-soft)] text-[color:var(--bp-ink)]"
                      : "border-[color:var(--bp-stroke)] text-[color:var(--bp-muted)] hover:border-[color:var(--bp-accent)] hover:text-[color:var(--bp-ink)]"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
