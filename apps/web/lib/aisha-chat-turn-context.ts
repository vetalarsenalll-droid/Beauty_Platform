import { runAishaNlu } from "@/lib/aisha-orchestrator";
import { getNowInTimeZone } from "@/lib/public-booking";
import { asTimeZone } from "@/lib/aisha-chat-thread";
import { draftView, normalizeSystemTypos } from "@/lib/aisha-chat-parsers";
import { loadPublicAiChatContext } from "@/lib/aisha-chat-preload";
import { buildIntentContext } from "@/lib/aisha-chat-intent-context";
import { prisma } from "@/lib/prisma";
import type { TurnContext } from "@/lib/aisha-chat-types";

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s:.+\-/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export async function buildTurnContext(args: {
  threadId: number;
  message: string;
  body: { clientTodayYmd?: unknown; clientTimeZone?: unknown };
  account: { id: number; slug: string; timeZone: string };
  draft: any;
}): Promise<TurnContext> {
  const { threadId, message, body, account, draft } = args;

  const recentMessages = await prisma.aiMessage.findMany({
    where: { threadId },
    orderBy: { id: "desc" },
    take: 40,
    select: { role: true, content: true },
  });

  const { locations, services, specialists, requiredVersionIds, accountProfile, customPrompt } = await loadPublicAiChatContext(account.id);

  const serverNowYmd = getNowInTimeZone(account.timeZone).ymd;
  const clientTimeZone = asTimeZone(body.clientTimeZone);
  // Booking availability should always anchor to account timezone day.
  // Client-provided today can drift and cause AI/online mismatch around day boundaries.
  const nowYmd = serverNowYmd;


  const nowInDialogTz = getNowInTimeZone(clientTimeZone ?? account.timeZone);
  const nowHm = `${String(Math.floor(nowInDialogTz.minutes / 60)).padStart(2, "0")}:${String(nowInDialogTz.minutes % 60).padStart(2, "0")}`;

  const messageForRouting = normalizeSystemTypos(message);
  const d = draftView(draft);
  const t = norm(messageForRouting);

  const nluResult = await runAishaNlu({
    message: messageForRouting,
    nowYmd,
    draft: d,
    account,
    clientTimeZone: clientTimeZone ?? null,
    accountProfile,
    locations,
    services,
    specialists,
    recentMessages: [...recentMessages].reverse(),
    systemPrompt: customPrompt,
  });

  const intentContext = buildIntentContext({
    message: messageForRouting,
    t,
    d,
    nowYmd,
    recentMessages: [...recentMessages].reverse(),
    nluResult,
    locations,
    services,
    specialists,
  });

  return {
    recentMessages,
    locations,
    services,
    specialists,
    requiredVersionIds,
    accountProfile,
    customPrompt,
    nowYmd,
    nowHm,
    clientTimeZone,
    t,
    d,
    nluResult,
    intentContext,
  };
}

