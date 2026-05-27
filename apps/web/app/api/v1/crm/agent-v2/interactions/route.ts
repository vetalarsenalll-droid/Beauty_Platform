import { jsonError, jsonOk } from "@/lib/api";
import { handleCrmAgentInteractiveCommand } from "@/lib/crm-agent-v2/core/commands";
import { requireCrmAgentApi, withCrmAgentAuthCookie } from "../_shared";

export async function POST(request: Request) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("INVALID_BODY", "Invalid request body.", null, 400);

  const sessionId = Number((body as { sessionId?: unknown }).sessionId);
  const commandId = (body as { commandId?: unknown }).commandId;
  const payload = (body as { payload?: unknown }).payload;

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return jsonError("VALIDATION_FAILED", "sessionId is required.", { fields: [{ path: "sessionId", issue: "invalid" }] }, 400);
  }
  if (typeof commandId !== "string" || !commandId.trim()) {
    return jsonError("VALIDATION_FAILED", "commandId is required.", { fields: [{ path: "commandId", issue: "required" }] }, 400);
  }
  if (payload !== undefined && (!payload || typeof payload !== "object" || Array.isArray(payload))) {
    return jsonError("VALIDATION_FAILED", "payload must be an object.", { fields: [{ path: "payload", issue: "invalid" }] }, 400);
  }

  const result = await handleCrmAgentInteractiveCommand({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    permissions: auth.session.permissions,
    request: {
      sessionId,
      commandId: commandId.trim(),
      payload: payload as Record<string, unknown> | undefined,
    },
  });

  return withCrmAgentAuthCookie(jsonOk(result), auth);
}
