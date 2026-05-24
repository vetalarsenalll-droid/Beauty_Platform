import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { deleteCrmAgentThread, updateCrmAgentThread } from "@/lib/crm-agent-persistence";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseThreadId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const threadId = parseThreadId(id);
  if (!threadId) return jsonError("INVALID_THREAD_ID", "Invalid thread id.", null, 400);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const result = await updateCrmAgentThread({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    threadId,
    title: typeof body.title === "string" ? body.title : undefined,
    groupId: body.groupId === null || typeof body.groupId === "number" ? body.groupId : undefined,
    archived: typeof body.archived === "boolean" ? body.archived : undefined,
    pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
    deleted: typeof body.deleted === "boolean" ? body.deleted : undefined,
  });
  if (!result.count) return jsonError("NOT_FOUND", "Thread not found.", null, 404);

  const response = jsonOk({ id: threadId, updated: true });
  return applyCrmAccessCookie(response, auth);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const threadId = parseThreadId(id);
  if (!threadId) return jsonError("INVALID_THREAD_ID", "Invalid thread id.", null, 400);

  const result = await deleteCrmAgentThread({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    threadId,
  });
  if (!result.count) return jsonError("NOT_FOUND", "Thread not found.", null, 404);

  const response = jsonOk({ id: threadId, deleted: true });
  return applyCrmAccessCookie(response, auth);
}
