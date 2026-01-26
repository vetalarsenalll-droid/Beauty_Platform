import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string; linkId: string }> };

function parseId(raw: string) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.specialists.update");
  if ("response" in auth) return auth.response;

  const { id, linkId } = await params;
  const specialistId = parseId(id);
  const mediaLinkId = parseId(linkId);

  if (!specialistId || !mediaLinkId) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный идентификатор.",
      null,
      400
    );
  }

  const link = await prisma.mediaLink.findUnique({
    where: { id: mediaLinkId },
    include: { asset: true },
  });

  if (
    !link ||
    link.entityId !== String(specialistId) ||
    link.asset.accountId !== auth.session.accountId
  ) {
    return jsonError("NOT_FOUND", "Фото не найдено.", null, 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.mediaLink.delete({ where: { id: link.id } });
    const linksLeft = await tx.mediaLink.count({
      where: { assetId: link.assetId },
    });
    if (linksLeft === 0) {
      await tx.mediaAsset.delete({ where: { id: link.assetId } });
    }
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удалил фото специалиста",
    targetType: "specialist",
    targetId: specialistId,
    diffJson: { mediaLinkId },
  });

  const response = jsonOk({ id: mediaLinkId });
  return applyCrmAccessCookie(response, auth);
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.specialists.update");
  if ("response" in auth) return auth.response;

  const { id, linkId } = await params;
  const specialistId = parseId(id);
  const mediaLinkId = parseId(linkId);

  if (!specialistId || !mediaLinkId) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный идентификатор.",
      null,
      400
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const sortOrder =
    body.sortOrder !== undefined ? Number(body.sortOrder) : undefined;
  const isCover =
    body.isCover !== undefined ? Boolean(body.isCover) : undefined;

  if (
    (sortOrder !== undefined && Number.isNaN(sortOrder)) ||
    (sortOrder !== undefined && sortOrder < 0)
  ) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный порядок.",
      null,
      400
    );
  }

  const link = await prisma.mediaLink.findUnique({
    where: { id: mediaLinkId },
    include: { asset: true },
  });

  if (
    !link ||
    link.entityId !== String(specialistId) ||
    link.asset.accountId !== auth.session.accountId
  ) {
    return jsonError("NOT_FOUND", "Фото не найдено.", null, 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (isCover === true) {
      await tx.mediaLink.updateMany({
        where: {
          entityType: link.entityType,
          entityId: link.entityId,
          isCover: true,
        },
        data: { isCover: false },
      });
    }
    return tx.mediaLink.update({
      where: { id: link.id },
      data: {
        sortOrder: sortOrder ?? undefined,
        isCover: isCover ?? undefined,
      },
    });
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил фото специалиста",
    targetType: "specialist",
    targetId: specialistId,
    diffJson: {
      mediaLinkId,
      sortOrder: sortOrder ?? undefined,
      isCover: isCover ?? undefined,
    },
  });

  const response = jsonOk({
    id: updated.id,
    sortOrder: updated.sortOrder,
    isCover: updated.isCover,
  });
  return applyCrmAccessCookie(response, auth);
}