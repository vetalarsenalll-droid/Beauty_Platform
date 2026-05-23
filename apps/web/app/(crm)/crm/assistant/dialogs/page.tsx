import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireCrmPermission } from "@/lib/auth";
import { int, money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;

type SearchParamsShape = Record<string, string | string[] | undefined>;

type ActionPayload = {
  intent?: string | null;
  route?: string | null;
  routeReason?: string | null;
  guardReason?: string | null;
  debug?: unknown;
};

type PageProps = {
  searchParams?: Promise<SearchParamsShape>;
};

function fDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(value);
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

function asPayload(value: Prisma.JsonValue): ActionPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    intent: typeof record.intent === "string" ? record.intent : null,
    route: typeof record.route === "string" ? record.route : null,
    routeReason: typeof record.routeReason === "string" ? record.routeReason : null,
    guardReason: typeof record.guardReason === "string" ? record.guardReason : null,
    debug: record.debug,
  };
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") sp.set(key, String(value));
  }
  return sp.toString();
}

export default async function CrmAssistantDialogsPage({ searchParams }: PageProps) {
  const session = await requireCrmPermission("crm.assistant.dialogs.read");
  const accountId = session.accountId;
  const rawParams = (await Promise.resolve(searchParams ?? {})) as SearchParamsShape;
  const q = pickParam(rawParams, "q").trim();
  const route = pickParam(rawParams, "route").trim();
  const guard = pickParam(rawParams, "guard").trim();
  const status = pickParam(rawParams, "status").trim();
  const selectedThreadId = parsePositiveInt(pickParam(rawParams, "threadId"), 0);
  const page = parsePositiveInt(pickParam(rawParams, "page"), 1);

  const threadWhere: Prisma.AiThreadWhereInput = {
    accountId,
    ...(selectedThreadId ? { id: selectedThreadId } : {}),
    ...(q
      ? {
          messages: {
            some: { content: { contains: q, mode: "insensitive" } },
          },
        }
      : {}),
  };

  const candidateThreads = await prisma.aiThread.findMany({
    where: threadWhere,
    orderBy: { id: "desc" },
    take: selectedThreadId ? 1 : 250,
    include: {
      bookingDraft: true,
      messages: { orderBy: { id: "asc" }, take: selectedThreadId ? 200 : 12 },
      actions: {
        orderBy: { id: "desc" },
        take: selectedThreadId ? 50 : 5,
        include: { logs: { orderBy: { createdAt: "desc" }, take: 10 } },
      },
    },
  });

  const filteredThreads = candidateThreads.filter((thread) => {
    const payloads = thread.actions.map((action) => asPayload(action.payload));
    if (status && !thread.actions.some((action) => action.status === status)) return false;
    if (route && !payloads.some((payload) => payload.route === route)) return false;
    if (guard && !payloads.some((payload) => payload.guardReason === guard)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredThreads.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageThreads = selectedThreadId
    ? filteredThreads
    : filteredThreads.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const threadIds = pageThreads.map((thread) => thread.id);
  const actionIds = pageThreads.flatMap((thread) => thread.actions.map((action) => action.id));

  const [usageByThread, usageByAction] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ["threadId"],
      where: { accountId, threadId: { in: threadIds } },
      _sum: { totalTokens: true, chargedRub: true },
    }),
    prisma.aiUsage.findMany({
      where: { accountId, actionId: { in: actionIds } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        actionId: true,
        purpose: true,
        provider: true,
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        chargedRub: true,
        createdAt: true,
      },
    }),
  ]);
  const usageMap = new Map(usageByThread.map((row) => [row.threadId, row]));
  const actionUsageMap = new Map<number, typeof usageByAction>();
  for (const usage of usageByAction) {
    if (!usage.actionId) continue;
    actionUsageMap.set(usage.actionId, [...(actionUsageMap.get(usage.actionId) ?? []), usage]);
  }

  const baseParams = { q, route, guard, status };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Ассистент</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Диалоги AI-ассистента</h1>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
          Журнал диалогов, route/guard reasons, usage по turn и технические AiLog-записи.
        </p>
      </header>

      <form className="grid gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 text-sm shadow-[var(--bp-shadow)] lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto]">
        <input name="q" defaultValue={q} placeholder="Поиск по сообщениям" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
        <input name="route" defaultValue={route} placeholder="route" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
        <input name="guard" defaultValue={guard} placeholder="guardReason" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
        <input name="status" defaultValue={status} placeholder="action status" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
        <button className="rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 font-medium text-white">Фильтровать</button>
      </form>

      {!selectedThreadId && totalPages > 1 ? (
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {safePage > 1 ? <PageLink page={safePage - 1} params={baseParams}>Назад</PageLink> : null}
          <span className="text-[color:var(--bp-muted)]">Страница {safePage} из {totalPages}</span>
          {safePage < totalPages ? <PageLink page={safePage + 1} params={baseParams}>Далее</PageLink> : null}
        </nav>
      ) : null}

      <section className="grid gap-4">
        {pageThreads.map((thread) => {
          const usage = usageMap.get(thread.id);
          const latestAction = thread.actions[0] ?? null;
          const payload = latestAction ? asPayload(latestAction.payload) : {};
          const isFull = selectedThreadId === thread.id;
          return (
            <article key={thread.id} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Диалог #{thread.id}</h2>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{fDate(thread.createdAt)}</div>
                </div>
                <div className="text-right text-sm">
                  <div>{int(usage?._sum.totalTokens)} токенов</div>
                  <div className="text-xs text-[color:var(--bp-muted)]">{money(usage?._sum.chargedRub)} ₽ списано</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {thread.bookingDraft?.status ? <Badge>draft: {thread.bookingDraft.status}</Badge> : null}
                {thread.bookingDraft?.completedAppointmentId ? <Badge>запись #{thread.bookingDraft.completedAppointmentId}</Badge> : null}
                {payload.route ? <Badge>route: {payload.route}</Badge> : null}
                {payload.intent ? <Badge>intent: {payload.intent}</Badge> : null}
                {payload.routeReason ? <Badge>routeReason: {payload.routeReason}</Badge> : null}
                {payload.guardReason ? <Badge>guardReason: {payload.guardReason}</Badge> : null}
              </div>

              {!isFull ? (
                <Link
                  href={`/crm/assistant/dialogs?${buildQuery({ ...baseParams, threadId: thread.id })}`}
                  className="mt-4 inline-flex rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]"
                >
                  Полный просмотр
                </Link>
              ) : (
                <Link
                  href={`/crm/assistant/dialogs?${buildQuery(baseParams)}`}
                  className="mt-4 inline-flex rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]"
                >
                  Вернуться к списку
                </Link>
              )}

              <div className="mt-4 grid gap-2">
                {thread.messages.map((message) => (
                  <div key={message.id} className={message.role === "assistant" ? "rounded-xl bg-[color:var(--bp-base)] px-3 py-2 text-sm" : "rounded-xl bg-[color:var(--bp-soft)] px-3 py-2 text-sm"}>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-[color:var(--bp-muted)]">
                      {message.role} · {fDate(message.createdAt)}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  </div>
                ))}
              </div>

              {isFull ? (
                <div className="mt-5 grid gap-4">
                  {thread.actions.map((action) => {
                    const actionPayload = asPayload(action.payload);
                    const usages = actionUsageMap.get(action.id) ?? [];
                    return (
                      <details key={action.id} className="rounded-xl border border-[color:var(--bp-stroke)] p-4" open={action.id === latestAction?.id}>
                        <summary className="cursor-pointer text-sm font-semibold">
                          Turn #{action.id} · {action.status} · {fDate(action.createdAt)}
                        </summary>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {actionPayload.route ? <Badge>route: {actionPayload.route}</Badge> : null}
                          {actionPayload.routeReason ? <Badge>routeReason: {actionPayload.routeReason}</Badge> : null}
                          {actionPayload.guardReason ? <Badge>guardReason: {actionPayload.guardReason}</Badge> : null}
                        </div>
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[720px] text-xs">
                            <thead className="text-left text-[color:var(--bp-muted)]">
                              <tr>
                                <th className="py-2 pr-3">Usage</th>
                                <th className="py-2 pr-3">Purpose</th>
                                <th className="py-2 pr-3">Model</th>
                                <th className="py-2 pr-3">Prompt</th>
                                <th className="py-2 pr-3">Completion</th>
                                <th className="py-2 pr-3">Total</th>
                                <th className="py-2 pr-3">Charged</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usages.map((usageRow) => (
                                <tr key={usageRow.id} className="border-t border-[color:var(--bp-stroke)]">
                                  <td className="py-2 pr-3">#{usageRow.id}</td>
                                  <td className="py-2 pr-3">{usageRow.purpose}</td>
                                  <td className="py-2 pr-3">{usageRow.provider}/{usageRow.model}</td>
                                  <td className="py-2 pr-3">{int(usageRow.promptTokens)}</td>
                                  <td className="py-2 pr-3">{int(usageRow.completionTokens)}</td>
                                  <td className="py-2 pr-3">{int(usageRow.totalTokens)}</td>
                                  <td className="py-2 pr-3">{money(usageRow.chargedRub)} ₽</td>
                                </tr>
                              ))}
                              {!usages.length ? <tr><td colSpan={7} className="py-2 text-[color:var(--bp-muted)]">Usage для turn не записан.</td></tr> : null}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {action.logs.map((log) => (
                            <div key={log.id} className="rounded-lg bg-[color:var(--bp-soft)] px-3 py-2 text-xs">
                              <div className="font-medium">{log.level}: {log.message}</div>
                              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[color:var(--bp-muted)]">{JSON.stringify(log.data, null, 2)}</pre>
                            </div>
                          ))}
                        </div>
                        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[color:var(--bp-soft)] p-3 text-xs text-[color:var(--bp-muted)]">
                          {JSON.stringify(actionPayload.debug ?? action.payload, null, 2)}
                        </pre>
                      </details>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
        {!pageThreads.length ? <div className="rounded-2xl border border-[color:var(--bp-stroke)] p-5 text-sm text-[color:var(--bp-muted)]">Диалогов по фильтрам не найдено.</div> : null}
      </section>
    </div>
  );
}

function PageLink({ page, params, children }: { page: number; params: Record<string, string>; children: React.ReactNode }) {
  return (
    <Link
      href={`/crm/assistant/dialogs?${buildQuery({ ...params, page })}`}
      className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 hover:border-[color:var(--bp-accent)]"
    >
      {children}
    </Link>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1">{children}</span>;
}
