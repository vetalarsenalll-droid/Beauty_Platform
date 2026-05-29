import { jsonError, jsonOk } from "@/lib/api";
import { runCrmAgentTurn } from "@/lib/crm-agent-v2/core/runtime";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireCrmAgentApi, withCrmAgentAuthCookie } from "../_shared";

export async function POST(request: Request) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;
  const limited = enforceRateLimit({
    request,
    scope: "crm-agent-v2-chat",
    limit: 60,
    windowMs: 60_000,
    identity: `${auth.session.accountId}:${auth.session.userId ?? "anonymous"}`,
  });
  if (limited) return withCrmAgentAuthCookie(limited, auth);

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError("INVALID_BODY", "Invalid request body.", null, 400);

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return jsonError("VALIDATION_FAILED", "message is required.", null, 400);

    const rawSessionId = typeof body.sessionId === "number" ? body.sessionId : null;
    const timezone = typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : undefined;

    const result = await runCrmAgentTurn({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      permissions: auth.session.permissions,
      sessionId: rawSessionId,
      message,
      timezone,
    });

    return withCrmAgentAuthCookie(jsonOk(result), auth);
  } catch (error) {
    console.error("[crm-agent-v2] chat turn failed", error);
    const message = error instanceof Error ? error.message : "crm_agent_turn_failed";
    return withCrmAgentAuthCookie(jsonError("CRM_AGENT_TURN_FAILED", message, null, 500), auth);
  }
}
