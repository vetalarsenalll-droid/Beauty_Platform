"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type JsonRecord = Record<string, unknown>;

type AssistantAction = {
  id: number;
  actionType: string;
  summary: string;
  status: string;
  riskLevel: string;
  permission: string | null;
  payload: unknown;
  expiresAt?: string;
  createdAt?: string;
};

type ChatMessage = {
  id?: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt?: string;
};

type AgentWorkItem = {
  toolName?: string | null;
  error?: string | null;
};

type AgentWork = {
  answer: string;
  selectedToolName?: string | null;
  toolSteps: AgentWorkItem[];
  pendingActions: AssistantAction[];
};

export type CockpitData = {
  context: {
    account?: { name?: string | null; slug?: string | null } | null;
    ai: {
      balanceRub: number | string;
      aiEnabled: boolean;
      crmAgentEnabled: boolean;
      dailySpendLimitRub: number | string | null;
      monthlySpendLimitRub: number | string | null;
      stopWhenBalanceBelowRub: number | string | null;
    };
    summary: Record<string, number>;
    autopilot: {
      level: string;
      safeDomains: string[];
      requireConfirmationFor: string[];
    };
    latestReviews: Array<JsonRecord>;
    memory: Array<{ id: number; key: string; value: unknown; confidence?: number | string; source?: string | null }>;
    insights: Array<{ id: number; title: string; summary: string; type: string; priority: number; status: string }>;
    pendingActions: AssistantAction[];
  };
  tasks: Array<{ id: number; title: string; description?: string | null; status: string; type: string }>;
  campaigns: Array<{ id: number; title: string; goal: string; status: string; result?: unknown; error?: string | null }>;
  drafts: {
    notifications: Array<{ id: number; title: string; channel: string; status: string; bodyText: string }>;
    reviews: Array<{ id: number; reviewId: number; status: string; replyText: string }>;
    site: Array<{ id: number; targetType: string; summary: string; status: string }>;
  };
  audit: Array<{ id: number; action: string; targetType: string; targetId?: string | null; createdAt: string }>;
  debug?: {
    canRead: boolean;
    runs: Array<{
      id: number;
      runType: string;
      status: string;
      error?: string | null;
      startedAt?: string;
      finishedAt?: string | null;
      toolCalls: Array<{ id: number; toolName: string; status: string; error?: string | null }>;
      usage: { totalTokens: number; chargedRub: number | string; items: Array<{ id: number; provider: string; model: string; purpose: string; totalTokens: number; chargedRub: number | string }> };
    }>;
  };
  tools: Array<{ name: string; domain: string; mode: string; riskLevel: string; requiredPermission: string | null }>;
};

const statusLabels: Record<string, string> = {
  PENDING: "Ждёт решения",
  CONFIRMED: "Подтверждено",
  EXECUTED: "Выполнено",
  REJECTED: "Отклонено",
  EXPIRED: "Истекло",
  FAILED: "Ошибка",
  NEW: "Новое",
  VIEWED: "Просмотрено",
  ACCEPTED: "Принято",
  DISMISSED: "Скрыто",
  OPEN: "Открыто",
  IN_PROGRESS: "В работе",
  DONE: "Готово",
  DRAFT: "Черновик",
  READY: "Готово",
  PENDING_CONFIRMATION: "Ждёт подтверждения",
  SCHEDULED: "Запланировано",
  SENDING: "Отправляется",
  SENT: "Отправлено",
  APPLIED: "Применено",
  PAUSED: "Пауза",
  CANCELLED: "Отменено",
};

const actionLabels: Record<string, string> = {
  "appointment.cancel": "Отмена записи",
  "appointment.create": "Новая запись",
  "appointment.reschedule": "Перенос записи",
  "client.create": "Новый клиент",
  "client.update": "Изменение клиента",
  "service.create": "Новая услуга",
  "service.update": "Изменение услуги",
  "service.archive": "Архивация услуги",
  "specialist.update": "Изменение сотрудника",
  "specialist.schedule.update": "Изменение графика",
  "location.create": "Новая локация",
  "location.update": "Изменение локации",
  "promo.create": "Новая акция",
  "promo.update": "Изменение акции",
  "promo.archive": "Архивация акции",
  "review.reply": "Ответ на отзыв",
  "notification.send": "Уведомление клиенту",
  "notification.campaign.send": "Рассылка",
  "site.service.copy.update": "Текст услуги на сайте",
  "site.specialist.copy.update": "Текст сотрудника на сайте",
  "site.home.copy.update": "Главная страница сайта",
  "site.seo.update": "Поисковое описание",
  "memory.update": "Память ассистента",
  "autopilot.setting.update": "Режим работы",
};

const typeLabels: Record<string, string> = {
  "promo.missing": "Акции",
  "site.services.missing_description": "Сайт",
  "site.specialists.missing_bio": "Сайт",
  "reviews.negative_recent": "Отзывы",
  "reviews.recurring_complaints": "Отзывы",
  "clients.retention_opportunity": "Возврат клиентов",
  "schedule.no_upcoming_appointments": "Записи",
  "schedule.weak_days": "Загрузка",
  "specialists.underloaded": "Сотрудники",
  "appointments.loss_rate_high": "Отмены и неявки",
  "schedule.empty_windows": "Свободные окна",
  "campaign.empty_windows.prepare": "Кампания",
  "services.declining": "Услуги",
};

const memoryLabels: Record<string, string> = {
  tone_of_voice: "Тон общения",
  preferred_offer: "Любимое предложение",
  brand_positioning: "Позиционирование",
  audience_notes: "Аудитория",
  business_focus: "Фокус бизнеса",
};

const autopilotLevelLabels: Record<string, string> = {
  off: "Всегда спрашивать",
  suggest: "Только советовать",
  draft: "Готовить черновики",
  execute_safe: "Выполнять безопасное",
  full_confirmed: "Расширенный режим",
};

const autopilotDescriptions: Record<string, string> = {
  off: "Ассистент только отвечает и ничего не готовит без вашей просьбы.",
  suggest: "Ассистент даёт рекомендации, но не создаёт действия.",
  draft: "Ассистент может готовить черновики, а вы решаете, применять их или нет.",
  execute_safe: "Безопасные мелкие действия выполняются автоматически, важные всё равно ждут подтверждения.",
  full_confirmed: "Максимум автоматизации в рамках разрешённых правил аккаунта.",
};

const autopilotLevels = ["off", "suggest", "draft", "execute_safe", "full_confirmed"];

const quickPrompts = [
  "Что сегодня требует внимания?",
  "Найди свободные окна на неделю",
  "Проверь негативные отзывы",
  "Кого стоит вернуть на повторный визит?",
];

function label(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return "";
  return map[value] ?? value;
}

function formatMoney(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function textFromValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

function toolLabel(value?: string | null) {
  if (!value) return "данные CRM";
  const labels: Record<string, string> = {
    "appointments.findAvailableSlots": "свободные окна",
    "appointments.search": "записи",
    "clients.search": "клиентов",
    "reviews.search": "отзывы",
    "services.search": "услуги",
    "specialists.search": "сотрудников",
    "locations.search": "локации",
    "promos.search": "акции",
    "analytics.workload": "загрузку",
    "analytics.retention": "клиентов для возврата",
    "site.health": "сайт",
    "insights.generate": "рекомендации",
  };
  return labels[value] ?? value;
}

function campaignResultText(value: unknown, error?: string | null) {
  if (error) return `Ошибка: ${error}`;
  const data = value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
  if (!data) return "";
  const sent = typeof data.sent === "number" ? data.sent : 0;
  const delivered = typeof data.delivered === "number" ? data.delivered : sent;
  const failed = typeof data.failed === "number" ? data.failed : 0;
  const skipped = typeof data.skipped === "number" ? data.skipped : 0;
  const conversion = data.conversion && typeof data.conversion === "object" && !Array.isArray(data.conversion) ? (data.conversion as JsonRecord) : null;
  const conversionText = conversion
    ? ` Записались: ${Number(conversion.convertedClients ?? 0)}. Выручка: ${formatMoney(conversion.revenue as number | string | null | undefined)} ₽.`
    : "";
  return `Отправлено: ${sent}. Доставлено: ${delivered}. Ошибок: ${failed}. Без согласия: ${skipped}.${conversionText}`;
}

export function CrmAssistantCockpit({ initialData }: { initialData: CockpitData }) {
  const [data, setData] = useState(initialData);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sitePreview, setSitePreview] = useState<{ title: string; text: string } | null>(null);
  const [agentWork, setAgentWork] = useState<AgentWork | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const pendingActions = data.context.pendingActions;
  const draftCount = data.drafts.notifications.length + data.drafts.reviews.length + data.drafts.site.length;
  const visibleMessages = messages.filter((item) => item.role === "user" || item.role === "assistant");
  const lastRun = data.debug?.runs[0] ?? null;
  const totalPending = pendingActions.length + draftCount + data.context.insights.length;
  const toolsCount = useMemo(() => data.tools.length, [data.tools]);

  useEffect(() => {
    loadThread().catch((cause) => setError(cause instanceof Error ? cause.message : "Не удалось загрузить историю."));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleMessages.length, busy]);

  async function refreshSummary() {
    const response = await fetch("/api/v1/crm/assistant/summary", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || "Не удалось обновить данные.");
    setData(payload.data);
  }

  async function loadThread(options?: { fresh?: boolean }) {
    setLoadingThread(true);
    const response = await fetch(`/api/v1/crm/assistant/thread${options?.fresh ? "?new=1" : ""}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || "Не удалось загрузить диалог.");
    setThreadId(payload.data.thread.id);
    setMessages(payload.data.messages);
    setLoadingThread(false);
  }

  async function startNewThread() {
    setError(null);
    setMessages([]);
    setThreadId(null);
    await loadThread({ fresh: true });
  }

  async function sendMessageText(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    setMessages((current) => [...current, { role: "user", content: clean, createdAt: new Date().toISOString() }]);
    try {
      const response = await fetch("/api/v1/crm/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, threadId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Ассистент не ответил.");
      setThreadId(payload.data.threadId);
      setMessages((current) => [...current, { role: "assistant", content: payload.data.answer, createdAt: new Date().toISOString() }]);
      setAgentWork({
        answer: payload.data.answer,
        selectedToolName: payload.data.selectedToolName ?? null,
        toolSteps: Array.isArray(payload.data.toolSteps) ? payload.data.toolSteps : [],
        pendingActions: Array.isArray(payload.data.pendingActions) ? payload.data.pendingActions : [],
      });
      await refreshSummary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка запроса.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessageText(message);
  }

  async function processAction(actionId: number, operation: "confirm" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/assistant/actions/${actionId}/${operation}`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Не удалось обработать действие.");
      await refreshSummary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка действия.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSitePreview(draftId: number) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/assistant/drafts/site/${draftId}/preview`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Не удалось подготовить предпросмотр.");
      setSitePreview({
        title: `Предпросмотр: ${payload.data.target.type}`,
        text: JSON.stringify(payload.data.preview, null, 2),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка предпросмотра.");
    } finally {
      setBusy(false);
    }
  }

  async function applySiteDraft(draftId: number) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/assistant/drafts/site/${draftId}/apply`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Не удалось применить черновик.");
      setSitePreview(null);
      await refreshSummary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка применения черновика.");
    } finally {
      setBusy(false);
    }
  }

  async function updateAutopilot(level: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/crm/assistant/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data.context.autopilot, level }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Не удалось обновить режим.");
      setData((current) => ({
        ...current,
        context: { ...current.context, autopilot: payload.data.settings },
      }));
      await refreshSummary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка обновления режима.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">Ассистент салона</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{data.context.account?.name ?? "Рабочий кабинет"}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
            Помогает разбирать записи, клиентов, отзывы, свободные окна, сайт и рассылки. Изменения применяются только после вашего подтверждения.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startNewThread().catch((cause) => setError(cause instanceof Error ? cause.message : "Не удалось начать новый диалог."))}
            className="rounded-lg border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-medium transition hover:border-[color:var(--bp-accent)]"
          >
            Новый диалог
          </button>
          <button
            type="button"
            onClick={() => refreshSummary().catch((cause) => setError(cause instanceof Error ? cause.message : "Ошибка обновления."))}
            className="rounded-lg bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy}
          >
            Обновить
          </button>
        </div>
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Что требует внимания" value={String(totalPending)} hint={`${pendingActions.length} действий, ${data.context.insights.length} рекомендаций`} />
        <Metric title="Записи сегодня и завтра" value={String(data.context.summary.appointmentsTodayAndTomorrow ?? 0)} hint={`${data.context.summary.servicesCount ?? 0} услуг в каталоге`} />
        <Metric title="Готовые черновики" value={String(draftCount)} hint="Ответы, рассылки и тексты сайта" />
        <Metric title="Баланс ассистента" value={`${formatMoney(data.context.ai.balanceRub)} ₽`} hint={data.context.ai.crmAgentEnabled ? "Ассистент включён" : "Ассистент выключен"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]">
        <div className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Диалог с ассистентом</h2>
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{threadId ? `Диалог #${threadId}` : "Загрузка истории"}</div>
            </div>
            {busy ? <span className="rounded-md bg-[color:var(--bp-bg)] px-2 py-1 text-xs text-[color:var(--bp-muted)]">Ассистент думает</span> : null}
          </div>

          <div ref={scrollRef} className="mt-4 flex h-[520px] flex-col gap-3 overflow-y-auto rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-bg)] p-3">
            {loadingThread ? <EmptyChat text="Загружаю историю диалога..." /> : null}
            {!loadingThread && !visibleMessages.length ? <EmptyChat text="Задайте вопрос или выберите быстрый запрос ниже." /> : null}
            {visibleMessages.map((item, index) => (
              <div key={item.id ?? `${item.role}-${index}`} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 ${
                    item.role === "user" ? "bg-[color:var(--bp-accent)] text-white" : "border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                  }`}
                >
                  {item.content}
                  {item.createdAt ? <div className={`mt-1 text-[11px] ${item.role === "user" ? "text-white/70" : "text-[color:var(--bp-muted)]"}`}>{formatDate(item.createdAt)}</div> : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessageText(prompt)}
                disabled={busy}
                className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-1.5 text-xs text-[color:var(--bp-muted)] transition hover:border-[color:var(--bp-accent)] hover:text-[color:var(--bp-text)] disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Например: подготовь кампанию для клиентов без визитов"
              className="min-w-0 flex-1 rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm outline-none focus:border-[color:var(--bp-accent)]"
            />
            <button disabled={busy || !message.trim()} className="rounded-lg bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Отправить
            </button>
          </form>
        </div>

        <Panel title="Ожидает вашего решения" emptyText="Пока нет действий на подтверждение.">
          {pendingActions.length === 0 && agentWork ? (
            <div className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-bg)] p-3">
              <div className="text-sm font-medium">Последняя работа агента</div>
              <div className="mt-2 text-sm leading-6 text-[color:var(--bp-muted)]">{agentWork.answer}</div>
              {agentWork.selectedToolName || agentWork.toolSteps.length ? (
                <div className="mt-3 grid gap-2">
                  {agentWork.selectedToolName ? <AgentStep text={`Проверил: ${toolLabel(agentWork.selectedToolName)}`} /> : null}
                  {agentWork.toolSteps.map((step, index) => (
                    <AgentStep key={`${step.toolName ?? "step"}-${index}`} text={step.error ? `Ошибка: ${step.error}` : `Шаг ${index + 1}: ${toolLabel(step.toolName)}`} />
                  ))}
                </div>
              ) : null}
              {agentWork.pendingActions.length ? <div className="mt-3 text-xs text-[color:var(--bp-muted)]">Подготовлено действий: {agentWork.pendingActions.length}</div> : null}
            </div>
          ) : null}
          {pendingActions.map((action) => (
            <div key={action.id} className="rounded-lg border border-[color:var(--bp-stroke)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{action.summary}</div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                    {label(actionLabels, action.actionType)} {action.expiresAt ? `· до ${formatDate(action.expiresAt)}` : ""}
                  </div>
                </div>
                <span className="rounded-md bg-[color:var(--bp-bg)] px-2 py-1 text-xs">{label(statusLabels, action.status)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => processAction(action.id, "confirm")} disabled={busy} className="rounded-lg bg-[color:var(--bp-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  Подтвердить
                </button>
                <button onClick={() => processAction(action.id, "reject")} disabled={busy} className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Рекомендации" emptyText="Новых рекомендаций нет.">
          {data.context.insights.map((insight) => (
            <ListItem key={insight.id} title={insight.title} meta={`${label(typeLabels, insight.type)} · приоритет ${insight.priority}`} text={insight.summary} />
          ))}
        </Panel>

        <Panel title="Черновики" emptyText="Черновиков пока нет.">
          {data.drafts.notifications.map((draft) => (
            <ListItem key={`n-${draft.id}`} title={draft.title} meta={`${draft.channel} · ${label(statusLabels, draft.status)}`} text={draft.bodyText} />
          ))}
          {data.drafts.reviews.map((draft) => (
            <ListItem key={`r-${draft.id}`} title={`Ответ на отзыв #${draft.reviewId}`} meta={label(statusLabels, draft.status)} text={draft.replyText} />
          ))}
          {data.drafts.site.map((draft) => (
            <div key={`s-${draft.id}`} className="rounded-lg border border-[color:var(--bp-stroke)] p-3">
              <div className="text-sm font-medium">{draft.summary}</div>
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{draft.targetType} · {label(statusLabels, draft.status)}</div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => loadSitePreview(draft.id)} disabled={busy} className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                  Посмотреть
                </button>
                <button type="button" onClick={() => applySiteDraft(draft.id)} disabled={busy || draft.status === "APPLIED"} className="rounded-lg bg-[color:var(--bp-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  Применить
                </button>
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Кампании" emptyText="Кампаний пока нет.">
          {data.campaigns.map((campaign) => (
            <ListItem key={campaign.id} title={campaign.title} meta={`${campaign.goal} · ${label(statusLabels, campaign.status)}`} text={campaignResultText(campaign.result, campaign.error)} />
          ))}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Память о бизнесе" emptyText="Пока нет сохранённых правил общения.">
          {data.context.memory.map((item) => (
            <ListItem key={item.id} title={label(memoryLabels, item.key)} meta={item.source === "manual" ? "Добавлено вручную" : "Запомнил ассистент"} text={textFromValue(item.value)} />
          ))}
        </Panel>

        <section className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Режим работы</h2>
          <div className="mt-3 text-sm text-[color:var(--bp-muted)]">{autopilotDescriptions[data.context.autopilot.level] ?? "Выберите, насколько самостоятельно может работать ассистент."}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {autopilotLevels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => updateAutopilot(level)}
                disabled={busy || data.context.autopilot.level === level}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-medium disabled:opacity-50 ${
                  data.context.autopilot.level === level ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-accent)] text-white" : "border-[color:var(--bp-stroke)]"
                }`}
              >
                {autopilotLevelLabels[level]}
              </button>
            ))}
          </div>
        </section>
      </section>

      <details className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
        <summary className="cursor-pointer text-sm font-medium">Служебная информация</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatusLine label="Доступных действий" value={String(toolsCount)} />
          <StatusLine label="Дневной лимит" value={data.context.ai.dailySpendLimitRub == null ? "не задан" : `${formatMoney(data.context.ai.dailySpendLimitRub)} ₽`} />
          <StatusLine label="Остановка при балансе ниже" value={data.context.ai.stopWhenBalanceBelowRub == null ? "не задана" : `${formatMoney(data.context.ai.stopWhenBalanceBelowRub)} ₽`} />
        </div>
        {data.debug?.canRead && lastRun ? (
          <div className="mt-4 rounded-lg border border-[color:var(--bp-stroke)] p-3 text-sm">
            Последний запуск: {label(statusLabels, lastRun.status)} · {formatDate(lastRun.startedAt)} · токены: {lastRun.usage.totalTokens} · списано: {formatMoney(lastRun.usage.chargedRub)} ₽
          </div>
        ) : null}
      </details>

      {sitePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{sitePreview.title}</h2>
              <button type="button" onClick={() => setSitePreview(null)} className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-1.5 text-sm">
                Закрыть
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-[color:var(--bp-bg)] p-3 text-xs">{sitePreview.text}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyChat({ text }: { text: string }) {
  return (
    <div className="flex min-h-full items-center justify-center text-center text-sm text-[color:var(--bp-muted)]">
      <div>{text}</div>
    </div>
  );
}

function AgentStep({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-2 py-1.5 text-xs text-[color:var(--bp-muted)]">
      {text}
    </div>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <article className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
      <div className="text-sm text-[color:var(--bp-muted)]">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{hint}</div>
    </article>
  );
}

function Panel({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(items) ? items.length === 0 : !items;
  return (
    <section className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 grid gap-3">{isEmpty ? <div className="text-sm text-[color:var(--bp-muted)]">{emptyText}</div> : items}</div>
    </section>
  );
}

function ListItem({ title, meta, text }: { title: string; meta: string; text?: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--bp-stroke)] p-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{meta}</div>
      {text ? <div className="mt-2 line-clamp-4 text-sm leading-6 text-[color:var(--bp-muted)]">{text}</div> : null}
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--bp-stroke)] p-3">
      <div className="text-xs text-[color:var(--bp-muted)]">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
