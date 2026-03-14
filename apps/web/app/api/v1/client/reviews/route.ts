import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function resolveAccountClient(
  request: Request,
  session: NonNullable<Awaited<ReturnType<typeof getClientSession>>>
) {
  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account")?.trim() || "";
  const target = accountSlug
    ? session.clients.find((item) => item.accountSlug === accountSlug) ?? null
    : null;

  if (!target) return { error: jsonError("ACCOUNT_REQUIRED", "Укажите организацию.", null, 400) };

  return {
    accountSlug: target.accountSlug,
    accountId: target.accountId,
    clientId: target.clientId,
  };
}

export async function GET(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинет.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

  const reviews = await prisma.review.findMany({
    where: { accountId: resolved.accountId, clientId: resolved.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, rating: true, comment: true, createdAt: true },
  });

  return jsonOk({ reviews });
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинет.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

  const body = (await request.json().catch(() => null)) as {
    rating?: number;
    comment?: string;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректные данные.", null, 400);
  }

  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return jsonError("INVALID_RATING", "Оценка должна быть от 1 до 5.", null, 400);
  }

  const comment = String(body.comment ?? "").trim();
  if (comment.length > 1000) {
    return jsonError("COMMENT_TOO_LONG", "Комментарий слишком длинный.", null, 400);
  }

  const existing = await prisma.review.findFirst({
    where: { accountId: resolved.accountId, clientId: resolved.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const review = existing
    ? await prisma.review.update({
        where: { id: existing.id },
        data: { rating, comment: comment || null },
        select: { id: true, rating: true, comment: true, createdAt: true },
      })
    : await prisma.review.create({
        data: {
          accountId: resolved.accountId,
          clientId: resolved.clientId,
          rating,
          comment: comment || null,
        },
        select: { id: true, rating: true, comment: true, createdAt: true },
      });

  return jsonOk({ review });
}
