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

type Params = { params: Promise<{ id: string }> };

const MEDIA_TYPES = {
  service: "service.photo",
  work: "service.work",
} as const;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const MAX_PIXELS = 20_000_000;

function parseServiceId(raw: string) {
  const serviceId = Number(raw);
  if (!Number.isInteger(serviceId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id услуги.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { serviceId };
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.services.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseServiceId(id);
  if ("error" in parsed) return parsed.error;

  const service = await prisma.service.findUnique({
    where: { id: parsed.serviceId },
  });

  if (!service || service.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Услуга не найдена.", null, 404);
  }

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
      "Передайте тип и файл.",
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
      "Размер файла превышает 10 МБ.",
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
      inputBuffer = await convert({
        buffer: inputBuffer,
        format: "JPEG",
        quality: 0.9,
      });
    } catch {
      return jsonError(
        "VALIDATION_FAILED",
        "HEIC не удалось конвертировать. Попробуйте JPG/PNG.",
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
      "Файл изображения не читается.",
      null,
      400
    );
  }

  if (!metadata.width || !metadata.height) {
    return jsonError(
      "VALIDATION_FAILED",
      "Не удалось определить размеры изображения.",
      null,
      400
    );
  }

  if (metadata.width * metadata.height > MAX_PIXELS) {
    return jsonError(
      "VALIDATION_FAILED",
      "Слишком большое изображение.",
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

  const outputIsPng =
    metadata.format === "png" || file.type === "image/png";
  const outputExt = outputIsPng ? ".png" : ".jpg";
  const outputBuffer = outputIsPng
    ? await image.png({ compressionLevel: 8 }).toBuffer()
    : await image.jpeg({ quality: 80, mozjpeg: true }).toBuffer();

  if (outputBuffer.byteLength > MAX_BYTES) {
    return jsonError(
      "VALIDATION_FAILED",
      "Размер файла после сжатия превышает лимит.",
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
    "services",
    String(service.id),
    typeKey
  );
  await mkdir(baseDir, { recursive: true });
  const filePath = path.join(baseDir, fileName);
  await writeFile(filePath, outputBuffer);
  const url = `/uploads/services/${service.id}/${typeKey}/${fileName}`;

  const link = await prisma.$transaction(async (tx) => {
    const existing = await tx.mediaLink.findFirst({
      where: {
        entityType,
        entityId: String(service.id),
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const count = await tx.mediaLink.count({
      where: {
        entityType,
        entityId: String(service.id),
      },
    });
    const nextOrder = existing ? existing.sortOrder + 1 : 0;

    const created = await tx.mediaAsset.create({
      data: {
        accountId: auth.session.accountId,
        url,
        type: "image",
      },
    });

    return tx.mediaLink.create({
      data: {
        assetId: created.id,
        entityType,
        entityId: String(service.id),
        sortOrder: nextOrder,
        isCover: count === 0,
      },
    });
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Загрузил фото услуги",
    targetType: "service",
    targetId: service.id,
    diffJson: { mediaLinkId: link.id, url, entityType },
  });

  const response = jsonOk({
    id: link.id,
    url,
    entityType,
  });
  return applyCrmAccessCookie(response, auth);
}