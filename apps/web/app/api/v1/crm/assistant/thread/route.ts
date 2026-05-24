import { jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { getOrCreateCurrentCrmAgentThread, listCrmAgentMessages } from "@/lib/crm-agent-persistence";

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.chat");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const rawThreadId = Number(url.searchParams.get("threadId") ?? "");
  const threadId = Number.isInteger(rawThreadId) && rawThreadId > 0 ? rawThreadId : null;
  const thread = await getOrCreateCurrentCrmAgentThread({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    threadId,
    forceNew: url.searchParams.get("new") === "1",
  });

  const messages = await listCrmAgentMessages({
    accountId: auth.session.accountId,
    threadId: thread.id,
    take: 120,
  });

  const response = jsonOk({
    thread: {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
    },
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
  });
  return applyCrmAccessCookie(response, auth);
}
