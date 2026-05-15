import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { prisma } from "@/lib/prisma";
import { unlink } from "node:fs/promises";
import path from "node:path";

type Params = { params: Promise<{ id: string; assetId: string }> };

function parseId(raw: string) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.clients.update");
  if ("response" in auth) return auth.response;

  const { id, assetId } = await params;
  const reviewId = parseId(id);
  const parsedAssetId = parseId(assetId);

  if (!reviewId || !parsedAssetId) {
    return jsonError("VALIDATION_FAILED", "Некорректный идентификатор.", null, 400);
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, accountId: auth.session.accountId },
    select: { id: true },
  });
  if (!review) {
    return jsonError("NOT_FOUND", "Отзыв не найден.", null, 404);
  }

  const link = await prisma.mediaLink.findFirst({
    where: {
      assetId: parsedAssetId,
      entityType: "review.reply.photo",
      entityId: String(review.id),
      asset: { accountId: auth.session.accountId },
    },
    include: { asset: true },
  });

  if (!link) {
    return jsonError("NOT_FOUND", "Фото ответа не найдено.", null, 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.mediaLink.delete({ where: { id: link.id } });
    const linksLeft = await tx.mediaLink.count({ where: { assetId: link.assetId } });
    if (linksLeft === 0) {
      await tx.mediaAsset.delete({ where: { id: link.assetId } });
    }
  });

  const rel = link.asset.url.replace(/^\//, "");
  const candidate = path.join(process.cwd(), "public", rel);
  const uploadsRoot = path.join(process.cwd(), "public", "uploads") + path.sep;
  const resolvedPath = path.resolve(candidate);
  if (resolvedPath.startsWith(path.resolve(uploadsRoot))) {
    await unlink(resolvedPath).catch(() => undefined);
  }

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удалил фото ответа на отзыв",
    targetType: "review",
    targetId: review.id,
    diffJson: { mediaLinkId: link.id, assetId: link.assetId },
  });

  const response = jsonOk({ id: link.id, assetId: link.assetId });
  return applyCrmAccessCookie(response, auth);
}
