import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolvePublicAccount } from "@/lib/public-booking";

const MAX_SESSION_KEY = 128;
const MAX_STEP_KEY = 64;

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const limited = enforceRateLimit({
    request,
    scope: `booking:steps:${resolved.account.id}`,
    limit: 180,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as {
    sessionKey?: string;
    stepKey?: string;
    stepIndex?: number;
    stepTitle?: string | null;
    scenario?: string | null;
    locationId?: number | null;
    serviceId?: number | null;
    specialistId?: number | null;
    date?: string | null;
    time?: string | null;
    payload?: unknown;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);
  }

  const sessionKey = String(body.sessionKey ?? "").trim();
  const stepKey = String(body.stepKey ?? "").trim();
  const stepIndex = Number(body.stepIndex);
  const stepTitle = typeof body.stepTitle === "string" ? body.stepTitle.trim() : null;

  if (!sessionKey || !stepKey || !Number.isFinite(stepIndex)) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  if (sessionKey.length > MAX_SESSION_KEY || stepKey.length > MAX_STEP_KEY) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  const now = new Date();
  const accountId = resolved.account.id;

  const db = prisma as any;
  const session = await db.onlineBookingSession.upsert({
    where: {
      accountId_sessionKey: {
        accountId,
        sessionKey,
      },
    },
    create: {
      accountId,
      sessionKey,
      startedAt: now,
      lastSeenAt: now,
    },
    update: {
      lastSeenAt: now,
    },
    select: { id: true },
  });

  await db.onlineBookingStep.create({
    data: {
      accountId,
      sessionId: session.id,
      stepKey,
      stepIndex: Math.max(0, Math.floor(stepIndex)),
      stepTitle: stepTitle || null,
      scenario: typeof body.scenario === "string" ? body.scenario : null,
      locationId: Number.isInteger(Number(body.locationId)) ? Number(body.locationId) : null,
      serviceId: Number.isInteger(Number(body.serviceId)) ? Number(body.serviceId) : null,
      specialistId: Number.isInteger(Number(body.specialistId)) ? Number(body.specialistId) : null,
      date: typeof body.date === "string" ? body.date : null,
      time: typeof body.time === "string" ? body.time : null,
      payload: body.payload ?? null,
      createdAt: now,
    },
  });

  return jsonOk({ ok: true });
}
