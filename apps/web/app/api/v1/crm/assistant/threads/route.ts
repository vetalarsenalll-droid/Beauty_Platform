import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import {
  createCrmAgentThreadGroup,
  getOrCreateCrmAgentThread,
  listCrmAgentThreadGroups,
  listCrmAgentThreads,
} from "@/lib/crm-agent-persistence";

function threadTitle(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : "CRM AI Agent";
}

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("archived") === "1";
  const includeDeleted = url.searchParams.get("deleted") === "1";
  const [threads, groups] = await Promise.all([
    listCrmAgentThreads({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      includeArchived: includeArchived || includeDeleted,
      includeDeleted,
      take: 80,
    }),
    listCrmAgentThreadGroups({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
    }),
  ]);

  const response = jsonOk({
    threads: threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      groupId: thread.groupId,
      archivedAt: thread.archivedAt?.toISOString() ?? null,
      deletedAt: thread.deletedAt?.toISOString() ?? null,
      pinnedAt: thread.pinnedAt?.toISOString() ?? null,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      messageCount: thread._count.messages,
      lastMessage: thread.messages[0]
        ? {
            role: thread.messages[0].role,
            content: thread.messages[0].content,
            createdAt: thread.messages[0].createdAt.toISOString(),
          }
        : null,
    })),
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

  if (body.type === "group") {
    const group = await createCrmAgentThreadGroup({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      title: threadTitle(body.title),
    });
    const response = jsonOk({ id: group.id, title: group.title }, 201);
    return applyCrmAccessCookie(response, auth);
  }

  const thread = await getOrCreateCrmAgentThread({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
  });
  const response = jsonOk(
    {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    },
    201,
  );
  return applyCrmAccessCookie(response, auth);
}
