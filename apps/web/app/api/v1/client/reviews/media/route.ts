import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import heicConvert from "heic-convert";
import sharp from "sharp";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2560;
const MAX_PIXELS = 20_000_000;

function parseId(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveAccountClient(
  request: Request,
  session: NonNullable<Awaited<ReturnType<typeof getClientSession>>>
) {
  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account")?.trim() || "";
  const target = accountSlug
    ? session.clients.find((item) => item.accountSlug === accountSlug) ?? null
    : null;

  if (!target) return { error: jsonError("ACCOUNT_REQUIRED", "Укажите организацию.", null, 400) };

  return {
    accountSlug: target.accountSlug,
    accountId: target.accountId,
    clientId: target.clientId,
  };
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинет.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

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
      inputBuffer = Buffer.from(await convert({ buffer: inputBuffer, format: "JPEG", quality: 0.9 }));
    } catch {
      return jsonError("VALIDATION_FAILED", "HEIC не поддерживается. Попробуйте JPG/PNG.", null, 400);
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

  if (outputBuffer.byteLength > MAX_BYTES) {
    return jsonError("VALIDATION_FAILED", "Изображение слишком большое после сжатия.", null, 400);
  }

  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${outputExt}`;
  const baseDir = path.join(process.cwd(), "public", "uploads", "accounts", String(resolved.accountId), "review");
  await mkdir(baseDir, { recursive: true });
  await writeFile(path.join(baseDir, fileName), outputBuffer);

  const url = `/uploads/accounts/${resolved.accountId}/review/${fileName}`;
  const asset = await prisma.mediaAsset.create({
    data: {
      accountId: resolved.accountId,
      url,
      type: "image",
      width: metadata.width,
      height: metadata.height,
      size: outputBuffer.byteLength,
    },
    select: { id: true, url: true },
  });

  return jsonOk({ id: asset.id, url: asset.url });
}

export async function DELETE(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинете.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

  const url = new URL(request.url);
  const assetId = parseId(url.searchParams.get("id"));
  if (!assetId) {
    return jsonError("VALIDATION_FAILED", "Некорректный идентификатор фотографии.", null, 400);
  }

  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: assetId,
      accountId: resolved.accountId,
      type: "image",
      url: { startsWith: `/uploads/accounts/${resolved.accountId}/review/` },
    },
    select: { id: true, url: true, links: { select: { id: true } } },
  });

  if (!asset) {
    return jsonError("NOT_FOUND", "Фотография не найдена.", null, 404);
  }

  if (asset.links.length > 0) {
    return jsonError("PHOTO_ALREADY_ATTACHED", "Фотография уже прикреплена к отзыву.", null, 409);
  }

  await prisma.mediaAsset.delete({ where: { id: asset.id } });

  const rel = asset.url.replace(/^\//, "");
  const candidate = path.join(process.cwd(), "public", rel);
  const uploadsRoot = path.join(process.cwd(), "public", "uploads") + path.sep;
  const resolvedPath = path.resolve(candidate);
  if (resolvedPath.startsWith(path.resolve(uploadsRoot))) {
    await unlink(resolvedPath).catch(() => undefined);
  }

  return jsonOk({ id: asset.id });
}
