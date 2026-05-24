import type { Prisma } from "@prisma/client";
import { createGigaChatCompletion } from "@/lib/gigachat";
import { runWithAiUsageContext } from "@/lib/ai-usage";
import type { CrmAgentToolDefinition } from "@/lib/crm-agent-types";

export type CrmAgentLlmCommand =
  | {
      command: "answer";
      answer: string;
    }
  | {
      command: "read";
      toolName: string;
      args: Prisma.JsonObject;
      answer?: string;
    }
  | {
      command: "draft_action";
      toolName: string;
      args: Prisma.JsonObject;
      answer?: string;
    }
  | {
      command: "update_memory";
      toolName: "memory.update";
      args: Prisma.JsonObject;
      answer?: string;
    }
  | {
      command: "analyze";
      analysisType: string;
      args: Prisma.JsonObject;
      answer?: string;
    };

type CrmAgentLlmResult =
  | { ok: true; command: CrmAgentLlmCommand; raw: string; model: string | null }
  | { ok: false; error: string; raw: string | null; model: string | null };

export type CrmAgentLlmObservation = {
  step: number;
  toolName: string;
  args: Prisma.JsonObject;
  result?: Prisma.JsonValue;
  error?: string | null;
};

export type CrmAgentLlmHistoryMessage = {
  role: string;
  content: string;
  createdAt?: string;
};

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced?.startsWith("{") && fenced.endsWith("}")) return fenced;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return null;
}

export function parseCrmAgentLlmCommand(raw: string): CrmAgentLlmCommand | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!isJsonObject(parsed)) return null;

  const command = typeof parsed.command === "string" ? parsed.command : "";
  if (command === "answer") {
    return { command, answer: typeof parsed.answer === "string" ? parsed.answer : "" };
  }
  if (command === "read" && typeof parsed.toolName === "string") {
    return {
      command,
      toolName: parsed.toolName,
      args: isJsonObject(parsed.args) ? parsed.args : {},
      answer: typeof parsed.answer === "string" ? parsed.answer : undefined,
    };
  }
  if (command === "draft_action") {
    return {
      command,
      toolName: typeof parsed.toolName === "string" ? parsed.toolName : "action.prepare",
      args: isJsonObject(parsed.args) ? parsed.args : {},
      answer: typeof parsed.answer === "string" ? parsed.answer : undefined,
    };
  }
  if (command === "update_memory") {
    return {
      command,
      toolName: "memory.update",
      args: isJsonObject(parsed.args) ? parsed.args : {},
      answer: typeof parsed.answer === "string" ? parsed.answer : undefined,
    };
  }
  if (command === "analyze") {
    return {
      command,
      analysisType: typeof parsed.analysisType === "string" ? parsed.analysisType : "general",
      args: isJsonObject(parsed.args) ? parsed.args : {},
      answer: typeof parsed.answer === "string" ? parsed.answer : undefined,
    };
  }

  return null;
}

function buildSystemPrompt(tools: CrmAgentToolDefinition[]) {
  const toolLines = tools.map((tool) =>
    JSON.stringify({
      name: tool.name,
      domain: tool.domain,
      mode: tool.mode,
      requiredPermission: tool.requiredPermission ?? null,
      riskLevel: tool.riskLevel,
      description: tool.description,
    }),
  );

  return [
    "Ты ИИ-ассистент русскоязычного салона или студии услуг.",
    "Отвечай пользователю только на русском языке. Не используй английские заголовки и англицизмы, если есть нормальный русский вариант.",
    "Верни только один строгий JSON-объект. Не оборачивай ответ в markdown.",
    "Допустимые формы команд:",
    '{"command":"answer","answer":"..."}',
    '{"command":"read","toolName":"clients.search","args":{"query":"..."},"answer":"короткое вступление на русском"}',
    '{"command":"draft_action","toolName":"services.draftUpdate","args":{"serviceId":1,"description":"..."},"answer":"короткое вступление на русском"}',
    '{"command":"draft_action","toolName":"action.prepare","args":{"actionType":"client.update","summary":"краткое описание на русском","payload":{},"permission":"crm.clients.update","riskLevel":"medium"},"answer":"короткое вступление на русском"}',
    '{"command":"update_memory","args":{"key":"tone_of_voice","value":"...","summary":"краткое описание на русском"},"answer":"короткое вступление на русском"}',
    '{"command":"analyze","analysisType":"insights","args":{},"answer":"короткое вступление на русском"}',
    "Если для ответа нужны данные, сначала верни read. После результата инструмента выбери следующий read, draft_action, update_memory, analyze или финальный answer.",
    "Ты полноценный агент, а не одноразовый чат. Всегда учитывай conversationHistory из user payload: это текущий диалог, включая прошлые ответы пользователя, ответы ассистента и результаты инструментов.",
    "Ты работаешь внутри CRM для сотрудника салона. Никогда не отвечай так, будто ты внешний клиентский бот: не пиши «свяжитесь с салоном», «посмотрите на сайте», «уточните у салона». Вместо этого сам используй CRM-инструменты.",
    "На вопросы про свободные дни, свободное время, окна или расписание конкретного специалиста обязательно используй appointments.findAvailableSlots. Если известен только текст имени, сначала используй specialists.search, затем appointments.findAvailableSlots по specialistId.",
    "Короткие ответы пользователя вроде «да», «ок», «сделай», «ты напиши», «подготовь сам», «выбери сам» считай продолжением предыдущей задачи. Не проси заново объяснять контекст, если он есть в conversationHistory.",
    "Если пользователь просит «ты напиши» после найденных окон, отзывов, клиентов или другой выборки, сам предложи разумный текст или подготовь черновик через подходящий draft_action, если данных достаточно.",
    "Если в conversationHistory есть role=tool, это результат уже выполненного инструмента из прошлых ходов. Используй его как фактические данные и не запрашивай заново без необходимости.",
    "Для записей, услуг, сотрудников, локаций и акций предпочитай специализированные draft-инструменты вместо action.prepare.",
    "Активно используй memory из user payload: тон общения, позиционирование, фокус бизнеса, аудиторию и предпочитаемые предложения. Если memory противоречит фактам CRM, опирайся на факты CRM.",
    "Если в user payload есть observations, это результаты уже выполненных инструментов. Используй их, не запрашивай тот же инструмент с теми же аргументами повторно.",
    "Финальный answer должен кратко объяснить выводы на русском и назвать подготовленные черновики или действия, если они были созданы.",
    "Никогда не выполняй изменения напрямую. Любое изменение записи, публичный ответ, изменение сайта, изменение цены или уведомление должно быть draft_action.",
    "Используй только эти инструменты:",
    ...toolLines,
  ].join("\n");
}

export async function requestCrmAgentLlmCommand(input: {
  accountId: number;
  threadId: number;
  runId: number;
  message: string;
  contextSummary: Prisma.JsonObject;
  memory: Prisma.JsonValue;
  insights: Prisma.JsonValue;
  tools: CrmAgentToolDefinition[];
  observations?: CrmAgentLlmObservation[];
  conversationHistory?: CrmAgentLlmHistoryMessage[];
  step?: number;
}): Promise<CrmAgentLlmResult> {
  try {
    const completion = await runWithAiUsageContext(
      { accountId: input.accountId, threadId: input.threadId, actionId: input.runId },
      () =>
        createGigaChatCompletion(
          [
            { role: "system", content: buildSystemPrompt(input.tools) },
            {
              role: "user",
              content: JSON.stringify({
                message: input.message,
                contextSummary: input.contextSummary,
                memory: input.memory,
                insights: input.insights,
                conversationHistory: input.conversationHistory ?? [],
                observations: input.observations ?? [],
                step: input.step ?? 1,
              }),
            },
          ],
          { purpose: "crm_agent_orchestrator", scope: "crm_agent" },
        ),
    );
    const command = parseCrmAgentLlmCommand(completion.content);
    if (!command) {
      return { ok: false, error: "invalid_json_command", raw: completion.content, model: completion.model };
    }
    return { ok: true, command, raw: completion.content, model: completion.model };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "llm_request_failed",
      raw: null,
      model: null,
    };
  }
}
