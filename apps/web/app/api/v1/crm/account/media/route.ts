import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import heicConvert from "heic-convert";

export const runtime = "nodejs";

const MEDIA_TYPES = {
  logo: "account.logo",
  cover: "account.cover",
  siteCover: "account.site_cover",
} as const;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const MAX_PIXELS = 20_000_000;

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

  const nameLower = file.name.toLowerCase();
  const ext = path.extname(nameLower);
  const isHeic = file.type === "image/heic" || file.type === "image/heif";
  const isHeicExt = nameLower.endsWith(".heic") || nameLower.endsWith(".heif");
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
  const isImageType =
    file.type.startsWith("image/") ||
    (file.type === "" && allowedExts.includes(ext));

  if (!isImageType && !isHeicExt) {
    return jsonError(
      "VALIDATION_FAILED",
      "Разрешены только изображения.",
      null,
      400
    );
  }

  if (file.size > MAX_BYTES) {
    return jsonError(
      "VALIDATION_FAILED",
      "Файл слишком большой. Максимум 10 МБ.",
      null,
      400
    );
  }

  let inputBuffer = Buffer.from(await file.arrayBuffer());

  if (isHeic || isHeicExt) {
    try {
      const convert = heicConvert as unknown as (args: {
        buffer: Buffer;
        format: "JPEG";
        quality: number;
      }) => Promise<Buffer>;
      const converted = await convert({
        buffer: inputBuffer,
        format: "JPEG",
        quality: 0.9,
      });
      inputBuffer = Buffer.from(converted);
    } catch {
      return jsonError(
        "VALIDATION_FAILED",
        "HEIC не поддерживается. Попробуйте JPG/PNG.",
        null,
        400
      );
    }
  }

  let image = sharp(inputBuffer, { failOnError: false });
  let metadata;

  try {
    metadata = await image.metadata();
  } catch {
    return jsonError(
      "VALIDATION_FAILED",
      "Формат изображения не поддерживается.",
      null,
      400
    );
  }

  if (!metadata.width || !metadata.height) {
    return jsonError(
      "VALIDATION_FAILED",
      "Не удалось определить параметры изображения.",
      null,
      400
    );
  }

  if (metadata.width * metadata.height > MAX_PIXELS) {
    return jsonError(
      "VALIDATION_FAILED",
      "Слишком большое разрешение изображения.",
      null,
      400
    );
  }

  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    image = image.resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
    });
  }

  const outputIsPng = metadata.format === "png" || file.type === "image/png";
  const outputExt = outputIsPng ? ".png" : ".jpg";
  const outputBuffer = outputIsPng
    ? await image.png({ compressionLevel: 8 }).toBuffer()
    : await image.jpeg({ quality: 80, mozjpeg: true }).toBuffer();

  if (outputBuffer.byteLength > MAX_BYTES) {
    return jsonError(
      "VALIDATION_FAILED",
      "Изображение слишком большое после сжатия.",
      null,
      400
    );
  }

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

  const link = await prisma.$transaction(async (tx) => {
    const existingLinks = await tx.mediaLink.findMany({
      where: {
        entityType,
        entityId: String(auth.session.accountId),
      },
    });

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
      }
    }

    const created = await tx.mediaAsset.create({
      data: {
        accountId: auth.session.accountId,
        url,
        type: "image",
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

    return newLink;
  });

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
