import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import heicConvert from "heic-convert";
import sharp from "sharp";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const MAX_PIXELS = 20_000_000;
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

  const nameLower = file.name.toLowerCase();
  const ext = path.extname(nameLower);
  const isHeic = file.type === "image/heic" || file.type === "image/heif";
  const isHeicExt = nameLower.endsWith(".heic") || nameLower.endsWith(".heif");
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
  const isImageType = file.type.startsWith("image/") || (file.type === "" && allowedExts.includes(ext));

  if (!isImageType && !isHeicExt) {
    return jsonError("VALIDATION_FAILED", "Поддерживаются только изображения.", null, 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonError("VALIDATION_FAILED", "Размер файла превышает 10 МБ.", null, 400);
  }

  let inputBuffer = Buffer.from(await file.arrayBuffer());

  if (isHeic || isHeicExt) {
    try {
      const convert = heicConvert as unknown as (args: {
        buffer: Buffer;
        format: "JPEG";
        quality: number;
      }) => Promise<Buffer>;
      inputBuffer = Buffer.from(await convert({ buffer: inputBuffer, format: "JPEG", quality: 0.9 }));
    } catch {
      return jsonError("VALIDATION_FAILED", "HEIC не удалось конвертировать. Загрузите JPG/PNG.", null, 400);
    }
  }

  let image = sharp(inputBuffer, { failOnError: false });
  const metadata = await image.metadata().catch(() => null);
  if (!metadata?.width || !metadata.height) {
    return jsonError("VALIDATION_FAILED", "Формат изображения не поддерживается.", null, 400);
  }

  if (metadata.width * metadata.height > MAX_PIXELS) {
    return jsonError("VALIDATION_FAILED", "Слишком большое разрешение изображения.", null, 400);
  }

  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    image = image.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside" });
  }

  const outputIsPng = metadata.format === "png" || file.type === "image/png";
  const outputExt = outputIsPng ? ".png" : ".jpg";
  const outputBuffer = outputIsPng
    ? await image.png({ compressionLevel: 8 }).toBuffer()
    : await image.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const outputMetadata = await sharp(outputBuffer, { failOnError: false }).metadata();

  if (outputBuffer.byteLength > MAX_BYTES) {
    return jsonError("VALIDATION_FAILED", "Сжатое изображение все еще слишком большое.", null, 400);
  }

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
        width: outputMetadata.width ?? metadata.width,
        height: outputMetadata.height ?? metadata.height,
        size: outputBuffer.byteLength,
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
