import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { asText, asThreadId, asThreadKey, asTimeZone, asYmd, getThread, isThreadSecretConfigured, resolveClientForAccount } from "@/lib/aisha-chat-thread";
import { draftView } from "@/lib/aisha-chat-parsers";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ANTI_HALLUCINATION_RULES } from "@/lib/dialog-policy";
import { INTENT_ACTION_MATRIX } from "@/lib/intent-action-matrix";
import type { Action, Body, PreparedPostTurn, TurnDebugTrace, TurnRouteTrace } from "@/lib/aisha-chat-types";
import type { ChatUi } from "@/lib/booking-flow";
import type { DraftLike } from "@/lib/booking-tools";

const asIdempotencyKey = (v: unknown) => {
  if (typeof v !== "string") return "";
  const trimmed = v.trim();
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : "";
};

function maskPiiInString(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+7|8)[\d\s().-]{8,}\d/g, "[phone]");
}

function maskPii<T>(value: T): T {
  if (typeof value === "string") return maskPiiInString(value) as T;
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => maskPii(item)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/email/i.test(key)) {
      out[key] = typeof item === "string" && item ? "[email]" : item;
    } else if (/phone/i.test(key)) {
      out[key] = typeof item === "string" && item ? "[phone]" : item;
    } else if (/clientName|name/i.test(key) && typeof item === "string") {
      out[key] = item.length ? "[name]" : item;
    } else {
      out[key] = maskPii(item);
    }
  }
  return out as T;
}

function sanitizeDraftForDebug(draft: unknown) {
  return maskPii(draft ?? null);
}

function draftPatch(before: unknown, after: unknown) {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  const patch: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    const beforeValue = b[key] ?? null;
    const afterValue = a[key] ?? null;
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      patch[key] = { before: maskPii(beforeValue), after: maskPii(afterValue) };
    }
  }
  return patch;
}

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
  const rawIdempotencyKey =
    request.headers.get("idempotency-key") ??
    request.headers.get("Idempotency-Key") ??
    body.clientRequestId;
  const idempotencyKey = asIdempotencyKey(rawIdempotencyKey);
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

  let idempotencyRecordId: number | null = null;
  if (idempotencyKey) {
    const scopedKey = `public-ai-chat:${thread.id}:${idempotencyKey}`;
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          threadId: thread.id,
          message,
          clientTodayYmd: asYmd(body.clientTodayYmd),
          clientTimeZone: asTimeZone(body.clientTimeZone),
        }),
      )
      .digest("hex");

    try {
      const created = await prisma.idempotencyKey.create({
        data: { accountId: resolved.account.id, key: scopedKey, requestHash, status: "PROCESSING" },
        select: { id: true },
      });
      idempotencyRecordId = created.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.idempotencyKey.findUnique({
          where: { accountId_key: { accountId: resolved.account.id, key: scopedKey } },
        });
        if (!existing) return { response: jsonError("IDEMPOTENCY_CONFLICT", "Idempotency conflict", null, 409) };
        if (existing.requestHash !== requestHash) {
          return { response: jsonError("IDEMPOTENCY_CONFLICT", "Different request with the same idempotency key", null, 409) };
        }
        if ((existing.status === "COMPLETED" || existing.status === "FAILED") && existing.response) {
          return { response: jsonOk(existing.response) };
        }
        return { response: jsonError("AI_TURN_IN_PROGRESS", "AI turn is already processing", null, 409) };
      }
      throw error;
    }
  }

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
      idempotencyRecordId,
    },
  };
}

export function createFailSoftHandler(args: {
  threadId: number;
  nextThreadKey: string | null;
  draft: Parameters<typeof draftView>[0];
  turnActionId: number;
  message: string;
  idempotencyRecordId?: number | null;
}) {
  return async (errorText?: string) => {
    const reply = "Сейчас не получилось ответить. Попробуйте еще раз.";
    const responsePayload = { threadId: args.threadId, threadKey: args.nextThreadKey, reply, action: null, ui: null, draft: draftView(args.draft) };
    const writes: Prisma.PrismaPromise<unknown>[] = [
      prisma.aiMessage.create({ data: { threadId: args.threadId, role: "assistant", content: reply } }),
      prisma.aiAction.update({
        where: { id: args.turnActionId },
        data: {
          status: "FAILED",
          payload: {
            message: maskPii(args.message),
            error: errorText ?? "unknown_error",
            debug: {
              rawMessage: maskPii(args.message),
              error: errorText ?? "unknown_error",
            },
          },
        },
      }),
      prisma.aiLog.create({
        data: {
          actionId: args.turnActionId,
          level: "error",
          message: "assistant_turn_failed",
          data: {
            rawMessage: maskPii(args.message),
            error: errorText ?? "unknown_error",
            failedAction: true,
          },
        },
      }),
    ];
    if (args.idempotencyRecordId) {
      writes.push(
        prisma.idempotencyKey.update({
          where: { id: args.idempotencyRecordId },
          data: { status: "FAILED", response: responsePayload },
        }),
      );
    }
    await prisma.$transaction(writes);
    return jsonOk(responsePayload);
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
  d: DraftLike;
  idempotencyRecordId?: number | null;
  responsePayload?: unknown;
  routeTrace?: TurnRouteTrace;
  debugTrace?: TurnDebugTrace;
}) {
  const finalRouteDecision = args.routeTrace?.finalRouteDecision ?? null;
  const draftBefore = args.debugTrace?.draftBefore ?? null;
  const draftAfter = args.d;
  const llmUsages = await prisma.aiUsage.findMany({
    where: { actionId: args.turnActionId },
    select: { purpose: true, provider: true, model: true, promptTokens: true, completionTokens: true, totalTokens: true },
    orderBy: { id: "asc" },
  });
  const debugData = {
    rawMessage: maskPii(args.debugTrace?.rawMessage ?? args.message),
    normalizedMessage: maskPii(args.debugTrace?.normalizedMessage ?? args.messageForRouting),
    nluResult: maskPii(args.debugTrace?.nluResult ?? { source: args.nluSource, intent: args.nluIntent, confidence: args.nluConfidence }),
    extractedEntities: maskPii((args.debugTrace?.nluResult as { nlu?: unknown } | undefined)?.nlu ?? null),
    draftBefore: sanitizeDraftForDebug(draftBefore),
    draftAfter: sanitizeDraftForDebug(draftAfter),
    draftPatch: draftPatch(draftBefore, draftAfter),
    guardResults: args.debugTrace?.guardResults ?? [{ reason: args.guardReason }],
    routeTrace: args.routeTrace ?? null,
    llmPurposes: llmUsages.map((usage) => ({
      purpose: usage.purpose,
      provider: usage.provider,
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    })),
  };
  await prisma.$transaction(async (tx) => {
    await tx.aiMessage.create({ data: { threadId: args.threadId, role: "assistant", content: args.reply } });
    const draftWrite = await tx.aiBookingDraft.updateMany({
      where: { threadId: args.threadId, version: args.d.version ?? 0 },
      data: {
          locationId: args.d.locationId,
          serviceId: args.d.serviceId,
          serviceIds: Array.isArray(args.d.serviceIds) ? args.d.serviceIds : [],
          specialistId: args.d.specialistId,
          bookingAttemptKey: args.d.bookingAttemptKey ?? null,
          completedAppointmentId: args.d.completedAppointmentId ?? null,
          completedAt: args.d.completedAt ? new Date(args.d.completedAt) : null,
          date: args.d.date,
          time: args.d.time,
          clientName: args.d.clientName,
          clientPhone: args.d.clientPhone,
          clientEmail: args.d.clientEmail,
          planJson: Array.isArray(args.d.planJson) ? args.d.planJson : [],
          bookingMode: args.d.bookingMode ?? null,
          mode: args.d.mode,
          status: args.nextStatus,
          consentConfirmedAt: args.d.consentConfirmedAt ? new Date(args.d.consentConfirmedAt) : null,
          version: { increment: 1 },
        },
      });
    if (draftWrite.count !== 1) {
      throw new Error("AI_DRAFT_VERSION_CONFLICT");
    }
    const actionPayload = {
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
      initialRouteDecision: args.routeTrace?.initialRouteDecision ?? null,
      finalRouteDecision,
      shouldRunBookingFlow: args.routeTrace?.shouldRunBookingFlow ?? null,
      messageForRouting: args.messageForRouting,
      debug: debugData,
    } as Prisma.InputJsonValue;
    await tx.aiAction.update({
      where: { id: args.turnActionId },
      data: {
        status: "COMPLETED",
        payload: actionPayload,
      },
    });
    const logData = {
      intent: args.intent,
      route: args.route,
      intentConfidence: args.nluConfidence,
      usedFallback: args.nluSource === "fallback",
      usedNluIntent: args.useNluIntent,
      routeReason: args.routeReason,
      guardReason: args.guardReason,
      finalRoute: finalRouteDecision?.route ?? args.route,
      finalIntent: finalRouteDecision?.intent ?? args.intent,
      finalRouteReason: finalRouteDecision?.reason ?? args.routeReason,
      rawMessage: debugData.rawMessage,
      normalizedMessage: debugData.normalizedMessage,
      nluResult: debugData.nluResult,
      extractedEntities: debugData.extractedEntities,
      draftPatch: debugData.draftPatch,
      guardResults: debugData.guardResults,
      llmPurposes: debugData.llmPurposes,
      failedAction: false,
      actionType: args.nextAction?.type ?? null,
    } as Prisma.InputJsonValue;
    await tx.aiLog.create({
      data: {
        actionId: args.turnActionId,
        level: "info",
        message: "assistant_turn_metrics",
        data: logData,
      },
    });
    if (args.idempotencyRecordId && args.responsePayload) {
      await tx.idempotencyKey.update({
        where: { id: args.idempotencyRecordId },
        data: { status: "COMPLETED", response: args.responsePayload as Prisma.InputJsonValue },
      });
    }
  });
}
