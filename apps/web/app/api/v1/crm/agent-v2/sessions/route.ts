import { jsonError, jsonOk } from "@/lib/api";
import { createCrmAgentSession } from "@/lib/crm-agent-v2/core/persistence";
import { prisma } from "@/lib/prisma";
import { parsePagination, requireCrmAgentApi, withCrmAgentAuthCookie } from "../_shared";

export async function GET(request: Request) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;

  const { take, skip, url } = parsePagination(request);
  const status = url.searchParams.get("status") ?? undefined;
  const sessions = await prisma.crmAgentSession.findMany({
    where: {
      accountId: auth.session.accountId,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    skip,
    take,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      states: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });

  return withCrmAgentAuthCookie(
    jsonOk({
      sessions: sessions.map((session) => ({
        id: session.id,
        status: session.status,
        mode: session.mode,
        title: session.title,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        latestMessage: session.messages[0] ?? null,
        latestState: session.states[0] ?? null,
      })),
      pagination: { take, skip },
    }),
    auth,
  );
}

export async function POST(request: Request) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const title = body && typeof (body as { title?: unknown }).title === "string" ? (body as { title: string }).title.trim() : null;
  const mode = body && typeof (body as { mode?: unknown }).mode === "string" ? (body as { mode: string }).mode.trim() : "chat";
  const session = await createCrmAgentSession({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    mode: mode || "chat",
    title: title || null,
  });

  return withCrmAgentAuthCookie(jsonOk(session, 201), auth);
}
