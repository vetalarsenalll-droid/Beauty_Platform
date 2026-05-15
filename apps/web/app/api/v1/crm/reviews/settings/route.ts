import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function readWords(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))).slice(0, 100);
  }
  if (typeof value === "string") {
    return Array.from(new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))).slice(0, 100);
  }
  return [];
}

export async function PATCH(request: Request) {
  const auth = await requireCrmApiPermission("crm.settings.update");
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);
  }

  const mode = String(body.reviewModerationMode ?? "auto");
  const safeMode = ["auto", "publish", "all", "words"].includes(mode) ? mode : "auto";
  const rawMinRating = body.reviewModerationMinRating;
  const parsedMinRating =
    rawMinRating === null || rawMinRating === "" || rawMinRating === undefined ? null : Number(rawMinRating);
  const safeMinRating =
    parsedMinRating !== null && Number.isInteger(parsedMinRating) && parsedMinRating >= 1 && parsedMinRating <= 5
      ? parsedMinRating
      : null;
  const words = readWords(body.reviewModerationWords);

  const updated = await prisma.accountSetting.upsert({
    where: { accountId: auth.session.accountId },
    create: {
      accountId: auth.session.accountId,
      reviewAutoPublish: Boolean(body.reviewAutoPublish),
      reviewAllowReplies: Boolean(body.reviewAllowReplies),
      reviewModerationMode: safeMode,
      reviewModerationWords: words as Prisma.InputJsonValue,
      reviewModerationMinRating: safeMinRating,
    },
    update: {
      reviewAutoPublish: Boolean(body.reviewAutoPublish),
      reviewAllowReplies: Boolean(body.reviewAllowReplies),
      reviewModerationMode: safeMode,
      reviewModerationWords: words as Prisma.InputJsonValue,
      reviewModerationMinRating: safeMinRating,
    },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил настройки отзывов",
    targetType: "review-settings",
    targetId: auth.session.accountId,
    diffJson: { reviewModerationMode: safeMode, reviewModerationMinRating: safeMinRating, wordsCount: words.length },
  });

  const response = jsonOk({
    reviewAutoPublish: updated.reviewAutoPublish,
    reviewAllowReplies: updated.reviewAllowReplies,
    reviewModerationMode: updated.reviewModerationMode,
    reviewModerationWords: words,
    reviewModerationMinRating: updated.reviewModerationMinRating,
  });
  return applyCrmAccessCookie(response, auth);
}
