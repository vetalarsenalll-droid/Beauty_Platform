import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { prisma } from "@/lib/prisma";
import { processUploadedImage } from "@/lib/image-upload-processing";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const MAX_REPLY_PHOTOS = 5;

function parseId(raw: string) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.clients.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const reviewId = parseId(id);
  if (!reviewId) {
    return jsonError("VALIDATION_FAILED", "Некорректный id отзыва.", null, 400);
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, accountId: auth.session.accountId },
    select: { id: true },
  });
  if (!review) {
    return jsonError("NOT_FOUND", "Отзыв не найден.", null, 404);
  }

  const currentCount = await prisma.mediaLink.count({
    where: { entityType: "review.reply.photo", entityId: String(review.id) },
  });
  if (currentCount >= MAX_REPLY_PHOTOS) {
    return jsonError("VALIDATION_FAILED", "К ответу можно прикрепить не больше 5 фото.", null, 400);
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!formData || !(file instanceof File)) {
    return jsonError("INVALID_BODY", "Передайте файл изображения.", null, 400);
  }
  const processed = await processUploadedImage(file);
  if ("error" in processed) return processed.error;
  const { outputBuffer, outputExt, width, height, size } = processed;

  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${outputExt}`;
  const baseDir = path.join(process.cwd(), "public", "uploads", "accounts", String(auth.session.accountId), "review-reply");
  await mkdir(baseDir, { recursive: true });
  await writeFile(path.join(baseDir, fileName), outputBuffer);

  const url = `/uploads/accounts/${auth.session.accountId}/review-reply/${fileName}`;
  const link = await prisma.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.create({
      data: {
        accountId: auth.session.accountId,
        url,
        type: "image",
        width,
        height,
        size,
      },
      select: { id: true, url: true },
    });

    return tx.mediaLink.create({
      data: {
        assetId: asset.id,
        entityType: "review.reply.photo",
        entityId: String(review.id),
        sortOrder: currentCount,
        isCover: currentCount === 0,
      },
      select: { id: true, assetId: true, asset: { select: { url: true } } },
    });
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Добавил фото ответа на отзыв",
    targetType: "review",
    targetId: review.id,
    diffJson: { mediaLinkId: link.id, assetId: link.assetId, url },
  });

  const response = jsonOk({ id: link.id, assetId: link.assetId, url: link.asset.url });
  return applyCrmAccessCookie(response, auth);
}
