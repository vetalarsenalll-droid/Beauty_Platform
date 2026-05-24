import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createCrmAgentThreadGroup, listCrmAgentThreadGroups } from "@/lib/crm-agent-persistence";

function groupTitle(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : "Группа";
}

export async function GET() {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const groups = await listCrmAgentThreadGroups({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
  });
  const response = jsonOk({
    groups: groups.map((group) => ({
      id: group.id,
      title: group.title,
      sortOrder: group.sortOrder,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    })),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const group = await createCrmAgentThreadGroup({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    title: groupTitle(body.title),
  });
  const response = jsonOk(
    {
      id: group.id,
      title: group.title,
      sortOrder: group.sortOrder,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    },
    201,
  );
  return applyCrmAccessCookie(response, auth);
}
