import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";
import { processUploadedImage } from "@/lib/image-upload-processing";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

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
  const processed = await processUploadedImage(file);
  if ("error" in processed) return processed.error;
  const { outputBuffer, outputExt, width, height, size } = processed;

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
      width,
      height,
      size,
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
