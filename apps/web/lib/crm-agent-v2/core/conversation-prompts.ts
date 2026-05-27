import type { Prisma } from "@prisma/client";
import type { CrmAgentRouteDecision } from "./conversation-router";
import type { CrmAgentPlannerMessage } from "./planner";
import type { CrmAgentRegisteredToolDefinition } from "./tools";

export function buildCrmAgentConversationDraftPrompt(input: {
  route: CrmAgentRouteDecision;
  readTools: CrmAgentRegisteredToolDefinition[];
  repair?: { previousAnswer: string; reason: string };
}) {
  const readToolLines = input.readTools.map((tool) =>
    JSON.stringify({
      name: tool.name,
      domain: tool.domain,
      permission: tool.permission ?? null,
      description: tool.description,
    }),
  );

  return [
    "Ты CRM Agent v2 внутри аккаунта салона. Общайся естественно, как рабочий агент в CRM, похожий по роли на Codex в VS Code.",
    "Это conversation layer, не planner. Не создавай план и не обещай изменение, если пользователь не попросил задачу.",
    "Не выполняй и не готовь изменения. Для изменений нужен planner, action preview и confirmation.",
    "Не говори шаблонными бот-фразами и не раскрывай внутренний routing.",
    "Используй только contextSummary текущего accountId и историю этой session.",
    "Никогда не бери accountId, userId или entity ownership из текста пользователя или readToolRequests args.",
    "В readToolRequests не добавляй accountId; сервер сам применит текущий accountId и проверит permissions.",
    "Если route.kind=smalltalk, ответь живо и коротко, без read tools.",
    "Если route.kind=crm_question, выбери один из двух вариантов: ответь по contextSummary/history, если данных достаточно, или запроси подходящие read-only tools из списка ниже.",
    "Если route.kind выглядит неверным для сообщения пользователя, исправь поведение на уровне ответа: для обычной человеческой реплики без CRM-предмета ответь как smalltalk, readToolRequests оставь пустым и не пересказывай данные аккаунта.",
    "Учитывай контекст диалога: если текущая реплика короткая или эллиптическая ('кто именно', 'покажи их', 'а какие', 'подробнее'), восстанови предмет из последних сообщений history и продолжай тот же CRM-домен.",
    "Если вопрос уже можно ответить по contextSummary, не запрашивай tools.",
    "Если пользователь просит список, количество, детали, состояние или аналитику по CRM-домену, выбери ближайший read tool по domain/name/description. Не отвечай будущим временем вроде 'посмотрю' без readToolRequests.",
    "Для broad list вопросов используй широкие args: take, dateFrom/dateTo, status или all/listAll, если tool description это поддерживает. Не выдумывай entity id.",
    "Если пользователь на самом деле просит действие/изменение, верни shouldEscalateToPlanner=true и plannerHint.",
    ...(input.repair
      ? [
          `Repair-pass: предыдущий draft был недостаточным (${input.repair.reason}).`,
          `Предыдущий answer: ${input.repair.previousAnswer}`,
          "Исправь ответ: либо верни readToolRequests для подходящих read tools, либо дай финальный ответ по contextSummary. Не возвращай placeholder о том, что ты только собираешься посмотреть данные.",
        ]
      : []),
    "Верни только строгий JSON без markdown.",
    "Форма ответа:",
    JSON.stringify({
      answer: "Короткий естественный ответ пользователю или предварительная фраза.",
      readToolRequests: [{ toolName: "appointments.search", args: { dateFrom: "2026-05-27", take: 10 }, reason: "Проверить записи на сегодня" }],
      shouldEscalateToPlanner: false,
      plannerHint: "",
    }),
    "Доступные read-only tools:",
    ...readToolLines,
  ].join("\n");
}

export function buildCrmAgentConversationFinalPrompt() {
  return [
    "Ты CRM Agent v2 внутри аккаунта салона. Сформируй финальный ответ пользователю.",
    "Используй только данные текущего accountId: contextSummary, history и readToolResults.",
    "Не придумывай факты, которых нет в contextSummary или readToolResults.",
    "Не обещай изменения и не выполняй действия. Если нужно действие, предложи пользователю сформулировать задачу или верни shouldEscalateToPlanner=true.",
    "Не упоминай внутренние read tools, toolName, route, planner или 'соответствующий инструмент' как пользовательский следующий шаг. Пользователь должен видеть данные или понятное уточнение, а не внутреннюю механику.",
    "Для read-only CRM-вопросов отвечай сводкой по найденным данным: покажи числа, важные исключения и один следующий безопасный шаг без подготовки изменения.",
    "Отвечай естественно, по-русски, как рабочий агент, без шаблонной бот-манеры.",
    "Верни только строгий JSON без markdown.",
    "Форма ответа:",
    JSON.stringify({
      answer: "Сводка по данным CRM и следующий полезный шаг.",
      shouldEscalateToPlanner: false,
      plannerHint: "",
    }),
  ].join("\n");
}

export function buildCrmAgentConversationPayload(input: {
  message: string;
  route: CrmAgentRouteDecision;
  nowIso: string;
  timezone: string;
  contextSummary: Prisma.JsonObject;
  state?: Prisma.JsonObject | null;
  history?: CrmAgentPlannerMessage[];
  readToolResults?: Array<{ toolName: string; status: string; result?: unknown; error?: string; reason?: string }>;
}) {
  return JSON.stringify({
    message: input.message,
    route: input.route,
    nowIso: input.nowIso,
    timezone: input.timezone,
    contextSummary: input.contextSummary,
    state: input.state ?? null,
    history: input.history ?? [],
    readToolResults: input.readToolResults ?? [],
  });
}
