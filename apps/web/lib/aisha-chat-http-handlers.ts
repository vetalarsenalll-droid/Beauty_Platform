import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { draftView } from "@/lib/aisha-chat-parsers";
import { asThreadId, asThreadKey, buildThreadKey, canAccessThread, getThread, isThreadSecretConfigured, resolveClientForAccount } from "@/lib/aisha-chat-thread";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";
import { enforceRateLimit } from "@/lib/rate-limit";

const prismaAny = prisma as any;

export async function handlePublicAiChatGet(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  if (!isThreadSecretConfigured()) {
    return jsonError("AI_DISABLED", "AI_THREAD_SECRET is not configured.", null, 503);
  }

  const limited = enforceRateLimit({
    request,
    scope: `public:ai:chat:get:${resolved.account.id}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const threadId = asThreadId(url.searchParams.get("threadId"));
  const threadKey = asThreadKey(url.searchParams.get("threadKey"));
  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account);

  const { thread, draft, threadKey: nextThreadKey } = await getThread({
    accountId: resolved.account.id,
    threadId,
    threadKey,
    clientId: client?.clientId ?? null,
    userId: session?.userId ?? null,
  });

  const messages = await prisma.aiMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { id: "desc" },
    take: 120,
    select: { id: true, role: true, content: true },
  });
  messages.reverse();

  return jsonOk({ threadId: thread.id, threadKey: nextThreadKey, messages, draft: draftView(draft) });
}

export async function handlePublicAiChatDelete(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;
  if (!isThreadSecretConfigured()) {
    return jsonError("AI_DISABLED", "AI_THREAD_SECRET is not configured.", null, 503);
  }

  const limited = enforceRateLimit({
    request,
    scope: `public:ai:chat:delete:${resolved.account.id}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const threadId = asThreadId(url.searchParams.get("threadId"));
  const threadKey = asThreadKey(url.searchParams.get("threadKey"));
  if (!threadId) return jsonError("VALIDATION_FAILED", "threadId is required", null, 400);

  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account);
  const thread = await prisma.aiThread.findFirst({ where: { id: threadId, accountId: resolved.account.id } });

  if (
    !thread ||
    !canAccessThread({
      accountId: resolved.account.id,
      thread,
      threadKey,
      clientId: client?.clientId ?? null,
      userId: session?.userId ?? null,
    })
  ) {
    return jsonError("NOT_FOUND", "Thread not found", null, 404);
  }

  const newThread = await prisma.aiThread.create({
    data: {
      accountId: resolved.account.id,
      clientId: client?.clientId ?? thread.clientId ?? null,
      userId: session?.userId ?? thread.userId ?? null,
      title: thread.title ?? null,
    },
  });

  await prismaAny.aiBookingDraft.upsert({
    where: { threadId: newThread.id },
    create: { threadId: newThread.id, status: "COLLECTING" },
    update: {},
  });

  return jsonOk({ ok: true, threadId: newThread.id, threadKey: buildThreadKey(resolved.account.id, newThread.id) });
}

