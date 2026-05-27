import type { Prisma } from "@prisma/client";
import { crmAgentActionRegistry, listCrmAgentActionsForPermissions } from "./actions";
import { runCrmAgentConversation } from "./conversation";
import { routeCrmAgentConversationTurn, type CrmAgentRouteDecision } from "./conversation-router";
import { compactCrmAgentContext, loadCrmAgentContext } from "./context";
import { inspectCrmAgentPlan } from "./inspector";
import {
  addCrmAgentMessage,
  createCrmAgentArtifact,
  createCrmAgentPlan,
  createCrmAgentSession,
  finishCrmAgentToolCall,
  getCrmAgentSession,
  getLatestCrmAgentTaskState,
  saveCrmAgentTaskState,
  startCrmAgentToolCall,
  updateCrmAgentPlanStatus,
  updateCrmAgentPlanStep,
} from "./persistence";
import { requestCrmAgentPlannerPlan, type CrmAgentPlannerPlan } from "./planner";
import { handleCrmAgentTaskContinuation } from "./task-continuation";
import { crmAgentToolRegistry, getCrmAgentTool, listCrmAgentToolsForPermissions } from "./tools";
import type {
  CrmAgentCard,
  CrmAgentChatResponse,
  CrmAgentCandidate,
  CrmAgentPlanTraceStep,
  CrmAgentRiskLevel,
  CrmAgentSlot,
  CrmAgentTaskState,
  CrmAgentToolContext,
  CrmAgentUiWorkspace,
} from "./types";

export type RunCrmAgentTurnInput = {
  accountId: number;
  userId?: number | null;
  permissions: string[];
  message: string;
  sessionId?: number | null;
  timezone?: string;
};

type RuntimeSession = Awaited<ReturnType<typeof createCrmAgentSession>>;

export async function runCrmAgentTurn(input: RunCrmAgentTurnInput): Promise<CrmAgentChatResponse> {
  const session = await resolveRuntimeSession(input);
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: session.id,
    role: "user",
    content: input.message,
  });

  const context = await loadCrmAgentContext({
    accountId: input.accountId,
    userId: input.userId ?? null,
    permissions: input.permissions,
    sessionId: session.id,
  });
  const latestState = await getLatestCrmAgentTaskState({
    accountId: input.accountId,
    sessionId: session.id,
  });
  const nowIso = new Date().toISOString();
  const timezone = input.timezone ?? "Europe/Moscow";
  const contextSummary = compactCrmAgentContext(context);
  const serializedState = latestState ? serializePlannerState(latestState) : null;

  const routeResult = await routeCrmAgentConversationTurn({
    accountId: input.accountId,
    userId: input.userId ?? null,
    sessionId: session.id,
    message: input.message,
    nowIso,
    timezone,
    contextSummary,
    state: serializedState,
    history: context.history,
  });

  const routeError = routeResult.ok ? (routeResult.fallback ? routeResult.error : null) : routeResult.error;
  const blockedAiAnswer = aiAccessBlockedAnswer(routeError);
  const degradedSimpleAnswer = blockedAiAnswer ?? (!routeResult.ok ? degradedConversationAnswer(routeError) : null);
  if (degradedSimpleAnswer) {
    return saveConversationResponse({
      sessionId: session.id,
      accountId: input.accountId,
      answer: degradedSimpleAnswer,
      state: latestState ? taskStateFromRecord(latestState) : buildEmptyState(session.id, input.accountId, "completed"),
      workspace: {
        mode: "conversation",
        title: "Диалог",
        commands: [],
      },
      cards: [],
      data: {
        mode: "conversation",
        fallback: blockedAiAnswer ? "aiAccessBlockedAnswer" : "degradedConversationAnswer",
        route: routeResult.ok ? routeResult.decision : null,
        routeError,
      },
    });
  }

  const routeDecision: CrmAgentRouteDecision = routeResult.ok
    ? routeResult.decision
    : {
        kind: "crm_task",
        confidence: 0,
        reason: `Router failed: ${routeResult.error}`,
        needsAccountContext: true,
        allowedToolModes: ["read", "draft"],
      };

  let plannerHint: string | undefined;
  if (routeDecision.kind === "task_continuation") {
    const continuation = await handleCrmAgentTaskContinuation({
      accountId: input.accountId,
      userId: input.userId ?? null,
      sessionId: session.id,
      permissions: input.permissions,
      message: input.message,
      timezone,
      state: latestState ? taskStateFromRecord(latestState) : null,
    });
    plannerHint = continuation.plannerHint;
    if (continuation.handled) return continuation.response;
  }

  if (shouldUseConversationLayer(routeDecision)) {
    try {
      const conversation = await runCrmAgentConversation({
        accountId: input.accountId,
        userId: input.userId ?? null,
        sessionId: session.id,
        permissions: input.permissions,
        message: input.message,
        route: routeDecision,
        nowIso,
        timezone,
        contextSummary,
        state: serializedState,
        history: context.history,
      });

      if (!conversation.shouldEscalateToPlanner) {
        return saveConversationResponse({
          sessionId: session.id,
          accountId: input.accountId,
          answer: conversation.answer,
          state: latestState ? taskStateFromRecord(latestState) : buildEmptyState(session.id, input.accountId, "completed"),
          workspace: conversation.workspace ?? {
            mode: "conversation",
            title: "Диалог",
            commands: [],
          },
          cards: conversation.cards ?? [],
          data: {
            mode: conversationModeForRoute(routeDecision),
            route: routeDecision,
            routeFallback: routeResult.ok ? routeResult.fallback : false,
            usedTools: conversation.usedTools,
            model: conversation.model,
            raw: conversation.raw,
          },
        });
      }
      plannerHint = conversation.plannerHint;
    } catch (error) {
      const answer =
        aiAccessBlockedAnswer(error instanceof Error ? error.message : null) ??
        degradedConversationAnswer(error instanceof Error ? error.message : null);
      return saveConversationResponse({
        sessionId: session.id,
        accountId: input.accountId,
        answer,
        state: latestState ? taskStateFromRecord(latestState) : buildEmptyState(session.id, input.accountId, "failed"),
        workspace: {
          mode: "conversation",
          title: "Диалог",
          commands: [],
        },
        cards: [],
        data: {
          mode: conversationModeForRoute(routeDecision),
          route: routeDecision,
          error: error instanceof Error ? error.message : "conversation_failed",
          fallback: "degradedConversationAnswer",
        },
      });
    }
  }

  const tools = listCrmAgentToolsForPermissions(input.permissions);
  const actions = listCrmAgentActionsForPermissions(input.permissions);

  const plannerResult = await requestCrmAgentPlannerPlan({
    accountId: input.accountId,
    userId: input.userId ?? null,
    sessionId: session.id,
    message: plannerMessageWithRouting(input.message, routeDecision, plannerHint),
    nowIso,
    timezone,
    contextSummary,
    state: serializedState,
    history: context.history,
    tools,
    actions,
  });

  if (!plannerResult.ok) {
    try {
      const conversationRoute = plannerFailureConversationRoute(routeDecision, plannerResult.error);
      const conversation = await runCrmAgentConversation({
        accountId: input.accountId,
        userId: input.userId ?? null,
        sessionId: session.id,
        permissions: input.permissions,
        message: input.message,
        route: conversationRoute,
        nowIso,
        timezone,
        contextSummary,
        state: serializedState,
        history: context.history,
      });

      if (!conversation.shouldEscalateToPlanner) {
        return saveConversationResponse({
          sessionId: session.id,
          accountId: input.accountId,
          answer: conversation.answer,
          state: latestState ? taskStateFromRecord(latestState) : buildEmptyState(session.id, input.accountId, "completed"),
          workspace: conversation.workspace ?? {
            mode: "conversation",
            title: "Диалог",
            commands: [],
          },
          cards: conversation.cards ?? [],
          data: {
            mode: "conversation",
            route: conversationRoute,
            originalRoute: routeDecision,
            plannerError: plannerResult.error,
            usedTools: conversation.usedTools,
            model: conversation.model,
            raw: conversation.raw,
          },
        });
      }
    } catch (error) {
      const blockedAnswer = aiAccessBlockedAnswer(error instanceof Error ? error.message : null);
      if (blockedAnswer) {
        return saveConversationResponse({
          sessionId: session.id,
          accountId: input.accountId,
          answer: blockedAnswer,
          state: latestState ? taskStateFromRecord(latestState) : buildEmptyState(session.id, input.accountId, "failed"),
          workspace: {
            mode: "conversation",
            title: "Диалог",
            commands: [],
          },
          cards: [],
          data: {
            mode: "conversation",
            route: routeDecision,
            error: error instanceof Error ? error.message : "conversation_recovery_failed",
            fallback: "aiAccessBlockedAnswer",
          },
        });
      }
    }

    return handlePlannerFailure({
      sessionId: session.id,
      accountId: input.accountId,
      error: plannerResult.error,
      raw: plannerResult.raw,
    });
  }

  const inspection = inspectCrmAgentPlan({
    plan: plannerResult.plan,
    permissions: input.permissions,
  });

  const persistedPlan = await createCrmAgentPlan({
    sessionId: session.id,
    accountId: input.accountId,
    plan: plannerResult.plan,
  });

  const execution = inspection.ok
    ? await executeRuntimePlanSteps({
        accountId: input.accountId,
        userId: input.userId ?? null,
        sessionId: session.id,
        permissions: input.permissions,
        planId: persistedPlan.id,
        steps: persistedPlan.steps,
        plannerSteps: plannerResult.plan.steps,
        allowedOrders: new Set(inspection.allowedSteps.map((step) => step.order)),
        requiresConfirmation: inspection.requiresConfirmation,
      })
    : { status: "blocked" as const, results: [], failed: false, needsUser: false };

  const state = buildTaskState({
    sessionId: session.id,
    accountId: input.accountId,
    plan: plannerResult.plan,
    stepResults: execution.results,
    status: resolveRuntimeStateStatus({
      plan: plannerResult.plan,
      inspectionOk: inspection.ok,
      executionFailed: execution.failed,
      needsUser: execution.needsUser || inspection.requiresConfirmation,
      missingActionSlots: hasMissingActionSlots(inspection.findings),
    }),
  });
  await saveCrmAgentTaskState(state);

  const cards = buildRuntimeCards(plannerResult.plan, inspection.findings, execution.results);
  const workspace = buildRuntimeWorkspace(
    plannerResult.plan,
    cards,
    inspection.requiresConfirmation || execution.needsUser,
    execution.results,
    state,
  );

  await createCrmAgentArtifact({
    accountId: input.accountId,
    sessionId: session.id,
    planId: persistedPlan.id,
    type: "report",
    title: "Runtime inspection",
    data: {
      inspection,
      execution,
      plan: plannerResult.plan,
    } as Prisma.InputJsonValue,
  });

  const answer = hasMissingActionSlots(inspection.findings)
    ? missingActionSlotsAnswer(inspection.findings)
    : inspection.ok
    ? plannerResult.plan.answer || "План подготовлен."
    : `План требует исправления: ${inspection.findings
        .filter((finding) => finding.severity === "error")
        .map((finding) => userFacingInspectionMessage(finding.message))
        .join(" ")}`;

  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: session.id,
    role: "assistant",
    content: answer,
    data: {
      mode: "task",
      route: routeDecision,
      plannerHint: plannerHint ?? null,
      planId: persistedPlan.id,
      inspection,
      execution,
    } as Prisma.InputJsonValue,
  });

  return {
    answer,
    sessionId: session.id,
    state,
    cards,
    workspace,
    clarification:
      hasMissingActionSlots(inspection.findings)
        ? {
            question: missingActionSlotsAnswer(inspection.findings),
            options: [],
          }
        : plannerResult.plan.status === "needs_clarification"
        ? {
            question: plannerResult.plan.clarificationQuestion || plannerResult.plan.answer || "Нужно уточнение.",
            options: [],
          }
        : undefined,
    planTrace: buildPlanTrace(persistedPlan.steps, execution.results),
  };
}

type PersistedPlanStep = Awaited<ReturnType<typeof createCrmAgentPlan>>["steps"][number];

type RuntimeStepResult = {
  order: number;
  type: string;
  toolName: string | null;
  status: "done" | "failed" | "skipped";
  result?: unknown;
  error?: string | null;
};

async function saveConversationResponse(input: {
  sessionId: number;
  accountId: number;
  answer: string;
  state: CrmAgentTaskState;
  workspace: CrmAgentUiWorkspace;
  cards: CrmAgentCard[];
  data: Record<string, unknown>;
}): Promise<CrmAgentChatResponse> {
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: input.sessionId,
    role: "assistant",
    content: input.answer,
    data: inputJson(input.data),
  });

  return {
    answer: input.answer,
    sessionId: input.sessionId,
    state: input.state,
    cards: input.cards,
    workspace: input.workspace,
    planTrace: [],
  };
}

function shouldUseConversationLayer(route: CrmAgentRouteDecision) {
  return route.kind === "smalltalk" || route.kind === "crm_question" || route.kind === "unsupported";
}

function plannerFailureConversationRoute(route: CrmAgentRouteDecision, plannerError: string): CrmAgentRouteDecision {
  return {
    kind: "unsupported",
    confidence: Math.min(route.confidence, 0.3),
    reason: `Planner could not build a safe CRM task from this turn: ${plannerError}`,
    needsAccountContext: false,
    allowedToolModes: [],
  };
}

function aiAccessBlockedAnswer(error: string | null | undefined) {
  if (!error?.includes("AI access denied:")) return null;
  const reason = error.split("AI access denied:")[1]?.trim() || "ai_access_denied";
  const reasonText: Record<string, string> = {
    ai_balance_empty: "на балансе аккаунта нет средств для работы агента",
    ai_disabled: "интеллектуальные функции выключены для аккаунта",
    crm_agent_disabled: "агент выключен для аккаунта",
    site_assistant_disabled: "ассистент сайта выключен для аккаунта",
    daily_limit_exceeded: "дневной лимит расходов на агента исчерпан",
    monthly_limit_exceeded: "месячный лимит расходов на агента исчерпан",
  };
  return `Сейчас агент недоступен: ${reasonText[reason] ?? "доступ временно ограничен"}. Проверьте баланс и доступ агента в настройках.`;
}

function conversationModeForRoute(route: CrmAgentRouteDecision) {
  if (route.kind === "crm_question") return "question";
  return "conversation";
}

function plannerMessageWithRouting(message: string, route: CrmAgentRouteDecision, plannerHint?: string) {
  return [
    message,
    "",
    "[system routing context]",
    `route.kind=${route.kind}`,
    `route.reason=${route.reason}`,
    route.suggestedGoalType ? `route.suggestedGoalType=${route.suggestedGoalType}` : null,
    plannerHint ? `conversation.plannerHint=${plannerHint}` : null,
    `route.allowedToolModes=${route.allowedToolModes.join(",")}`,
    "Do not execute actions from routing. Use planner/inspector/action preview rules.",
  ]
    .filter((line): line is string => typeof line === "string" && line.length > 0)
    .join("\n");
}

async function executeRuntimePlanSteps(input: {
  accountId: number;
  userId?: number | null;
  sessionId: number;
  permissions: string[];
  planId: number;
  steps: PersistedPlanStep[];
  plannerSteps: CrmAgentPlannerPlan["steps"];
  allowedOrders: Set<number>;
  requiresConfirmation: boolean;
}) {
  const results: RuntimeStepResult[] = [];
  let failed = false;
  let needsUser = false;

  await updateCrmAgentPlanStatus({ accountId: input.accountId, planId: input.planId, status: "running" });

  for (const step of input.steps) {
    const toolName = step.toolName;
    if (!input.allowedOrders.has(step.order)) {
      await updateCrmAgentPlanStep({ accountId: input.accountId, planStepId: step.id, status: "skipped", error: "Step blocked by inspector." });
      results.push({ order: step.order, type: step.type, toolName, status: "skipped", error: "Step blocked by inspector." });
      continue;
    }

    if (!toolName) {
      await updateCrmAgentPlanStep({ accountId: input.accountId, planStepId: step.id, status: "skipped", error: "Step has no executable tool." });
      results.push({ order: step.order, type: step.type, toolName, status: "skipped", error: "Step has no executable tool." });
      continue;
    }

    const tool = getCrmAgentTool(toolName);
    if (!tool?.handler) {
      await updateCrmAgentPlanStep({ accountId: input.accountId, planStepId: step.id, status: "failed", error: `Tool handler is not registered: ${toolName}` });
      results.push({ order: step.order, type: step.type, toolName, status: "failed", error: `Tool handler is not registered: ${toolName}` });
      failed = true;
      break;
    }

    if (tool.mode === "execute" && input.requiresConfirmation) {
      await updateCrmAgentPlanStep({ accountId: input.accountId, planStepId: step.id, status: "skipped", error: "Execute step requires explicit user confirmation." });
      results.push({
        order: step.order,
        type: step.type,
        toolName,
        status: "skipped",
        error: "Execute step requires explicit user confirmation.",
      });
      needsUser = true;
      continue;
    }

    const args = normalizeRuntimeToolArgs(step, input.plannerSteps.find((plannerStep) => plannerStep.order === step.order) ?? null);
    const toolCall = await startCrmAgentToolCall({
      accountId: input.accountId,
      sessionId: input.sessionId,
      planStepId: step.id,
      toolName,
      args: inputJson(args),
    });

    await updateCrmAgentPlanStep({ accountId: input.accountId, planStepId: step.id, status: "running" });

    try {
      const result = await tool.handler(args, {
        accountId: input.accountId,
        userId: input.userId ?? null,
        sessionId: input.sessionId,
        permissions: input.permissions,
      } satisfies CrmAgentToolContext);
      await finishCrmAgentToolCall({ accountId: input.accountId, toolCallId: toolCall.id, status: "DONE", result: inputJson(result) });
      await updateCrmAgentPlanStep({ accountId: input.accountId, planStepId: step.id, status: "done", result: inputJson(result) });
      results.push({ order: step.order, type: step.type, toolName, status: "done", result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      await finishCrmAgentToolCall({ accountId: input.accountId, toolCallId: toolCall.id, status: "FAILED", error: message });
      await updateCrmAgentPlanStep({ accountId: input.accountId, planStepId: step.id, status: "failed", error: message });
      results.push({ order: step.order, type: step.type, toolName, status: "failed", error: message });
      failed = true;
      break;
    }
  }

  await updateCrmAgentPlanStatus({
    accountId: input.accountId,
    planId: input.planId,
    status: failed ? "failed" : needsUser ? "needs_user" : "completed",
    result: inputJson({ steps: results }),
  });

  return { status: failed ? "failed" : needsUser ? "needs_user" : "completed", results, failed, needsUser };
}

function normalizeRuntimeToolArgs(step: PersistedPlanStep, plannerStep: CrmAgentPlannerPlan["steps"][number] | null): Record<string, unknown> {
  const args = isRecord(step.args) ? { ...step.args } : {};
  const actionName = typeof plannerStep?.actionName === "string" ? plannerStep.actionName : null;

  if ((step.toolName === "actions.prepare" || step.toolName === "actions.preview") && actionName) {
    const payload = isRecord(args.payload) ? args.payload : { ...args };
    return {
      ...args,
      actionType: typeof args.actionType === "string" ? args.actionType : actionName,
      payload,
    };
  }

  return args;
}

function resolveRuntimeStateStatus(input: {
  plan: CrmAgentPlannerPlan;
  inspectionOk: boolean;
  executionFailed: boolean;
  needsUser: boolean;
  missingActionSlots?: boolean;
}): CrmAgentTaskState["status"] {
  if (input.plan.status === "needs_clarification") return "needs_clarification";
  if (input.missingActionSlots) return "needs_clarification";
  if (!input.inspectionOk || input.executionFailed) return "failed";
  if (input.needsUser) return "ready_for_confirmation";
  return "completed";
}

function hasMissingActionSlots(findings: Array<{ code: string }>) {
  return findings.some((finding) => finding.code === "missing_action_slots");
}

function missingActionSlotsAnswer(findings: Array<{ code: string; message: string }>) {
  const slots = new Set<string>();
  for (const finding of findings) {
    if (finding.code !== "missing_action_slots") continue;
    const match = finding.message.match(/missing slots:\s*(.+)\.?$/i);
    if (!match) continue;
    for (const slot of match[1].split(",")) {
      const label = actionSlotLabel(slot.trim().replace(/\.$/, ""));
      if (label) slots.add(label);
    }
  }
  const list = [...slots];
  if (!list.length) return "Нужно уточнить данные для записи, чтобы подготовить черновик.";
  return `Нужно уточнить данные для записи: ${list.join(", ")}. Напишите их одним сообщением, например: клиент, услуга, специалист, филиал и удобное время.`;
}

function actionSlotLabel(slot: string) {
  const map: Record<string, string> = {
    clientId: "клиент",
    serviceId: "услуга",
    specialistId: "специалист",
    locationId: "филиал",
    startAt: "дата и время",
    appointmentId: "запись",
    text: "текст",
  };
  return map[slot] ?? slot;
}

function userFacingInspectionMessage(message: string) {
  return message
    .replace(/Action\s+([a-z.]+)\s+is missing slots:\s*([^.]+)\./i, (_match, _action: string, slots: string) => {
      const labels = slots.split(",").map((slot) => actionSlotLabel(slot.trim())).filter(Boolean);
      return `Нужно уточнить: ${labels.join(", ")}.`;
    })
    .replace(/Missing permission for tool\s+([a-z.]+)\./i, "Недостаточно прав для нужного инструмента.")
    .replace(/Missing permission for action\s+([a-z.]+)\./i, "Недостаточно прав для этого действия.");
}

function buildPlanTrace(steps: PersistedPlanStep[], results: RuntimeStepResult[]): CrmAgentPlanTraceStep[] {
  const byOrder = new Map(results.map((result) => [result.order, result]));
  return steps.map((step): CrmAgentPlanTraceStep => {
    const result = byOrder.get(step.order);
    return {
      id: step.id,
      order: step.order,
      type: step.type as CrmAgentPlanTraceStep["type"],
      toolName: step.toolName,
      status: result?.status ?? (step.status as CrmAgentPlanTraceStep["status"]),
      args: step.args,
      result: result?.result ?? step.result,
      error: result?.error ?? step.error,
    };
  });
}

async function resolveRuntimeSession(input: RunCrmAgentTurnInput): Promise<RuntimeSession> {
  if (input.sessionId) {
    const existing = await getCrmAgentSession({ accountId: input.accountId, sessionId: input.sessionId });
    if (existing) return existing;
  }
  return createCrmAgentSession({
    accountId: input.accountId,
    userId: input.userId ?? null,
    mode: "chat",
    title: input.message.slice(0, 120),
  });
}

async function handlePlannerFailure(input: {
  sessionId: number;
  accountId: number;
  error: string;
  raw: string | null;
}): Promise<CrmAgentChatResponse> {
  const state = buildEmptyState(input.sessionId, input.accountId, "failed");
  await saveCrmAgentTaskState(state);
  const answer = "Не удалось построить план задачи. Попробуйте переформулировать запрос.";
  await addCrmAgentMessage({
    accountId: input.accountId,
    sessionId: input.sessionId,
    role: "assistant",
    content: answer,
    data: { error: input.error, raw: input.raw } as Prisma.InputJsonValue,
  });
  return {
    answer,
    sessionId: input.sessionId,
    state,
    cards: [],
    workspace: {
      mode: "empty",
      title: "Planner error",
      commands: [],
    },
    planTrace: [],
  };
}

function buildTaskState(input: {
  sessionId: number;
  accountId: number;
  plan: CrmAgentPlannerPlan;
  stepResults: RuntimeStepResult[];
  status: CrmAgentTaskState["status"];
}): CrmAgentTaskState {
  const state: CrmAgentTaskState = {
    sessionId: input.sessionId,
    accountId: input.accountId,
    goalType: input.plan.goal.type,
    status: input.status,
    slots: normalizeSlots(input.plan.goal.slots),
    candidates: {},
    selected: {},
    missing: input.plan.missingSlots,
  };
  applyResolverResultsToState(state, input.stepResults);
  if (state.missing.length && state.status !== "failed") state.status = "needs_clarification";
  return state;
}

function applyResolverResultsToState(state: CrmAgentTaskState, stepResults: RuntimeStepResult[]) {
  const missing = new Set(state.missing);
  for (const stepResult of stepResults) {
    const resolution = extractResolutionLikeResult(stepResult);
    if (!resolution) continue;

    const slotName = resolution.entity;
    state.candidates[slotName] = resolution.candidates;
    state.slots[slotName] = {
      ...(state.slots[slotName] ?? {}),
      query: resolution.query ?? state.slots[slotName]?.query,
      candidates: resolution.candidates,
      status: resolution.status,
      selectedId: resolution.selected?.id ?? state.slots[slotName]?.selectedId ?? null,
    };

    if (resolution.selected) {
      state.selected[slotName] = resolution.selected.id;
      missing.delete(slotName);
    } else if (resolution.status === "ambiguous" || resolution.status === "not_found" || resolution.status === "empty") {
      missing.add(slotName);
    }
  }
  state.missing = [...missing];
}

function buildEmptyState(
  sessionId: number,
  accountId: number,
  status: CrmAgentTaskState["status"],
): CrmAgentTaskState {
  return {
    sessionId,
    accountId,
    goalType: "unknown",
    status,
    slots: {},
    candidates: {},
    selected: {},
    missing: [],
  };
}

function normalizeSlots(slots: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(slots).map(([key, value]) => {
      if (isRecord(value)) {
        return [
          key,
          {
            query: typeof value.query === "string" ? value.query : undefined,
            value: value.value,
            selectedId: typeof value.selectedId === "string" || typeof value.selectedId === "number" ? value.selectedId : null,
            status: "empty",
          } satisfies CrmAgentSlot,
        ];
      }
      return [key, { value, status: value == null ? "empty" : "resolved" } satisfies CrmAgentSlot];
    }),
  );
}

function buildRuntimeCards(
  plan: CrmAgentPlannerPlan,
  findings: Array<{ severity: string; message: string; code: string }>,
  stepResults: RuntimeStepResult[],
) {
  const cards: CrmAgentCard[] = [
    {
      type: "report",
      title: plan.goal.userFacingSummary || plan.goal.type,
      subtitle: `Status: ${plan.status}`,
      data: {
        goal: plan.goal,
        missingSlots: plan.missingSlots,
      },
    },
  ];

  for (const finding of findings) {
    if (finding.code === "missing_action_slots") continue;
    cards.push({
      type: "report",
      title: finding.code,
      subtitle: finding.severity,
      data: { message: userFacingInspectionMessage(finding.message) },
    });
  }

  for (const step of stepResults) {
    const resolution = extractResolutionLikeResult(step);
    if (resolution?.candidates.length) {
      for (const candidate of resolution.candidates) {
        cards.push({
          type: cardTypeForCandidate(candidate.type),
          id: candidate.id,
          title: candidate.title,
          subtitle: candidate.subtitle ?? null,
          data: isRecord(candidate.data) ? candidate.data : { value: candidate.data },
          actions: [
            {
              id: `select:${resolution.entity}:${candidate.id}`,
              label: "Выбрать",
              kind: "select",
              payload: { slot: resolution.entity, value: candidate.id },
            },
          ],
        });
      }
    }
    const preview = extractActionPreview(step.result);
    if (preview) {
      cards.push({
        type: "preview",
        id: preview.actionId ?? `step-${step.order}`,
        title: preview.summary || preview.actionType,
        subtitle: preview.status,
        data: {
          actionType: preview.actionType,
          riskLevel: preview.riskLevel,
          permission: preview.permission,
          payload: preview.payload,
          preview: preview.preview,
        },
        actions: preview.actionId
          ? [
              {
                id: `confirm_action:${preview.actionId}`,
                label: "Подтвердить",
                kind: "confirm",
                risk: preview.riskLevel,
                payload: { actionId: preview.actionId },
              },
              {
                id: `reject_action:${preview.actionId}`,
                label: "Отклонить",
                kind: "reject",
                payload: { actionId: preview.actionId },
              },
            ]
          : [],
      });
    }
    cards.push({
      type: "report",
      title: `${step.toolName ?? step.type}: ${step.status}`,
      subtitle: `Step ${step.order}`,
      data: {
        result: step.result,
        error: step.error,
      },
    });
  }
  return cards;
}

function extractActionPreview(value: unknown): {
  actionId?: number;
  actionType: string;
  summary: string;
  status: string;
  riskLevel: CrmAgentRiskLevel;
  permission?: string | null;
  payload: Record<string, unknown>;
  preview: { before?: Record<string, unknown> | null; after: Record<string, unknown>; diff?: unknown };
} | null {
  if (!isRecord(value) || !isRecord(value.preview)) return null;
  const actionType = typeof value.actionType === "string" ? value.actionType : null;
  if (!actionType || !isRecord(value.preview.after)) return null;
  const riskLevel = isRiskLevel(value.riskLevel) ? value.riskLevel : "medium";
  return {
    actionId: typeof value.actionId === "number" ? value.actionId : undefined,
    actionType,
    summary: typeof value.summary === "string" ? value.summary : actionType,
    status: typeof value.status === "string" ? value.status : "DRAFT",
    riskLevel,
    permission: typeof value.permission === "string" ? value.permission : null,
    payload: isRecord(value.payload) ? value.payload : value.preview.after,
    preview: {
      before: isRecord(value.preview.before) ? value.preview.before : null,
      after: value.preview.after,
      diff: Array.isArray(value.preview.diff) ? value.preview.diff : [],
    },
  };
}

function isRiskLevel(value: unknown): value is CrmAgentRiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function extractResolutionLikeResult(step: RuntimeStepResult) {
  return extractResolverResult(step.result) ?? extractAvailableSlotResult(step);
}

function extractResolverResult(value: unknown): {
  entity: string;
  query: string | null;
  status: NonNullable<CrmAgentSlot["status"]>;
  candidates: CrmAgentCandidate[];
  selected?: CrmAgentCandidate;
} | null {
  if (!isRecord(value)) return null;
  const entity = typeof value.entity === "string" ? value.entity : null;
  const status = typeof value.status === "string" ? value.status : null;
  if (!entity || !isSlotStatus(status)) return null;
  const candidates = Array.isArray(value.candidates)
    ? value.candidates.filter((candidate): candidate is CrmAgentCandidate => isCandidate(candidate))
    : [];
  const selected = isCandidate(value.selected) ? value.selected : undefined;
  return {
    entity,
    query: typeof value.query === "string" ? value.query : null,
    status,
    candidates,
    selected,
  };
}

function extractAvailableSlotResult(step: RuntimeStepResult): {
  entity: string;
  query: string | null;
  status: NonNullable<CrmAgentSlot["status"]>;
  candidates: CrmAgentCandidate[];
  selected?: CrmAgentCandidate;
} | null {
  if (step.toolName !== "appointments.findAvailableSlots" || !isRecord(step.result) || !Array.isArray(step.result.slots)) {
    return null;
  }

  const candidates = step.result.slots
    .filter((slot): slot is Record<string, unknown> => isRecord(slot) && typeof slot.startAt === "string")
    .map((slot, index): CrmAgentCandidate => {
      const title = formatSlotDate(String(slot.startAt));
      const subtitle = [slot.serviceName, slot.specialistName, slot.locationName].filter((item): item is string => typeof item === "string").join(" | ");
      return {
        type: "slot",
        id: String(slot.startAt),
        title,
        subtitle: subtitle || null,
        data: { ...slot, rank: index + 1 },
      };
    });

  if (!candidates.length) {
    return { entity: "time", query: null, status: "not_found", candidates: [] };
  }
  return {
    entity: "time",
    query: null,
    status: candidates.length === 1 ? "resolved" : "ambiguous",
    candidates,
    selected: candidates.length === 1 ? candidates[0] : undefined,
  };
}

function isSlotStatus(value: unknown): value is NonNullable<CrmAgentSlot["status"]> {
  return value === "empty" || value === "resolving" || value === "ambiguous" || value === "resolved" || value === "not_found";
}

function isCandidate(value: unknown): value is CrmAgentCandidate {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    (typeof value.id === "string" || typeof value.id === "number") &&
    typeof value.title === "string"
  );
}

function cardTypeForCandidate(type: string): CrmAgentCard["type"] {
  if (type === "client") return "client";
  if (type === "service") return "service";
  if (type === "specialist") return "specialist";
  if (type === "location") return "location";
  if (type === "appointment") return "appointment";
  if (type === "slot") return "slot";
  if (type === "review") return "review";
  if (type === "promo" || type === "promotion") return "promo";
  return "report";
}

function buildRuntimeWorkspace(
  plan: CrmAgentPlannerPlan,
  cards: CrmAgentCard[],
  requiresConfirmation: boolean,
  stepResults: RuntimeStepResult[],
  state: CrmAgentTaskState,
): CrmAgentUiWorkspace {
  const selectionCards = cards.filter((card) => card.actions?.some((action) => action.kind === "select"));
  const previewCard = cards.find((card) => card.type === "preview");
  const preview = isRecord(previewCard?.data?.preview) && isRecord(previewCard.data.preview.after)
    ? {
        before: isRecord(previewCard.data.preview.before) ? previewCard.data.preview.before : undefined,
        after: previewCard.data.preview.after,
        diff: Array.isArray(previewCard.data.preview.diff) ? previewCard.data.preview.diff as never : undefined,
      }
    : undefined;
  const actionCommands = cards.flatMap((card) => card.actions ?? []).filter((action) => action.kind === "confirm" || action.kind === "reject");
  const form = previewCard ? buildDraftForm(previewCard) : undefined;
  return {
    mode: selectionCards.length || state.status === "needs_clarification" ? "select" : form ? "form" : preview ? "preview" : requiresConfirmation ? "confirm" : "report",
    title: plan.goal.userFacingSummary || plan.goal.type,
    cards,
    form,
    preview,
    tabs: [
      {
        id: "selection",
        title: "Варианты",
        badge: selectionCards.length,
        cards: selectionCards,
      },
      {
        id: "plan",
        title: "План",
        badge: plan.steps.length,
        table: {
          columns: [
            { key: "order", title: "Шаг", type: "number" },
            { key: "type", title: "Тип" },
            { key: "toolName", title: "Инструмент" },
            { key: "actionName", title: "Действие" },
            { key: "reason", title: "Зачем" },
          ],
          rows: plan.steps.map((step) => ({
            order: step.order,
            type: step.type,
            toolName: step.toolName ?? "",
            actionName: step.actionName ?? "",
            reason: step.reason,
          })),
        },
      },
      {
        id: "results",
        title: "Результаты",
        badge: stepResults.length,
        table: {
          columns: [
            { key: "order", title: "Шаг", type: "number" },
            { key: "toolName", title: "Инструмент" },
            { key: "status", title: "Статус", type: "status" },
            { key: "error", title: "Ошибка" },
          ],
          rows: stepResults.map((step) => ({
            order: step.order,
            toolName: step.toolName ?? "",
            status: step.status,
            error: step.error ?? "",
          })),
        },
      },
    ],
    commands: actionCommands,
  };
}

function buildDraftForm(card: CrmAgentCard): CrmAgentUiWorkspace["form"] {
  if (typeof card.id !== "number" || !isRecord(card.data?.payload)) return undefined;
  const payload = card.data.payload;
  return {
    id: `draft-${card.id}`,
    entityType: typeof card.data.actionType === "string" ? card.data.actionType : "draft",
    entityId: card.id,
    submitCommand: `save_draft:${card.id}`,
    fields: Object.entries(payload).map(([name, value]) => ({
      name,
      label: name,
      type: formFieldType(name, value),
      value: formFieldValue(value),
      required: false,
    })),
  };
}

function formFieldType(name: string, value: unknown): "text" | "textarea" | "number" | "date" | "datetime" | "toggle" {
  if (typeof value === "boolean") return "toggle";
  if (typeof value === "number") return "number";
  if (/At$|Date$/.test(name)) return "datetime";
  if (typeof value === "string" && value.length > 80) return "textarea";
  return "text";
}

function formFieldValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function degradedConversationAnswer(error: string | null | undefined) {
  return error?.includes("invalid_router_json") || error?.includes("invalid")
    ? "Сейчас агент не смог разобрать сообщение. Повторите запрос или напишите его чуть иначе."
    : "Сейчас агент не смог ответить. Проверьте доступ агента в настройках и повторите сообщение.";
}

function formatSlotDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function serializePlannerState(record: NonNullable<Awaited<ReturnType<typeof getLatestCrmAgentTaskState>>>): Prisma.JsonObject {
  return JSON.parse(
    JSON.stringify({
      goalType: record.goalType,
      status: record.status,
      slots: record.slots,
      candidates: record.candidates,
      selected: record.selected,
      missing: record.missing,
    }),
  ) as Prisma.JsonObject;
}

function taskStateFromRecord(record: NonNullable<Awaited<ReturnType<typeof getLatestCrmAgentTaskState>>>): CrmAgentTaskState {
  return {
    sessionId: record.sessionId,
    accountId: record.accountId,
    goalType: record.goalType,
    status: isTaskStatus(record.status) ? record.status : "collecting",
    slots: jsonClone(record.slots) as Record<string, CrmAgentSlot>,
    candidates: jsonClone(record.candidates ?? {}) as Record<string, CrmAgentCandidate[]>,
    selected: jsonClone(record.selected ?? {}) as Record<string, number | string>,
    missing: Array.isArray(record.missing) ? (jsonClone(record.missing) as string[]) : [],
  };
}

function isTaskStatus(value: string): value is CrmAgentTaskState["status"] {
  return (
    value === "collecting" ||
    value === "resolving" ||
    value === "needs_clarification" ||
    value === "ready_to_plan" ||
    value === "ready_for_confirmation" ||
    value === "completed" ||
    value === "failed"
  );
}

function jsonClone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? {}));
}

export function getCrmAgentRuntimeCapabilities() {
  return {
    tools: crmAgentToolRegistry.map((tool) => tool.name),
    actions: crmAgentActionRegistry.map((action) => action.name),
  };
}
