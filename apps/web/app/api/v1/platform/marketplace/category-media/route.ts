import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import heicConvert from "heic-convert";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const MAX_PIXELS = 20_000_000;

export async function POST(request: Request) {
  const auth = await requirePlatformApiPermission("platform.settings");
  if ("response" in auth) return auth.response;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonError("INVALID_BODY", "Некорректное тело запроса.", null, 400);
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("VALIDATION_FAILED", "Передайте файл изображения.", null, 400);
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
    return jsonError("VALIDATION_FAILED", "Разрешены только изображения.", null, 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonError("VALIDATION_FAILED", "Файл слишком большой. Максимум 10 МБ.", null, 400);
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
      return jsonError("VALIDATION_FAILED", "HEIC не поддерживается. Попробуйте JPG/PNG.", null, 400);
    }
  }

  let image = sharp(inputBuffer, { failOnError: false });
  let metadata;

  try {
    metadata = await image.metadata();
  } catch {
    return jsonError("VALIDATION_FAILED", "Формат изображения не поддерживается.", null, 400);
  }

  if (!metadata.width || !metadata.height) {
    return jsonError("VALIDATION_FAILED", "Не удалось определить параметры изображения.", null, 400);
  }

  if (metadata.width * metadata.height > MAX_PIXELS) {
    return jsonError("VALIDATION_FAILED", "Слишком большое разрешение изображения.", null, 400);
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
    return jsonError("VALIDATION_FAILED", "Изображение слишком большое после сжатия.", null, 400);
  }

  const safeExt = /^[.\w]+$/.test(outputExt) ? outputExt : ".jpg";
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
  const baseDir = path.join(process.cwd(), "public", "uploads", "marketplace", "categories");
  await mkdir(baseDir, { recursive: true });
  const filePath = path.join(baseDir, fileName);
  await writeFile(filePath, outputBuffer);
  const url = `/uploads/marketplace/categories/${fileName}`;

  const asset = await prisma.mediaAsset.create({
    data: {
      accountId: null,
      url,
      type: "image",
    },
  });

  await prisma.mediaLink.create({
    data: {
      assetId: asset.id,
      entityType: "marketplace.category",
      entityId: String(asset.id),
      sortOrder: 0,
      isCover: true,
    },
  });

  const response = jsonOk({ url });
  return applyAccessCookie(response, auth);
}
