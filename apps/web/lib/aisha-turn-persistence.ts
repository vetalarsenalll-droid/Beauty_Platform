import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";
import { asText, asThreadId, asThreadKey, getThread, isThreadSecretConfigured, resolveClientForAccount } from "@/lib/aisha-chat-thread";
import { draftView } from "@/lib/aisha-chat-parsers";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ANTI_HALLUCINATION_RULES } from "@/lib/dialog-policy";
import { INTENT_ACTION_MATRIX } from "@/lib/intent-action-matrix";
import type { Action, Body, PreparedPostTurn } from "@/lib/aisha-chat-types";
import type { ChatUi } from "@/lib/booking-flow";

const prismaAny = prisma as any;

export async function preparePostTurn(request: Request): Promise<{ response: Response } | { prepared: PreparedPostTurn }> {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return { response: resolved.response };
  if (!isThreadSecretConfigured()) {
    return { response: jsonError("AI_DISABLED", "AI_THREAD_SECRET is not configured.", null, 503) };
  }

  const limited = enforceRateLimit({
    request,
    scope: `public:ai:chat:post:${resolved.account.id}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (limited) return { response: limited };

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") return { response: jsonError("VALIDATION_FAILED", "Invalid JSON body", null, 400) };

  const message = asText(body.message);
  if (!message) return { response: jsonError("VALIDATION_FAILED", "Field 'message' is required", null, 400) };

  const bodyThreadKey = asThreadKey(body.threadKey);
  const session = await getClientSession();
  const client = await resolveClientForAccount(session, resolved.account, {
    createIfMissing: false,
  });
  const { thread, draft, threadKey: nextThreadKey } = await getThread({
    accountId: resolved.account.id,
    threadId: asThreadId(body.threadId),
    threadKey: bodyThreadKey,
    clientId: client?.clientId ?? null,
    userId: session?.userId ?? null,
  });

  await prisma.aiMessage.create({ data: { threadId: thread.id, role: "user", content: message } });
  const turnAction = await prisma.aiAction.create({
    data: { threadId: thread.id, actionType: "public_ai_turn", payload: { message }, status: "STARTED" },
    select: { id: true },
  });

  return {
    prepared: {
      resolved,
      body,
      message,
      session,
      client,
      thread: { id: thread.id, clientId: thread.clientId ?? null },
      draft,
      nextThreadKey,
      turnAction,
    },
  };
}

export function createFailSoftHandler(args: {
  threadId: number;
  nextThreadKey: string | null;
  draft: any;
  turnActionId: number;
  message: string;
}) {
  return async (errorText?: string) => {
    const reply = "Сейчас не получилось ответить. Попробуйте еще раз.";
    await prisma.aiMessage.create({ data: { threadId: args.threadId, role: "assistant", content: reply } });
    await prisma.aiAction.update({
      where: { id: args.turnActionId },
      data: { status: "FAILED", payload: { message: args.message, error: errorText ?? "unknown_error" } },
    });
    return jsonOk({ threadId: args.threadId, threadKey: args.nextThreadKey, reply, action: null, ui: null, draft: draftView(args.draft) });
  };
}

export async function saveTurn(args: {
  threadId: number;
  turnActionId: number;
  message: string;
  reply: string;
  intent: string;
  route: string;
  nluConfidence: number;
  mappedNluIntent: string;
  nluSource: string;
  nluIntent: string | null;
  nextStatus: string;
  nextAction: Action;
  nextUi: ChatUi | null;
  confirmPendingClientAction: boolean;
  pendingClientActionType: string | null;
  routeReason: string | null;
  guardReason: string | null;
  useNluIntent: boolean;
  messageForRouting: string;
  d: any;
}) {
  await prisma.$transaction([
    prisma.aiMessage.create({ data: { threadId: args.threadId, role: "assistant", content: args.reply } }),
    prismaAny.aiBookingDraft.update({
      where: { threadId: args.threadId },
      data: {
        locationId: args.d.locationId,
        serviceId: args.d.serviceId,
        specialistId: args.d.specialistId,
        date: args.d.date,
        time: args.d.time,
        clientName: args.d.clientName,
        clientPhone: args.d.clientPhone,
        mode: args.d.mode,
        status: args.nextStatus,
        consentConfirmedAt: args.d.consentConfirmedAt ? new Date(args.d.consentConfirmedAt) : null,
      },
    }),
    prisma.aiAction.update({
      where: { id: args.turnActionId },
      data: {
        status: "COMPLETED",
        payload: {
          message: args.message,
          reply: args.reply,
          intent: args.intent,
          route: args.route,
          intentConfidence: args.nluConfidence,
          matrix: INTENT_ACTION_MATRIX[args.intent as keyof typeof INTENT_ACTION_MATRIX],
          antiHallucinationRules: ANTI_HALLUCINATION_RULES,
          nextStatus: args.nextStatus,
          nluSource: args.nluSource,
          nluIntent: args.nluIntent,
          mappedNluIntent: args.mappedNluIntent,
          actionType: args.nextAction?.type ?? null,
          uiKind: args.nextUi?.kind ?? null,
          confirmPendingClientAction: args.confirmPendingClientAction,
          pendingClientActionType: args.pendingClientActionType,
          routeReason: args.routeReason,
          guardReason: args.guardReason,
          messageForRouting: args.messageForRouting,
        },
      },
    }),
    prisma.aiLog.create({
      data: {
        actionId: args.turnActionId,
        level: "info",
        message: "assistant_turn_metrics",
        data: {
          intent: args.intent,
          route: args.route,
          intentConfidence: args.nluConfidence,
          usedFallback: args.nluSource === "fallback",
          usedNluIntent: args.useNluIntent,
          routeReason: args.routeReason,
          guardReason: args.guardReason,
          failedAction: false,
          actionType: args.nextAction?.type ?? null,
        },
      },
    }),
  ]);
}
