import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolvePublicAccount } from "@/lib/public-booking";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const limited = enforceRateLimit({
    request,
    scope: `booking:group-sessions:${resolved.account.id}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) {
    return jsonError("INVALID_SESSION", "Некорректный сеанс.", null, 400);
  }

  const body = (await request.json().catch(() => null)) as {
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    legalVersionIds?: number[];
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);
  }

  const clientName = String(body.clientName ?? "").trim();
  const clientPhoneRaw = String(body.clientPhone ?? "").trim();
  const clientPhone = normalizeRuPhone(clientPhoneRaw);
  const clientEmail = String(body.clientEmail ?? "").trim();

  if (clientName.length < 2 || !clientPhone) {
    return jsonError("CLIENT_REQUIRED", "Укажите корректные имя и телефон клиента.", null, 400);
  }

  const legalVersionIds = Array.isArray(body.legalVersionIds)
    ? body.legalVersionIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  const requestedLegalVersionIds = Array.from(new Set(legalVersionIds)).sort((a, b) => a - b);

  const result = await prisma.$transaction(async (tx) => {
    const groupSession = await tx.groupSession.findFirst({
      where: { id: sessionId, accountId: resolved.account.id, status: { not: "CANCELLED" } },
    });
    if (!groupSession) return { error: "NOT_FOUND" as const };
    if (groupSession.bookedCount >= groupSession.capacity) return { error: "SESSION_FULL" as const };

    const clientByPhone = clientPhone
      ? await tx.client.findFirst({
          where: { accountId: resolved.account.id, phone: clientPhone },
        })
      : null;
    const clientByEmail = clientEmail
      ? await tx.client.findFirst({
          where: { accountId: resolved.account.id, email: clientEmail },
        })
      : null;
    if (clientByPhone && clientByEmail && clientByPhone.id !== clientByEmail.id) {
      return { error: "CLIENT_CONFLICT" as const };
    }
    let client = clientByPhone ?? clientByEmail;
    if (!client) {
      client = await tx.client.create({
        data: {
          accountId: resolved.account.id,
          firstName: clientName || null,
          phone: clientPhone || null,
          email: clientEmail || null,
        },
      });
    } else {
      client = await tx.client.update({
        where: { id: client.id },
        data: {
          firstName: client.firstName ?? (clientName || null),
          phone: client.phone ?? (clientPhone || null),
          email: client.email ?? (clientEmail || null),
        },
      });
    }

    const existing = await tx.groupSessionParticipant.findFirst({
      where: { groupSessionId: groupSession.id, clientId: client.id },
    });
    if (existing) return { error: "ALREADY_EXISTS" as const };

    const participant = await tx.groupSessionParticipant.create({
      data: {
        groupSessionId: groupSession.id,
        clientId: client.id,
        status: "NEW",
        price: groupSession.pricePerClient ?? null,
      },
    });

    await tx.groupSession.update({
      where: { id: groupSession.id },
      data: { bookedCount: groupSession.bookedCount + 1 },
    });

    if (requestedLegalVersionIds.length) {
      await tx.legalAcceptance.createMany({
        data: requestedLegalVersionIds.map((v) => ({
          accountId: resolved.account.id,
          documentVersionId: v,
          clientId: client.id,
          source: "public_booking_group",
        })),
      });
    }

    return { participantId: participant.id };
  });

  if ("error" in result) {
    const map: Record<string, { code: string; message: string; status: number }> = {
      NOT_FOUND: { code: "NOT_FOUND", message: "Сеанс не найден.", status: 404 },
      SESSION_FULL: { code: "SESSION_FULL", message: "Все места уже заняты.", status: 409 },
      CLIENT_CONFLICT: { code: "CLIENT_CONFLICT", message: "Указаны разные клиенты по телефону и email.", status: 409 },
      ALREADY_EXISTS: { code: "ALREADY_EXISTS", message: "Вы уже записаны на этот сеанс.", status: 409 },
    };
    const info = map[result.error] ?? { code: "ERROR", message: "Не удалось записаться.", status: 400 };
    return jsonError(info.code, info.message, null, info.status);
  }

  return jsonOk({ participantId: result.participantId });
}
