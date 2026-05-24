import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createPendingAction, listPendingActions } from "@/lib/crm-agent-persistence";

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.actions.confirm");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const rawThreadId = Number(url.searchParams.get("threadId") ?? "");
  const threadId = Number.isInteger(rawThreadId) && rawThreadId > 0 ? rawThreadId : null;
  const actions = await listPendingActions({
    accountId: auth.session.accountId,
    threadId,
    take: 50,
  });

  const response = jsonOk({
    actions: actions.map((action) => ({
      id: action.id,
      threadId: action.threadId,
      actionType: action.actionType,
      summary: action.summary,
      status: action.status,
      riskLevel: action.riskLevel,
      permission: action.permission,
      payload: action.payload,
      expiresAt: action.expiresAt.toISOString(),
      createdAt: action.createdAt.toISOString(),
    })),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.actions.confirm");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const actionType = typeof body.actionType === "string" ? body.actionType.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (!actionType || !summary) {
    return jsonError("VALIDATION_FAILED", "actionType and summary are required.", null, 400);
  }

  const action = await createPendingAction({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    threadId: typeof body.threadId === "number" ? body.threadId : null,
    actionType,
    summary,
    payload: (body.payload ?? {}) as Prisma.InputJsonValue,
    riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : "medium",
    permission: typeof body.permission === "string" ? body.permission : null,
  });

  const response = jsonOk(
    {
      id: action.id,
      actionType: action.actionType,
      status: action.status,
      expiresAt: action.expiresAt.toISOString(),
    },
    201,
  );
  return applyCrmAccessCookie(response, auth);
}
