import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ linkId: string }> };

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.settings.update");
  if ("response" in auth) return auth.response;

  const { linkId } = await params;
  const mediaLinkId = parseId(linkId);

  if (!mediaLinkId) {
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
    link.entityId !== String(auth.session.accountId) ||
    !link.entityType.startsWith("account.") ||
    link.asset.accountId !== auth.session.accountId
  ) {
    return jsonError("NOT_FOUND", "Изображение не найдено.", null, 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.mediaLink.delete({ where: { id: link.id } });
    const left = await tx.mediaLink.count({
      where: { assetId: link.assetId },
    });
    if (left === 0) {
      await tx.mediaAsset.delete({ where: { id: link.assetId } });
    }

    if (link.entityType === "account.logo" || link.entityType === "account.cover") {
      await tx.accountBranding.updateMany({
        where: { accountId: auth.session.accountId },
        data:
          link.entityType === "account.logo"
            ? { logoUrl: null }
            : { coverUrl: null },
      });
    }
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удалил медиа аккаунта",
    targetType: "account",
    targetId: auth.session.accountId,
    diffJson: { mediaLinkId, entityType: link.entityType },
  });

  const response = jsonOk({ id: mediaLinkId });
  return applyCrmAccessCookie(response, auth);
}
