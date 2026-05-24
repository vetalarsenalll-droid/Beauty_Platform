import type { Prisma } from "@prisma/client";
import { canExecuteCrmAgentAction, executeConfirmedCrmAgentAction } from "@/lib/crm-agent-action-executor";
import { canAutopilotExecuteCrmAgentAction } from "@/lib/crm-agent-autopilot";
import { buildCrmAgentAccountContext } from "@/lib/crm-agent-context";
import { executeCrmAgentReadTool } from "@/lib/crm-agent-domain-tools";
import { generateCrmAgentInsights } from "@/lib/crm-agent-insights";
import { requestCrmAgentLlmCommand, type CrmAgentLlmCommand, type CrmAgentLlmObservation } from "@/lib/crm-agent-llm-contract";
import {
  appendCrmAgentMessage,
  confirmPendingAction,
  createAgentToolCall,
  createPendingAction,
  finishAgentRun,
  finishAgentToolCall,
  getPendingActionForAccount,
  listPendingActions,
  writeAgentAudit,
} from "@/lib/crm-agent-persistence";
import { getCrmAgentTool, listCrmAgentToolsForPermissions } from "@/lib/crm-agent-tool-registry";
import type { CrmAgentRiskLevel, CrmAgentScope, CrmAgentToolDefinition } from "@/lib/crm-agent-types";

type RunCrmAgentChatInput = {
  accountId: number;
  userId: number;
  permissions: string[];
  runId: number;
  threadId: number;
  message: string;
  requestedToolName?: string | null;
  requestedToolArgs?: Prisma.JsonObject | null;
};

type ToolExecution = {
  selectedToolName: string | null;
  toolResult: Prisma.JsonValue | null;
  answer: string;
  observations?: CrmAgentLlmObservation[];
  autopilot?: Prisma.JsonValue | null;
};

const MAX_LLM_TOOL_STEPS = 5;

function toJsonValue(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

function toJsonObject(value: unknown): Prisma.JsonObject {
  const json = toJsonValue(value);
  return typeof json === "object" && json !== null && !Array.isArray(json) ? json : {};
}

function compactJsonValue(value: unknown, maxLength = 5000): Prisma.JsonValue {
  const json = toJsonValue(value);
  const text = JSON.stringify(json);
  if (text.length <= maxLength) return json;
  return {
    truncated: true,
    originalLength: text.length,
    preview: text.slice(0, maxLength),
  };
}

function commandKey(command: CrmAgentLlmCommand) {
  if (command.command === "read") return `${command.toolName}:${JSON.stringify(command.args)}`;
  if (command.command === "analyze") return `analyze:${command.analysisType}:${JSON.stringify(command.args)}`;
  return `${command.command}:${JSON.stringify("args" in command ? command.args : {})}`;
}

function hasPermission(permissions: string[], permission?: string | null) {
  return !permission || permissions.includes("crm.all") || permissions.includes(permission);
}

function pendingActionIdFromResult(result: Prisma.JsonValue | null) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const value = result.pendingActionId;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function riskLevel(value: unknown): CrmAgentRiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function stringField(args: Prisma.JsonObject, key: string) {
  const value = args[key];
  return typeof value === "string" ? value.trim() : "";
}

function inferReadToolName(message: string) {
  const text = message.toLocaleLowerCase("ru-RU");
  if (/(свободн.*окн|слот|окошк)/i.test(text)) return "appointments.findAvailableSlots";
  if (/(отзыв|жалоб|оценк|рейтинг)/i.test(text)) return "reviews.search";
  if (/(клиент|телефон|почт|контакт)/i.test(text)) return "clients.search";
  if (/(запис|визит|брон|приём|прием)/i.test(text)) return "appointments.search";
  if (/(услуг|прайс|цен)/i.test(text)) return "services.search";
  if (/(мастер|специалист|сотрудник)/i.test(text)) return "specialists.search";
  if (/(филиал|локац|адрес)/i.test(text)) return "locations.search";
  if (/(акци|промо|скидк)/i.test(text)) return "promos.search";
  if (/(удерж|вернуть|давно не был|реактивац)/i.test(text)) return "analytics.retention";
  if (/(загруз|выруч|аналит|слаб.*дн|неявк|отмен)/i.test(text)) return "analytics.workload";
  if (/(сайт|поиск|описан|карточк)/i.test(text)) return "site.health";
  return null;
}

function fallbackAnswer(message: string, selectedToolName: string | null, toolResult: Prisma.JsonValue | null) {
  if (selectedToolName && toolResult) {
    return "Проверил данные. Ниже вернул результат инструмента; изменения без подтверждения не выполнялись.";
  }
  if (/созда|измени|удали|отправ|ответь|опубликуй|перенеси|отмени/i.test(message)) {
    return "Для такого действия нужно подготовить черновик и подтвердить его перед выполнением. Уточните объект и желаемое изменение.";
  }
  return "Готов проверить данные, подготовить черновик действия или собрать рекомендации. Напишите, какой участок разобрать.";
}

async function createActionFromArgs(input: {
  args: Prisma.JsonObject;
  accountId: number;
  userId: number;
  threadId: number;
  permissions: string[];
}) {
  const actionType = stringField(input.args, "actionType");
  const summary = stringField(input.args, "summary");
  if (!actionType || !summary) throw new Error("Для подготовки действия нужны тип действия и краткое описание.");

  const permission = stringField(input.args, "permission") || null;
  if (!hasPermission(input.permissions, permission)) {
    throw new Error(`Недостаточно прав: ${permission}`);
  }

  return createPendingAction({
    accountId: input.accountId,
    userId: input.userId,
    threadId: input.threadId,
    actionType,
    summary,
    payload: (input.args.payload ?? {}) as Prisma.InputJsonValue,
    riskLevel: riskLevel(input.args.riskLevel),
    permission,
  });
}

async function createMemoryActionFromArgs(input: {
  args: Prisma.JsonObject;
  accountId: number;
  userId: number;
  threadId: number;
  permissions: string[];
}) {
  if (!hasPermission(input.permissions, "crm.assistant.memory.manage")) {
    throw new Error("Недостаточно прав для изменения памяти ассистента.");
  }
  const key = stringField(input.args, "key");
  if (!key) throw new Error("Для обновления памяти нужен ключ.");
  const summary = stringField(input.args, "summary") || `Обновить память ассистента: ${key}`;

  return createPendingAction({
    accountId: input.accountId,
    userId: input.userId,
    threadId: input.threadId,
    actionType: "memory.update",
    summary,
    payload: {
      key,
      value: (input.args.value ?? null) as Prisma.JsonValue,
      confidence: typeof input.args.confidence === "number" ? input.args.confidence : 1,
      source: "crm_agent_llm",
    },
    riskLevel: "medium",
    permission: "crm.assistant.memory.manage",
  });
}

async function runReadTool(input: {
  tool: CrmAgentToolDefinition;
  args: Prisma.JsonObject;
  scope: CrmAgentScope;
  accountId: number;
  runId: number;
  threadId: number;
}) {
  const toolCall = await createAgentToolCall({
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
    toolName: input.tool.name,
    arguments: input.args as Prisma.InputJsonValue,
  });

  try {
    const result = await executeCrmAgentReadTool({
      tool: input.tool,
      args: input.args,
      scope: input.scope,
    });
    await finishAgentToolCall({
      accountId: input.accountId,
      toolCallId: toolCall.id,
      result: result as Prisma.InputJsonValue,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить инструмент.";
    await finishAgentToolCall({
      accountId: input.accountId,
      toolCallId: toolCall.id,
      error: message,
    });
    throw error;
  }
}

async function runDraftTool(input: {
  tool: CrmAgentToolDefinition;
  args: Prisma.JsonObject;
  scope: CrmAgentScope;
  accountId: number;
  runId: number;
  threadId: number;
}) {
  const toolCall = await createAgentToolCall({
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
    toolName: input.tool.name,
    arguments: input.args as Prisma.InputJsonValue,
  });

  try {
    if (!input.tool.handler) throw new Error(`Draft tool handler is not registered: ${input.tool.name}`);
    const result = await input.tool.handler(input.args, input.scope);
    await finishAgentToolCall({
      accountId: input.accountId,
      toolCallId: toolCall.id,
      result: result as Prisma.InputJsonValue,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подготовить черновик.";
    await finishAgentToolCall({
      accountId: input.accountId,
      toolCallId: toolCall.id,
      error: message,
    });
    throw error;
  }
}

async function maybeExecuteAutopilotAction(input: {
  accountId: number;
  actionId: number | null;
  userId: number;
  settings: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}) {
  if (!input.actionId) return null;
  const action = await getPendingActionForAccount({ accountId: input.accountId, actionId: input.actionId });
  if (!action || action.status !== "PENDING") return null;

  const decision = canAutopilotExecuteCrmAgentAction({
    settings: input.settings,
    actionType: action.actionType,
    riskLevel: action.riskLevel,
    payload: action.payload,
  });
  if (!decision.allowed) {
    return toJsonValue({ attempted: false, decision });
  }
  if (!canExecuteCrmAgentAction(action.actionType)) {
    return toJsonValue({ attempted: false, decision: { ...decision, allowed: false, reason: "action_not_executable" } });
  }

  const confirmed = await confirmPendingAction({
    accountId: input.accountId,
    actionId: input.actionId,
    userId: input.userId,
  });
  if (!confirmed.count) return toJsonValue({ attempted: false, decision: { ...decision, reason: "action_not_pending" } });

  await writeAgentAudit({
    accountId: input.accountId,
    userId: input.userId,
    action: "ai_agent.autopilot.execute",
    targetType: "ai_pending_action",
    targetId: String(input.actionId),
    data: { actionType: action.actionType, level: input.settings.level, domain: decision.domain },
  });

  const execution = await executeConfirmedCrmAgentAction({
    accountId: input.accountId,
    actionId: input.actionId,
    userId: input.userId,
  });
  return toJsonValue({ attempted: true, decision, execution });
}

async function executeLlmCommand(input: {
  command: CrmAgentLlmCommand;
  accountId: number;
  userId: number;
  permissions: string[];
  runId: number;
  threadId: number;
  scope: CrmAgentScope;
  autopilot: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>["autopilot"];
}) {
  if (input.command.command === "answer") {
    return {
      selectedToolName: null,
      toolResult: null,
      answer: input.command.answer || "Готов помочь с клиентской базой, записями и рекомендациями.",
    };
  }

  if (input.command.command === "read") {
    const tool = getCrmAgentTool(input.command.toolName);
    if (!tool || tool.mode !== "read") throw new Error("Запрошенный инструмент чтения недоступен.");
    const result = await runReadTool({
      tool,
      args: input.command.args,
      scope: input.scope,
      accountId: input.accountId,
      runId: input.runId,
      threadId: input.threadId,
    });
    return {
      selectedToolName: tool.name,
      toolResult: result,
      answer: input.command.answer || "Проверил данные.",
    };
  }

  if (input.command.command === "draft_action") {
    if (input.command.toolName && input.command.toolName !== "action.prepare") {
      const tool = getCrmAgentTool(input.command.toolName);
      if (!tool || tool.mode !== "draft") throw new Error("Запрошенный draft-инструмент недоступен.");
      const result = await runDraftTool({
        tool,
        args: input.command.args,
        scope: input.scope,
        accountId: input.accountId,
        runId: input.runId,
        threadId: input.threadId,
      });
      const autopilot = await maybeExecuteAutopilotAction({
        accountId: input.accountId,
        actionId: pendingActionIdFromResult(result),
        userId: input.userId,
        settings: input.autopilot,
      });
      return {
        selectedToolName: tool.name,
        toolResult: autopilot && typeof autopilot === "object" && !Array.isArray(autopilot)
          ? toJsonValue({ draft: result, autopilot })
          : result,
        answer:
          autopilot && typeof autopilot === "object" && !Array.isArray(autopilot) && autopilot.attempted === true
            ? input.command.answer || "Подготовил и выполнил безопасное действие по правилам автопилота."
            : input.command.answer || "Подготовил черновик действия. Его нужно подтвердить перед выполнением.",
        autopilot,
      };
    }

    const action = await createActionFromArgs({ ...input, args: input.command.args });
    const autopilot = await maybeExecuteAutopilotAction({
      accountId: input.accountId,
      actionId: action.id,
      userId: input.userId,
      settings: input.autopilot,
    });
    return {
      selectedToolName: "action.prepare",
      toolResult: toJsonValue({ pendingActionId: action.id, status: action.status, autopilot }),
      answer:
        autopilot && typeof autopilot === "object" && !Array.isArray(autopilot) && autopilot.attempted === true
          ? input.command.answer || "Подготовил и выполнил безопасное действие по правилам автопилота."
          : input.command.answer || "Подготовил действие. Его нужно подтвердить перед выполнением.",
      autopilot,
    };
  }

  if (input.command.command === "update_memory") {
    const action = await createMemoryActionFromArgs({ ...input, args: input.command.args });
    const autopilot = await maybeExecuteAutopilotAction({
      accountId: input.accountId,
      actionId: action.id,
      userId: input.userId,
      settings: input.autopilot,
    });
    return {
      selectedToolName: "memory.update",
      toolResult: toJsonValue({ pendingActionId: action.id, status: action.status, autopilot }),
      answer:
        autopilot && typeof autopilot === "object" && !Array.isArray(autopilot) && autopilot.attempted === true
          ? input.command.answer || "Обновил память ассистента по правилам автопилота."
          : input.command.answer || "Подготовил обновление памяти. Его нужно подтвердить.",
      autopilot,
    };
  }

  if (input.command.command === "analyze" && input.command.analysisType === "insights") {
    const result = await generateCrmAgentInsights(input.accountId);
    return {
      selectedToolName: null,
      toolResult: toJsonValue(result),
      answer: input.command.answer || `Провёл анализ и создал новых рекомендаций: ${result.createdCount}.`,
    };
  }

  return {
    selectedToolName: null,
    toolResult: toJsonValue({ analysisType: input.command.analysisType, args: input.command.args }),
    answer: input.command.answer || "Собрал основу для анализа. Детальные выводы появятся в рекомендациях.",
  };
}

async function executeLlmToolLoop(input: {
  accountId: number;
  userId: number;
  permissions: string[];
  runId: number;
  threadId: number;
  message: string;
  context: Awaited<ReturnType<typeof buildCrmAgentAccountContext>>;
  tools: CrmAgentToolDefinition[];
  scope: CrmAgentScope;
}) {
  const observations: CrmAgentLlmObservation[] = [];
  const seenCommands = new Set<string>();
  let model: string | null = null;
  let lastCommand: CrmAgentLlmCommand | null = null;
  let lastError: string | null = null;

  for (let step = 1; step <= MAX_LLM_TOOL_STEPS; step += 1) {
    const llm = await requestCrmAgentLlmCommand({
      accountId: input.accountId,
      threadId: input.threadId,
      runId: input.runId,
      message: input.message,
      contextSummary: toJsonObject(input.context.summary),
      memory: toJsonValue(input.context.memory),
      insights: toJsonValue(input.context.insights),
      tools: input.tools,
      observations,
      step,
    });

    if (!llm.ok) {
      return {
        ok: false as const,
        model: llm.model ?? model,
        error: llm.error,
        raw: llm.raw,
        observations,
        lastCommand,
      };
    }

    model = llm.model;
    lastCommand = llm.command;
    const key = commandKey(llm.command);
    if (seenCommands.has(key) && llm.command.command !== "answer") {
      lastError = "Модель повторно запросила тот же шаг.";
      break;
    }
    seenCommands.add(key);

    if (llm.command.command === "answer") {
      return {
        ok: true as const,
        model,
        execution: {
          selectedToolName: observations.at(-1)?.toolName ?? null,
          toolResult: observations.at(-1)?.result ?? null,
          answer: llm.command.answer || "Готово.",
          observations,
        },
      };
    }

    if (llm.command.command === "read") {
      const tool = getCrmAgentTool(llm.command.toolName);
      if (!tool || tool.mode !== "read") throw new Error("Запрошенный инструмент чтения недоступен.");
      try {
        const result = await runReadTool({
          tool,
          args: llm.command.args,
          scope: input.scope,
          accountId: input.accountId,
          runId: input.runId,
          threadId: input.threadId,
        });
        const observation: CrmAgentLlmObservation = {
          step,
          toolName: tool.name,
          args: llm.command.args,
          result: compactJsonValue(result),
          error: null,
        };
        observations.push(observation);
        await appendCrmAgentMessage({
          threadId: input.threadId,
          role: "tool",
          content: JSON.stringify(observation),
        });
        continue;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось выполнить инструмент.";
        const observation: CrmAgentLlmObservation = {
          step,
          toolName: llm.command.toolName,
          args: llm.command.args,
          error: message,
        };
        observations.push(observation);
        await appendCrmAgentMessage({
          threadId: input.threadId,
          role: "tool",
          content: JSON.stringify(observation),
        });
        continue;
      }
    }

    if (llm.command.command === "analyze" && llm.command.analysisType === "insights") {
      const result = await generateCrmAgentInsights(input.accountId);
      const observation: CrmAgentLlmObservation = {
        step,
        toolName: "insights.generate",
        args: llm.command.args,
        result: compactJsonValue(result),
        error: null,
      };
      observations.push(observation);
      await appendCrmAgentMessage({
        threadId: input.threadId,
        role: "tool",
        content: JSON.stringify(observation),
      });
      continue;
    }

    const execution = await executeLlmCommand({
      command: llm.command,
      accountId: input.accountId,
      userId: input.userId,
      permissions: input.permissions,
      runId: input.runId,
      threadId: input.threadId,
      scope: input.scope,
      autopilot: input.context.autopilot,
    });
    return {
      ok: true as const,
      model,
      execution: {
        ...execution,
        observations,
      },
    };
  }

  const lastObservation = observations.at(-1);
  return {
    ok: true as const,
    model,
    execution: {
      selectedToolName: lastObservation?.toolName ?? null,
      toolResult: lastObservation?.result ?? null,
      answer: lastError
        ? "Проверил данные, но остановил цепочку инструментов из-за повторяющегося шага. Сформулируйте запрос точнее или подтвердите нужное действие отдельно."
        : "Проверил данные несколькими инструментами. Для продолжения уточните, какое действие подготовить на подтверждение.",
      observations,
    },
  };
}

async function executeDeterministicFallback(input: {
  accountId: number;
  runId: number;
  threadId: number;
  message: string;
  requestedToolName?: string | null;
  requestedToolArgs?: Prisma.JsonObject | null;
  scope: CrmAgentScope;
}): Promise<ToolExecution> {
  const selectedToolName = input.requestedToolName || inferReadToolName(input.message);
  if (!selectedToolName) {
    if (/(проанализ|рекомендац|совет|что улучш|найди проблем)/i.test(input.message)) {
      const result = await generateCrmAgentInsights(input.accountId);
      return {
        selectedToolName: null,
        toolResult: toJsonValue(result),
        answer: `Провёл анализ и создал новых рекомендаций: ${result.createdCount}.`,
      };
    }
    return {
      selectedToolName: null,
      toolResult: null,
      answer: fallbackAnswer(input.message, null, null),
    };
  }

  const tool = getCrmAgentTool(selectedToolName);
  if (!tool || tool.mode !== "read") {
    return {
      selectedToolName: null,
      toolResult: null,
      answer: "Запрошенный инструмент недоступен для чтения. Изменения можно выполнять только через действия на подтверждение.",
    };
  }

  const result = await runReadTool({
    tool,
    args: input.requestedToolArgs ?? {},
    scope: input.scope,
    accountId: input.accountId,
    runId: input.runId,
    threadId: input.threadId,
  });

  return {
    selectedToolName: tool.name,
    toolResult: result,
    answer: fallbackAnswer(input.message, tool.name, result),
  };
}

export async function runCrmAgentChat(input: RunCrmAgentChatInput) {
  const scope: CrmAgentScope = {
    accountId: input.accountId,
    userId: input.userId,
    permissions: input.permissions,
    threadId: input.threadId,
    runId: input.runId,
  };
  const context = await buildCrmAgentAccountContext({
    accountId: input.accountId,
    userId: input.userId,
    permissions: input.permissions,
  });
  const tools = listCrmAgentToolsForPermissions(input.permissions);

  let execution: ToolExecution;
  let llmStatus: Prisma.JsonObject = { used: false };

  try {
    if (input.requestedToolName) {
      execution = await executeDeterministicFallback({ ...input, scope });
    } else {
      const loop = await executeLlmToolLoop({
        accountId: input.accountId,
        userId: input.userId,
        permissions: input.permissions,
        runId: input.runId,
        threadId: input.threadId,
        message: input.message,
        context,
        tools,
        scope,
      });

      if (loop.ok) {
        llmStatus = {
          used: true,
          ok: true,
          model: loop.model,
          mode: "tool_loop",
          steps: loop.execution.observations?.length ?? 0,
        };
        execution = loop.execution;
      } else {
        llmStatus = { used: true, ok: false, error: loop.error, model: loop.model, mode: "tool_loop" };
        execution = await executeDeterministicFallback({ ...input, scope });
      }
    }

    await appendCrmAgentMessage({
      threadId: input.threadId,
      role: "assistant",
      content: execution.answer,
    });
    await finishAgentRun({
      accountId: input.accountId,
      runId: input.runId,
      output: toJsonValue({
        answer: execution.answer,
        selectedToolName: execution.selectedToolName,
        toolSteps: execution.observations ?? [],
        llm: llmStatus,
        autopilot: {
          settings: context.autopilot,
          execution: execution.autopilot ?? null,
        },
      }) as Prisma.InputJsonValue,
    });

    const pendingActions = await listPendingActions({
      accountId: input.accountId,
      threadId: input.threadId,
      take: 20,
    });

    return {
      answer: execution.answer,
      context,
      selectedToolName: execution.selectedToolName,
      toolResult: execution.toolResult,
      toolSteps: execution.observations ?? [],
      tools,
      pendingActions,
      llm: llmStatus,
      autopilot: {
        settings: context.autopilot,
        execution: execution.autopilot ?? null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить запрос ассистента.";
    await finishAgentRun({
      accountId: input.accountId,
      runId: input.runId,
      error: message,
      output: { message: input.message } as Prisma.InputJsonValue,
    });
    await appendCrmAgentMessage({
      threadId: input.threadId,
      role: "assistant",
      content: "Не удалось выполнить запрос ассистента. Проверьте права доступа или параметры действия.",
    });
    throw error;
  }
}
