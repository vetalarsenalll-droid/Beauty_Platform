import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = new Map(
  process.argv
    .slice(2)
    .map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, "").split("=");
      return [key, rest.join("=") || "true"];
    }),
);

const limit = Math.max(1, Math.min(50, Number(args.get("limit") ?? 10)));
const threadId = Number(args.get("thread") ?? 0);
const actionId = Number(args.get("action") ?? 0);

function maskPiiInString(value) {
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+7|8)[\d\s().-]{8,}\d/g, "[phone]");
}

function maskPii(value) {
  if (typeof value === "string") return maskPiiInString(value);
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(maskPii);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (/email/i.test(key) && typeof item === "string") return [key, "[email]"];
      if (/phone/i.test(key) && typeof item === "string") return [key, "[phone]"];
      if (/clientName|name/i.test(key) && typeof item === "string") return [key, item ? "[name]" : item];
      return [key, maskPii(item)];
    }),
  );
}

function compact(value) {
  return JSON.stringify(maskPii(value ?? null), null, 2);
}

const where = {
  actionType: "public_ai_turn",
  ...(actionId ? { id: actionId } : {}),
  ...(threadId ? { threadId } : {}),
};

try {
  const actions = await prisma.aiAction.findMany({
    where,
    orderBy: { id: "desc" },
    take: limit,
    select: {
      id: true,
      threadId: true,
      status: true,
      createdAt: true,
      payload: true,
      logs: {
        orderBy: { id: "desc" },
        take: 1,
        select: { level: true, message: true, data: true, createdAt: true },
      },
    },
  });

  if (!actions.length) {
    console.log("No Aisha public AI turns found.");
    process.exit(0);
  }

  for (const action of actions) {
    const payload = action.payload && typeof action.payload === "object" ? action.payload : {};
    const debug = payload.debug && typeof payload.debug === "object" ? payload.debug : {};
    const log = action.logs[0] ?? null;
    console.log(`\n# Action ${action.id} thread=${action.threadId ?? "null"} status=${action.status} at=${action.createdAt.toISOString()}`);
    console.log(`route=${payload.route ?? "unknown"} intent=${payload.intent ?? "unknown"} finalRoute=${payload.finalRouteDecision?.route ?? "unknown"}`);
    console.log(`raw=${maskPiiInString(debug.rawMessage ?? payload.message ?? "")}`);
    console.log(`normalized=${maskPiiInString(debug.normalizedMessage ?? payload.messageForRouting ?? "")}`);
    console.log(`nlu=${compact(debug.nluResult ?? { source: payload.nluSource, intent: payload.nluIntent, confidence: payload.intentConfidence })}`);
    console.log(`routeTrace=${compact(debug.routeTrace ?? { initial: payload.initialRouteDecision, final: payload.finalRouteDecision })}`);
    console.log(`draftPatch=${compact(debug.draftPatch ?? log?.data?.draftPatch ?? null)}`);
    console.log(`guards=${compact(debug.guardResults ?? log?.data?.guardResults ?? null)}`);
    console.log(`llmPurposes=${compact(debug.llmPurposes ?? log?.data?.llmPurposes ?? null)}`);
  }
} finally {
  await prisma.$disconnect();
}
