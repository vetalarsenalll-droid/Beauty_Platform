"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

type JsonRecord = Record<string, unknown>;

type SessionRow = {
  id: number;
  status: string;
  mode: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  latestMessage: { role: string; content: string; createdAt: string } | null;
  latestState: { goalType: string; status: string } | null;
};

type ActionRow = {
  id: number;
  actionType: string;
  summary: string;
  status: string;
  riskLevel: string;
  permission: string | null;
  payload: unknown;
  result: unknown;
  error: string | null;
  createdAt: string;
};

type ArtifactRow = {
  id: number;
  type: string;
  title: string | null;
  sessionId: number | null;
  planId: number | null;
  data: unknown;
  createdAt: string;
};

type CapabilityData = {
  skills: Array<{ name: string; title: string; description: string; goalTypes: string[]; requiredPermissions: string[] }>;
  tools: Array<{ name: string; domain: string; mode: string; risk: string; permission: string | null }>;
  actions: Array<{ name: string; domain: string; intent: string; risk: string; permission: string; confirmation: string }>;
};

export type CrmAgentV2InitialData = {
  sessions: SessionRow[];
  actions: ActionRow[];
  artifacts: ArtifactRow[];
  policies: Array<{ id: number; key: string; value: unknown; updatedAt: string }>;
  capabilities: CapabilityData;
};

type UiCommand = {
  id: string;
  label: string;
  kind: string;
  payload?: JsonRecord;
  risk?: string;
};

type AgentCard = {
  type: string;
  id?: number | string;
  title: string;
  subtitle?: string | null;
  data?: JsonRecord;
  actions?: UiCommand[];
};

type UiTable = {
  columns: Array<{ key: string; title: string; type?: string }>;
  rows: JsonRecord[];
  selectedRowIds?: Array<number | string>;
  rowCommands?: UiCommand[];
};

type UiForm = {
  id: string;
  entityType: string;
  entityId?: number | string;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    value?: unknown;
    required?: boolean;
    readonly?: boolean;
    helpText?: string;
    options?: Array<{ label: string; value: string | number | boolean }>;
  }>;
  submitCommand: string;
};

type Workspace = {
  mode: string;
  title?: string;
  tabs?: Array<{ id: string; title: string; badge?: number | string; cards?: AgentCard[]; table?: UiTable }>;
  activeTabId?: string;
  cards?: AgentCard[];
  form?: UiForm;
  preview?: { before?: JsonRecord; after: JsonRecord; diff?: Array<{ field: string; before: unknown; after: unknown }> };
  commands?: UiCommand[];
};

type PlanTraceStep = {
  id?: number;
  order: number;
  type: string;
  toolName?: string | null;
  status: string;
  args?: unknown;
  result?: unknown;
  error?: string | null;
};

type ChatResponse = {
  answer: string;
  sessionId: number;
  state: { goalType: string; status: string; missing: string[]; selected: JsonRecord; slots: JsonRecord };
  cards: AgentCard[];
  workspace: Workspace;
  clarification?: { question: string; options: AgentCard[] };
  actionPreview?: { id: number; actionType: string; summary: string; payload: unknown; riskLevel: string; permission?: string | null };
  planTrace: PlanTraceStep[];
};

type ExecuteActionResult = {
  status?: string;
  result?: unknown;
  error?: string;
  actionId?: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SessionDetails = SessionRow & {
  messages?: Array<{ role: string; content: string; createdAt: string }>;
};

const quickPrompts = [
  "Что сегодня по записям?",
  "Какие отзывы требуют внимания?",
  "Запиши Анну на маникюр на ближайшее время",
  "Покажи клиентов, которых пора вернуть",
  "Найди свободные окна на этой неделе",
  "Подготовь ответ на негативный отзыв",
];

const statusLabel: Record<string, string> = {
  ACTIVE: "активна",
  CLOSED: "закрыта",
  FAILED: "ошибка",
  PENDING: "ждет решения",
  CONFIRMED: "подтверждено",
  EXECUTED: "выполнено",
  REJECTED: "отклонено",
  collecting: "сбор данных",
  resolving: "уточнение",
  needs_clarification: "нужно уточнение",
  ready_to_plan: "готово к плану",
  ready_for_confirmation: "ждет подтверждения",
  completed: "готово",
  failed: "ошибка",
  selected: "выбрано",
  available: "доступно",
  done: "готово",
  skipped: "пропущено",
};

const riskLabel: Record<string, string> = {
  low: "низкий риск",
  medium: "средний риск",
  high: "важное действие",
  critical: "критично",
};

export function CrmAgentV2Cockpit({ initialData }: { initialData: CrmAgentV2InitialData }) {
  const [sessions, setSessions] = useState(initialData.sessions);
  const [actions, setActions] = useState(initialData.actions);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(initialData.sessions[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const workspace = response?.workspace ?? startWorkspace();
  const activeTab = workspace.tabs?.find((tab) => tab.id === (activeTabId ?? workspace.activeTabId)) ?? workspace.tabs?.[0] ?? null;
  const visibleCards = activeTab?.table ? [] : activeTab?.cards ?? workspace.cards ?? response?.cards ?? [];
  const pendingActions = actions.filter((action) => action.status === "PENDING" || action.status === "CONFIRMED");

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  async function sendMessage(message: string) {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const payload = await postJson<ChatResponse>("/api/v1/crm/agent-v2/chat", {
        message: text,
        sessionId: activeSessionId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setResponse(payload);
      setActiveSessionId(payload.sessionId);
      setActiveTabId(payload.workspace.activeTabId ?? payload.workspace.tabs?.[0]?.id ?? null);
      setMessages((prev) => [...prev, { role: "assistant", content: payload.answer }]);
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить запрос.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommand(command: UiCommand, payload?: JsonRecord) {
    if (!activeSessionId || busy) return;
    const actionCommand = parseActionCommand(command);
    if (actionCommand) {
      await confirmAction(actionCommand.actionId, actionCommand.operation);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await postJson<ChatResponse>("/api/v1/crm/agent-v2/interactions", {
        sessionId: activeSessionId,
        commandId: command.id,
        payload: payload ?? command.payload ?? {},
      });
      setResponse(result);
      setActiveTabId(result.workspace.activeTabId ?? result.workspace.tabs?.[0]?.id ?? null);
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Команда не выполнена.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(actionId: number, operation: "confirm" | "reject") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<ExecuteActionResult>(
        `/api/v1/crm/agent-v2/actions/${actionId}/${operation}`,
        operation === "reject" ? { reason: "Отклонено в CRM Agent" } : {},
      );
      const nextStatus = resolveActionStatus(operation, result);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: operation === "confirm" ? "Действие выполнено." : "Действие отклонено." },
      ]);
      setActions((prev) =>
        prev.map((item) => (item.id === actionId ? { ...item, status: nextStatus, result, error: result.error ?? item.error } : item)),
      );
      setResponse((prev) => markResponseActionHandled(prev, actionId, nextStatus));
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обработать действие.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSessions() {
    const data = await getJson<{ sessions: SessionRow[] }>("/api/v1/crm/agent-v2/sessions?take=12");
    setSessions(data.sessions);
  }

  async function openSession(sessionId: number) {
    if (busy) return;
    try {
      setActiveSessionId(sessionId);
      setResponse(null);
      setActiveTabId(null);
      setError(null);
      const session = await getJson<SessionDetails | null>(`/api/v1/crm/agent-v2/sessions/${sessionId}`);
      const restoredMessages = (session?.messages ?? [])
        .filter((message): message is { role: "user" | "assistant"; content: string; createdAt: string } => message.role === "user" || message.role === "assistant")
        .map((message) => ({ role: message.role, content: cleanUserText(message.content) }));
      setMessages(restoredMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть чат.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] text-[color:var(--bp-ink)] xl:grid-cols-[280px_minmax(420px,1fr)_420px]">
      <aside className="hidden min-h-0 border-r border-[color:var(--bp-stroke)] xl:flex xl:flex-col">
        <div className="border-b border-[color:var(--bp-stroke)] p-3">
          <button
            type="button"
            onClick={() => {
              setActiveSessionId(null);
              setMessages([]);
              setResponse(null);
              setActiveTabId(null);
              setError(null);
            }}
            className="w-full rounded-lg bg-[color:var(--bp-accent)] px-3 py-2 text-sm font-medium text-white"
          >
            Новый чат
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="px-2 pb-2 text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--bp-muted)]">История</div>
          <div className="grid gap-1">
            {sessions.length ? (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => void openSession(session.id)}
                  className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                    activeSessionId === session.id ? "bg-[color:var(--bp-soft)] text-[color:var(--bp-ink)]" : "text-[color:var(--bp-muted)] hover:bg-[color:var(--bp-soft)]"
                  }`}
                >
                  <div className="truncate font-medium">{cleanSessionTitle(session)}</div>
                  <div className="mt-1 truncate text-xs">{cleanSessionPreview(session.latestMessage?.content)}</div>
                </button>
              ))
            ) : (
              <Empty text="История появится после первого сообщения" />
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-[color:var(--bp-stroke)] px-4">
          <div>
            <div className="text-sm font-semibold">Диалог</div>
            <div className="text-xs text-[color:var(--bp-muted)]">{activeSessionId ? `Чат #${activeSessionId}` : "Новый чат"}</div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <StatusPill text={`${pendingActions.length} на подтверждение`} tone={pendingActions.length ? "warning" : "neutral"} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-5">
              {messages.length ? (
                <div className="flex flex-col gap-3">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                        message.role === "user" ? "ml-auto bg-[color:var(--bp-accent)] text-white" : "bg-[color:var(--bp-soft)]"
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                  {busy ? <div className="w-fit rounded-lg bg-[color:var(--bp-soft)] px-3 py-2 text-sm text-[color:var(--bp-muted)]">Думаю...</div> : null}
                  <div ref={messageEndRef} />
                </div>
              ) : (
                <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-4">
                  <div>
                    <div className="text-xl font-semibold">Что нужно сделать?</div>
                    <div className="mt-1 text-sm text-[color:var(--bp-muted)]">Спросите по CRM или поручите задачу. Enter отправляет, Shift+Enter переносит строку.</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-2 text-left text-sm transition hover:border-[color:var(--bp-accent)]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[color:var(--bp-stroke)] p-3">
              {error ? <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</div> : null}
              <div className="flex items-end gap-2 rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] p-2 focus-within:ring-2 focus-within:ring-[color:var(--ring)]">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  rows={1}
                  className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                  placeholder="Напишите сообщение"
                />
                <button type="submit" disabled={busy || !input.trim()} className="shrink-0 rounded-lg bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Отправить
                </button>
              </div>
            </form>
        </div>
      </section>

      <aside className="hidden min-h-0 border-l border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] xl:flex xl:flex-col">
        <div className="flex h-14 items-center justify-between border-b border-[color:var(--bp-stroke)] px-4">
          <div>
            <div className="text-sm font-semibold">Контекст</div>
            <div className="text-xs text-[color:var(--bp-muted)]">{response ? humanWorkspaceTitle(workspace) : "Пока нет результата"}</div>
          </div>
          <CommandBar commands={workspace.commands} busy={busy} onRun={runCommand} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-4">
            <Panel title="На подтверждение">
              <div className="grid gap-2">
                {pendingActions.length ? (
                  pendingActions.map((action) => (
                    <div key={action.id} className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-3 text-sm">
                      <div className="font-medium">{action.summary}</div>
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                        {actionName(action.actionType)} · {riskLabel[action.riskLevel] ?? action.riskLevel}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => void confirmAction(action.id, "confirm")} className="rounded-lg bg-[color:var(--bp-accent)] px-3 py-2 text-xs font-medium text-white">
                          Подтвердить
                        </button>
                        <button type="button" onClick={() => void confirmAction(action.id, "reject")} className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-2 text-xs">
                          Отклонить
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty text="Нет действий, ожидающих решения" />
                )}
              </div>
            </Panel>

            <div className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]">
              <div className="border-b border-[color:var(--bp-stroke)] px-4 py-3">
                <div className="text-sm font-semibold">{response ? humanWorkspaceTitle(workspace) : "Результат"}</div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{response ? workspaceHint(workspace.mode) : "Ответы и выбор появятся после сообщения"}</div>
              </div>

              {workspace.tabs?.length ? (
                <div className="flex gap-2 overflow-x-auto border-b border-[color:var(--bp-stroke)] px-3 py-2">
                  {workspace.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTabId(tab.id)}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        activeTab?.id === tab.id ? "bg-[color:var(--bp-accent)] text-white" : "bg-[color:var(--bp-soft)] text-[color:var(--bp-muted)]"
                      }`}
                    >
                      {tabTitle(tab.title)}
                      {tab.badge !== undefined ? ` ${tab.badge}` : ""}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 p-3">
                {response?.clarification ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <div className="font-medium">{response.clarification.question}</div>
                    <div className="mt-3 grid gap-2">
                      {response.clarification.options.map((option) => (
                        <Card key={`${option.type}-${option.id ?? option.title}`} card={option} busy={busy} onRun={runCommand} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {workspace.preview ? <Preview preview={workspace.preview} /> : null}
                {workspace.form ? <AgentForm form={workspace.form} busy={busy} onSubmit={(command, payload) => void runCommand(command, payload)} /> : null}
                {activeTab?.table ? <Table table={activeTab.table} busy={busy} onRun={runCommand} /> : null}

                {visibleCards.length ? (
                  <div className="grid gap-3">
                    {visibleCards.map((card, index) => (
                      <Card key={`${card.type}-${card.id ?? "no-id"}-${index}`} card={card} busy={busy} onRun={runCommand} />
                    ))}
                  </div>
                ) : (
                  <Empty text={response ? "Нет дополнительных данных для показа." : "Начните диалог, чтобы увидеть контекст."} />
                )}
              </div>
            </div>

            {response?.planTrace?.length ? (
              <details className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Диагностика</summary>
                <div className="grid gap-2 border-t border-[color:var(--bp-stroke)] p-3">
                  {response.planTrace.map((step) => (
                    <div key={`${step.order}-${step.toolName ?? step.type}`} className="rounded-lg bg-[color:var(--bp-soft)] p-3 text-xs">
                      #{step.order} · {toolLabel(step.toolName ?? step.type)} · {label(step.status)}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function parseActionCommand(command: UiCommand): { operation: "confirm" | "reject"; actionId: number } | null {
  const operation = command.kind === "confirm" ? "confirm" : command.kind === "reject" ? "reject" : null;
  const payloadActionId = typeof command.payload?.actionId === "number" ? command.payload.actionId : null;
  if (operation && typeof payloadActionId === "number" && Number.isInteger(payloadActionId) && payloadActionId > 0) {
    return { operation, actionId: payloadActionId };
  }

  const [prefix, rawId] = command.id.split(":");
  const actionId = Number(rawId);
  if (!Number.isInteger(actionId) || actionId <= 0) return null;
  if (prefix === "confirm_action") return { operation: "confirm", actionId };
  if (prefix === "reject_action") return { operation: "reject", actionId };
  return null;
}

function resolveActionStatus(operation: "confirm" | "reject", result: ExecuteActionResult) {
  if (typeof result.status === "string" && result.status) return result.status;
  return operation === "confirm" ? "EXECUTED" : "REJECTED";
}

function markResponseActionHandled(response: ChatResponse | null, actionId: number, status: string): ChatResponse | null {
  if (!response) return response;
  const stripHandledCommands = (commands?: UiCommand[]) =>
    commands?.filter((command) => {
      const parsed = parseActionCommand(command);
      return !parsed || parsed.actionId !== actionId;
    });
  const markCard = (card: AgentCard): AgentCard =>
    card.id === actionId || Number(card.data?.actionId) === actionId
      ? {
          ...card,
          subtitle: status,
          data: { ...(card.data ?? {}), status },
          actions: stripHandledCommands(card.actions),
        }
      : { ...card, actions: stripHandledCommands(card.actions) };
  const markTab = (tab: NonNullable<Workspace["tabs"]>[number]) => ({
    ...tab,
    cards: tab.cards?.map(markCard),
    table: tab.table ? { ...tab.table, rowCommands: stripHandledCommands(tab.table.rowCommands) } : tab.table,
  });

  return {
    ...response,
    cards: response.cards.map(markCard),
    workspace: {
      ...response.workspace,
      title: status === "EXECUTED" ? "Действие выполнено" : status === "REJECTED" ? "Действие отклонено" : response.workspace.title,
      mode: status === "EXECUTED" || status === "REJECTED" ? "report" : response.workspace.mode,
      commands: stripHandledCommands(response.workspace.commands),
      cards: response.workspace.cards?.map(markCard),
      tabs: response.workspace.tabs?.map(markTab),
    },
  };
}

function StatusPill({ text, tone }: { text: string; tone: "neutral" | "warning" }) {
  return <span className={`rounded-full px-3 py-1 ${tone === "warning" ? "bg-amber-100 text-amber-900" : "bg-[color:var(--bp-soft)] text-[color:var(--bp-muted)]"}`}>{text}</span>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]">
      <div className="border-b border-[color:var(--bp-stroke)] px-4 py-3 text-sm font-semibold">{title}</div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function CommandBar({ commands, busy, onRun }: { commands?: UiCommand[]; busy: boolean; onRun: (command: UiCommand) => Promise<void> }) {
  if (!commands?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {commands.map((command) => (
        <button key={command.id} type="button" disabled={busy} onClick={() => void onRun(command)} className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)] disabled:opacity-50">
          {command.label}
        </button>
      ))}
    </div>
  );
}

function Card({ card, busy, onRun }: { card: AgentCard; busy: boolean; onRun: (command: UiCommand) => Promise<void> }) {
  const isSelected = card.data?.status === "selected";
  return (
    <div className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-[color:var(--bp-muted)]">{cardType(card.type)}</div>
          <div className="mt-1 font-semibold">{formatValue(card.title)}</div>
          {card.subtitle ? <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{formatValue(card.subtitle)}</div> : null}
        </div>
        {card.id !== undefined && card.type !== "slot" ? <div className="rounded-md bg-[color:var(--bp-soft)] px-2 py-1 text-xs">#{card.id}</div> : null}
      </div>
      {card.data && !isSelected ? <KeyValueList value={card.data} /> : null}
      {card.actions?.length && !isSelected ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.actions.map((action) => (
            <button key={action.id} type="button" disabled={busy} onClick={() => void onRun(action)} className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-2 text-xs hover:border-[color:var(--bp-accent)] disabled:opacity-50">
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AgentForm({ form, busy, onSubmit }: { form: UiForm; busy: boolean; onSubmit: (command: UiCommand, payload: JsonRecord) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload: JsonRecord = {};
    for (const field of form.fields) {
      if (field.type === "toggle") {
        payload[field.name] = formData.get(field.name) === "on";
      } else if (field.type === "number") {
        const raw = formData.get(field.name);
        payload[field.name] = typeof raw === "string" && raw.trim() ? Number(raw) : null;
      } else {
        payload[field.name] = formData.get(field.name);
      }
    }
    onSubmit({ id: form.submitCommand, label: "Сохранить", kind: "save_draft" }, payload);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-[color:var(--bp-stroke)] p-4">
      <div className="text-sm font-semibold">{form.entityType}{form.entityId ? ` #${form.entityId}` : ""}</div>
      <div className="grid gap-3 md:grid-cols-2">
        {form.fields.map((field) => (
          <label key={field.name} className="grid gap-1 text-sm">
            <span className="text-xs text-[color:var(--bp-muted)]">{field.label}</span>
            {field.type === "textarea" ? (
              <textarea name={field.name} defaultValue={String(field.value ?? "")} readOnly={field.readonly} className="min-h-24 rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            ) : field.type === "toggle" ? (
              <input name={field.name} type="checkbox" defaultChecked={Boolean(field.value)} disabled={field.readonly} className="h-5 w-5 rounded border border-[color:var(--bp-stroke)]" />
            ) : field.type === "select" ? (
              <select name={field.name} defaultValue={String(field.value ?? "")} disabled={field.readonly} className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none">
                {field.options?.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
              </select>
            ) : (
              <input name={field.name} type={field.type === "number" ? "number" : field.type === "datetime" ? "datetime-local" : field.type} defaultValue={String(field.value ?? "")} readOnly={field.readonly} className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            )}
          </label>
        ))}
      </div>
      <button type="submit" disabled={busy} className="w-fit rounded-lg bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Сохранить</button>
    </form>
  );
}

function Table({ table, busy, onRun }: { table: UiTable; busy: boolean; onRun: (command: UiCommand) => Promise<void> }) {
  const hasRowCommands = Boolean(table.rowCommands?.length);
  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--bp-stroke)]">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-[color:var(--bp-soft)] text-xs text-[color:var(--bp-muted)]">
          <tr>
            {table.columns.map((column) => <th key={column.key} className="px-3 py-2 font-medium">{column.title}</th>)}
            {hasRowCommands ? <th className="px-3 py-2 font-medium"></th> : null}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index} className="border-t border-[color:var(--bp-stroke)]">
              {table.columns.map((column) => <td key={column.key} className="px-3 py-2">{formatCellValue(column.key, row[column.key])}</td>)}
              {hasRowCommands ? (
                <td className="px-3 py-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    {row.status === "selected" ? (
                      <span className="text-xs text-[color:var(--bp-muted)]">выбрано</span>
                    ) : table.rowCommands?.map((command) => {
                      const rowCommand = materializeRowCommand(command, row);
                      return (
                        <button
                          key={`${rowCommand.id}-${index}`}
                          type="button"
                          disabled={busy}
                          onClick={() => void onRun(rowCommand)}
                          className="rounded-lg border border-[color:var(--bp-stroke)] px-3 py-2 text-xs hover:border-[color:var(--bp-accent)] disabled:opacity-50"
                        >
                          {rowCommand.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function materializeRowCommand(command: UiCommand, row: JsonRecord): UiCommand {
  const replacements = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, encodeURIComponent(String(value ?? ""))]));
  const id = command.id.replace(/\{([^}]+)\}/g, (_match, key: string) => replacements[key] ?? "");
  return {
    ...command,
    id,
    payload: { ...(command.payload ?? {}), row },
  };
}

function Preview({ preview }: { preview: NonNullable<Workspace["preview"]> }) {
  return (
    <div className="grid gap-3 rounded-lg border border-[color:var(--bp-stroke)] p-4 md:grid-cols-2">
      {preview.before ? <PreviewPanel title="Сейчас" value={preview.before} /> : null}
      <PreviewPanel title="После подтверждения" value={preview.after} />
      {preview.diff?.length ? (
        <div className="md:col-span-2">
          <div className="mb-2 text-sm font-semibold">Изменения</div>
          <div className="grid gap-2">
            {preview.diff.map((item) => (
              <div key={item.field} className="grid gap-2 rounded-lg bg-[color:var(--bp-soft)] p-3 text-sm md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="font-medium">{item.field}</div>
                <div className="text-[color:var(--bp-muted)]">{formatValue(item.before)}</div>
                <div>{formatValue(item.after)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewPanel({ title, value }: { title: string; value: JsonRecord }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <KeyValueList value={value} />
    </div>
  );
}

function KeyValueList({ value }: { value: JsonRecord }) {
  const entries = Object.entries(value)
    .filter(([key]) => !hiddenDataKeys.has(key))
    .slice(0, 8);
  if (!entries.length) return null;
  return (
    <dl className="mt-3 grid gap-2 rounded-lg bg-[color:var(--bp-soft)] p-3 text-xs">
      {entries.map(([key, item]) => (
        <div key={key} className="grid gap-1">
          <dt className="text-[color:var(--bp-muted)]">{fieldLabel(key)}</dt>
          <dd className="break-words">{formatValue(item)}</dd>
        </div>
      ))}
    </dl>
  );
}

const hiddenDataKeys = new Set([
  "slot",
  "value",
  "rank",
  "specialistId",
  "specialistIds",
  "locationId",
  "locationIds",
  "serviceId",
  "categoryId",
  "isActive",
  "isPublic",
  "avatarUrl",
]);

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[color:var(--bp-stroke)] px-3 py-4 text-center text-sm text-[color:var(--bp-muted)]">{text}</div>;
}

function startWorkspace(): Workspace {
  const cards = startCards();
  return {
    mode: "conversation",
    title: "Спросите или поручите задачу",
    cards,
    tabs: [{ id: "start", title: "Быстрый старт", cards }],
    activeTabId: "start",
    commands: [],
  };
}

function startCards(): AgentCard[] {
  return [
    { type: "report", title: "Сегодня", subtitle: "Спросить по записям, окнам, загрузке и срочным точкам внимания." },
    { type: "report", title: "Записи", subtitle: "Найти клиента, подобрать услугу и свободное окно, подготовить запись." },
    { type: "report", title: "Клиенты", subtitle: "Найти профиль, обновить данные, подготовить возвратную коммуникацию." },
    { type: "report", title: "Отзывы и сайт", subtitle: "Посмотреть отзывы, подготовить ответ или черновик публичного текста." },
  ];
}

function humanWorkspaceTitle(workspace: Workspace) {
  if (!workspace.title) return "Рабочая область";
  if (workspace.title === "Planner error") return "Не удалось разобрать задачу";
  if (workspace.title === "Runtime inspection") return "План задачи";
  if (workspace.title === "Selection saved. Ready to continue.") return "Выбор сохранен. Можно продолжить.";
  if (workspace.title === "Selection saved. Continue selecting required values.") return "Выбор сохранен. Выберите оставшиеся значения.";
  return workspace.title;
}

function workspaceHint(mode: string) {
  if (mode === "conversation") return "Можно обсуждать CRM или перейти к задаче";
  if (mode === "select") return "Выберите подходящий вариант";
  if (mode === "form") return "Проверьте и заполните поля";
  if (mode === "preview") return "Проверьте изменения до подтверждения";
  if (mode === "confirm") return "Нужно ваше подтверждение";
  if (mode === "table") return "Результаты можно просмотреть и выбрать";
  if (mode === "empty") return "Напишите вопрос или задачу";
  return "Агент покажет здесь данные, варианты и черновики";
}

function cleanSessionTitle(session: SessionRow) {
  const title = session.title || session.latestMessage?.content || session.latestState?.goalType || `Чат #${session.id}`;
  return cleanUserText(title);
}

function cleanSessionPreview(value: string | undefined) {
  return cleanUserText(value || "Пока без сообщений");
}

function cleanUserText(value: string) {
  if (value === "Коротко по-русски, что будет сделано или что нужно уточнить.") return "Нужно уточнение";
  if (value === "command:confirm_plan") return "Ожидает подтверждения";
  if (value.startsWith("command:")) return "Команда агента";
  return value;
}

function tabTitle(value: string) {
  const map: Record<string, string> = {
    "План": "Шаги",
    "Результаты": "Данные",
    "Варианты": "Варианты",
    "Ответ": "Ответ",
    "Данные": "Данные",
    "Быстрый старт": "Старт",
    summary: "Ответ",
    read_tools: "Данные",
    selection: "Варианты",
    plan: "Шаги",
    results: "Данные",
  };
  return map[value] ?? value;
}

function label(value: string) {
  return statusLabel[value] ?? value;
}

function actionName(value: string) {
  const map: Record<string, string> = {
    "appointment.create": "создание записи",
    "appointment.reschedule": "перенос записи",
    "appointment.cancel": "отмена записи",
    "client.create": "новый клиент",
    "client.update": "изменение клиента",
    "service.update": "изменение услуги",
    "review.reply": "ответ на отзыв",
    "memory.update": "память агента",
  };
  return map[value] ?? value;
}

function toolLabel(value: string): string {
  if (value.includes(":")) {
    const [name, status] = value.split(":").map((part) => part.trim());
    return [toolLabel(name), label(status)].filter(Boolean).join(": ");
  }
  const map: Record<string, string> = {
    read: "чтение данных",
    draft: "черновик",
    execute: "выполнение",
    "analytics.workload": "анализ загрузки",
    "analytics.retention": "возврат клиентов",
    "appointments.search": "поиск записей",
    "appointments.findAvailableSlots": "свободные окна",
    "clients.search": "поиск клиентов",
    "clients.get": "карточка клиента",
    "services.search": "поиск услуг",
    "specialists.search": "поиск специалистов",
    "locations.search": "поиск филиалов",
    "reviews.search": "поиск отзывов",
    "site.health": "проверка сайта",
    "actions.prepare": "подготовка действия",
    "actions.preview": "предпросмотр",
  };
  return map[value] ?? value;
}

function cardType(value: string) {
  const map: Record<string, string> = {
    client: "клиент",
    service: "услуга",
    specialist: "специалист",
    location: "локация",
    appointment: "запись",
    slot: "окно",
    review: "отзыв",
    promo: "акция",
    action: "действие",
    preview: "предпросмотр",
    form: "форма",
    report: "раздел",
  };
  return map[value] ?? value;
}

function fieldLabel(value: string) {
  const map: Record<string, string> = {
    slot: "что выбираем",
    value: "значение",
    title: "вариант",
    subtitle: "детали",
    data: "данные",
    goal: "цель",
    missingSlots: "нужно уточнить",
    clientId: "клиент",
    serviceId: "услуга",
    specialistId: "специалист",
    locationId: "локация",
    startAt: "начало",
    endAt: "окончание",
    durationMin: "длительность",
    durationTotalMin: "длительность",
    specialistName: "специалист",
    locationName: "локация",
    serviceName: "услуга",
    rank: "номер",
    summary: "итог",
    status: "статус",
    reason: "причина",
    result: "результат",
    range: "период",
    totals: "итого",
    byDay: "по дням",
    bySpecialist: "по специалистам",
    appointments: "записей",
    revenue: "выручка",
    dateFrom: "с",
    dateTo: "по",
    type: "тип",
    intent: "намерение",
    confidence: "уверенность",
    basePrice: "цена",
    baseDurationMin: "длительность",
    categoryName: "категория",
    description: "описание",
    phone: "телефон",
    email: "email",
    tags: "теги",
    updatedAt: "обновлено",
  };
  return map[value] ?? value;
}

function formatCellValue(key: string, value: unknown): string {
  if (key === "slot") return slotLabel(value);
  if (key === "status") return typeof value === "string" ? label(value) : formatValue(value);
  if (key === "toolName" || key === "Инструмент") return typeof value === "string" ? toolLabel(value) : formatValue(value);
  if (key === "type") return typeof value === "string" ? toolLabel(value) : formatValue(value);
  return formatValue(value);
}

function formatValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    if (isIsoDateString(value)) return formatDateTime(value);
    if (/^Step\s+\d+$/i.test(value)) return value.replace(/^Step/i, "Шаг");
    return toolLabel(label(cleanUserText(value)));
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const record = value as JsonRecord;
    if (typeof record.title === "string") return record.title;
    if (typeof record.name === "string") return record.name;
    if (typeof record.query === "string") return record.query;
    return Object.entries(record)
      .slice(0, 4)
      .map(([key, item]) => `${fieldLabel(key)}: ${formatValue(item)}`)
      .join("; ");
  }
  return String(value);
}

function slotLabel(value: unknown) {
  const map: Record<string, string> = {
    client: "клиент",
    service: "услуга",
    specialist: "специалист",
    location: "локация",
    appointment: "запись",
    time: "окно",
  };
  return typeof value === "string" ? map[value] ?? value : formatValue(value);
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return unwrap<T>(response);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  return unwrap<T>(response);
}

async function unwrap<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? "Запрос не выполнен.";
    throw new Error(message);
  }
  return payload.data as T;
}
