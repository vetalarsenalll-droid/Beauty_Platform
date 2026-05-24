import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import {
  appendCrmAgentMessage,
  createAgentRun,
  getOrCreateCurrentCrmAgentThread,
  updateCrmAgentThread,
} from "@/lib/crm-agent-persistence";
import { runCrmAgentChat } from "@/lib/crm-agent-orchestrator";

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const actionIntent = typeof body.actionIntent === "string" ? body.actionIntent.trim() : null;
  const entity =
    body.entity && typeof body.entity === "object" && !Array.isArray(body.entity)
      ? { type: typeof body.entity.type === "string" ? body.entity.type : null, id: typeof body.entity.id === "number" || typeof body.entity.id === "string" ? body.entity.id : null }
      : null;
  const actionMessage = actionIntent && entity?.type && entity.id != null ? `${actionIntent} ${entity.type} #${entity.id}` : "";
  const message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : actionMessage;
  if (!message) return jsonError("VALIDATION_FAILED", "message is required.", null, 400);
  const requestedToolName = typeof body.toolName === "string" ? body.toolName.trim() : null;
  const requestedToolArgs =
    body.toolArgs && typeof body.toolArgs === "object" && !Array.isArray(body.toolArgs) ? body.toolArgs : null;

  const thread = await getOrCreateCurrentCrmAgentThread({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    threadId: typeof body.threadId === "number" ? body.threadId : null,
    forceNew: body.newThread === true,
  });

  const run = await createAgentRun({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    threadId: thread.id,
    runType: "manual_chat",
    input: { message, actionIntent, entity },
  });

  await appendCrmAgentMessage({ threadId: thread.id, role: "user", content: message });
  if (!thread.title || thread.title === "CRM AI Agent") {
    await updateCrmAgentThread({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      threadId: thread.id,
      title: message.length > 64 ? `${message.slice(0, 64)}...` : message,
    });
  }

  const agentResult = await runCrmAgentChat({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    permissions: auth.session.permissions,
    runId: run.id,
    threadId: thread.id,
    message,
    requestedToolName,
    requestedToolArgs,
    actionIntent,
    actionEntity: entity,
  });

  const response = jsonOk({
    threadId: thread.id,
    runId: run.id,
    answer: agentResult.answer,
    context: {
      summary: agentResult.context.summary,
      ai: agentResult.context.ai,
      autopilot: agentResult.context.autopilot,
    },
    selectedToolName: agentResult.selectedToolName,
    toolResult: agentResult.toolResult,
    toolSteps: agentResult.toolSteps,
    entities: agentResult.entities,
    cards: agentResult.cards,
    suggestedActions: agentResult.suggestedActions,
    clarification: agentResult.clarification,
    threadState: agentResult.threadState,
    tools: agentResult.tools.map((tool) => ({
      name: tool.name,
      domain: tool.domain,
      mode: tool.mode,
      riskLevel: tool.riskLevel,
    })),
    pendingActions: agentResult.pendingActions,
    autopilot: agentResult.autopilot,
  });
  return applyCrmAccessCookie(response, auth);
}
