import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { deleteCrmAgentThreadGroup, updateCrmAgentThreadGroup } from "@/lib/crm-agent-persistence";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseGroupId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const groupId = parseGroupId(id);
  if (!groupId) return jsonError("INVALID_GROUP_ID", "Invalid group id.", null, 400);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const result = await updateCrmAgentThreadGroup({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    groupId,
    title: typeof body.title === "string" ? body.title : undefined,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
  });
  if (!result.count) return jsonError("NOT_FOUND", "Thread group not found.", null, 404);

  const response = jsonOk({ id: groupId, updated: true });
  return applyCrmAccessCookie(response, auth);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const groupId = parseGroupId(id);
  if (!groupId) return jsonError("INVALID_GROUP_ID", "Invalid group id.", null, 400);

  const result = await deleteCrmAgentThreadGroup({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    groupId,
  });
  if (!result.count) return jsonError("NOT_FOUND", "Thread group not found.", null, 404);

  const response = jsonOk({ id: groupId, deleted: true });
  return applyCrmAccessCookie(response, auth);
}
