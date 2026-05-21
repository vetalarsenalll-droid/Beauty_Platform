import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { processUploadedImage } from "@/lib/image-upload-processing";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { removeLocalUploadIfPresent } from "@/lib/local-upload-cleanup";

export const runtime = "nodejs";

const MEDIA_TYPES = {
  logo: "account.logo",
  cover: "account.cover",
  siteCover: "account.site_cover",
} as const;


export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.settings.read");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const typeKey = String(url.searchParams.get("type") ?? "").trim();
  const entityType = MEDIA_TYPES[typeKey as keyof typeof MEDIA_TYPES];

  if (!entityType) {
    return jsonError(
      "VALIDATION_FAILED",
      "Передайте корректный тип изображения.",
      null,
      400
    );
  }

  const items = await prisma.mediaLink.findMany({
    where: {
      entityType,
      entityId: String(auth.session.accountId),
    },
    include: { asset: true },
    orderBy: [{ id: "desc" }],
  });

  const response = jsonOk({
    items: items.map((link) => ({ id: link.id, url: link.asset.url })),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.settings.update");
  if ("response" in auth) return auth.response;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const typeKey = String(formData.get("type") ?? "").trim();
  const entityType = MEDIA_TYPES[typeKey as keyof typeof MEDIA_TYPES];
  const file = formData.get("file");

  if (!entityType || !(file instanceof File)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Передайте файл и тип изображения.",
      null,
      400
    );
  }
  const processed = await processUploadedImage(file);
  if ("error" in processed) return processed.error;
  const { outputBuffer, outputExt, width, height, size } = processed;

  const safeExt = /^[.\w]+$/.test(outputExt) ? outputExt : ".jpg";
  const fileName = `${Date.now()}-${crypto
    .randomBytes(6)
    .toString("hex")}${safeExt}`;
  const baseDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "accounts",
    String(auth.session.accountId),
    typeKey
  );
  await mkdir(baseDir, { recursive: true });
  const filePath = path.join(baseDir, fileName);
  await writeFile(filePath, outputBuffer);
  const url = `/uploads/accounts/${auth.session.accountId}/${typeKey}/${fileName}`;

  const { link, removedUrls } = await prisma.$transaction(async (tx) => {
    const existingLinks = await tx.mediaLink.findMany({
      where: {
        entityType,
        entityId: String(auth.session.accountId),
      },
      include: { asset: true },
    });
    const removedUrls: string[] = [];

    if (typeKey !== "siteCover" && existingLinks.length > 0) {
      const assetIds = existingLinks.map((item) => item.assetId);
      await tx.mediaLink.deleteMany({
        where: { id: { in: existingLinks.map((item) => item.id) } },
      });
      const left = await tx.mediaLink.count({
        where: { assetId: { in: assetIds } },
      });
      if (left === 0) {
        await tx.mediaAsset.deleteMany({ where: { id: { in: assetIds } } });
        removedUrls.push(...existingLinks.map((item) => item.asset.url));
      }
    }

    const created = await tx.mediaAsset.create({
      data: {
        accountId: auth.session.accountId,
        url,
        type: "image",
        width,
        height,
        size,
      },
    });

    const newLink = await tx.mediaLink.create({
      data: {
        assetId: created.id,
        entityType,
        entityId: String(auth.session.accountId),
        sortOrder:
          typeKey === "siteCover"
            ? existingLinks.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1
            : 0,
        isCover: true,
      },
    });

    if (typeKey === "logo" || typeKey === "cover") {
      await tx.accountBranding.upsert({
        where: { accountId: auth.session.accountId },
        create: {
          accountId: auth.session.accountId,
          logoUrl: typeKey === "logo" ? url : null,
          coverUrl: typeKey === "cover" ? url : null,
        },
        update: {
          logoUrl: typeKey === "logo" ? url : undefined,
          coverUrl: typeKey === "cover" ? url : undefined,
        },
      });
    }

    return { link: newLink, removedUrls };
  });

  await Promise.all(removedUrls.map((item) => removeLocalUploadIfPresent(item)));

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил медиа аккаунта",
    targetType: "account",
    targetId: auth.session.accountId,
    diffJson: { mediaLinkId: link.id, url, entityType },
  });

  const response = jsonOk({ id: link.id, url, entityType });
  return applyCrmAccessCookie(response, auth);
}
