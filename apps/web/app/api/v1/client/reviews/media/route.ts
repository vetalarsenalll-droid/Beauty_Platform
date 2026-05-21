import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processUploadedImage } from "@/lib/image-upload-processing";
import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";


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
  const processed = await processUploadedImage(file);
  if ("error" in processed) return processed.error;
  const { outputBuffer, outputExt, width, height, size } = processed;

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
      width,
      height,
      size,
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
