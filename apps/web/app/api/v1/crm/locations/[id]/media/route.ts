import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { processUploadedImage } from "@/lib/image-upload-processing";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const MEDIA_TYPES = {
  location: "location.photo",
  work: "location.work",
} as const;


function parseLocationId(raw: string) {
  const locationId = Number(raw);
  if (!Number.isInteger(locationId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id локации.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { locationId };
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.locations.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseLocationId(id);
  if ("error" in parsed) return parsed.error;

  const location = await prisma.location.findUnique({
    where: { id: parsed.locationId },
  });

  if (!location || location.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Локация не найдена.", null, 404);
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
      "Передайте файл и тип фото.",
      null,
      400
    );
  }
  const processed = await processUploadedImage(file);
  if ("error" in processed) return processed.error;
  const { outputBuffer, outputExt, width, height, size } = processed;

  const safeExt = /^[.\w]+$/.test(outputExt) ? outputExt : ".jpg";
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`;
  const baseDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "locations",
    String(location.id),
    typeKey
  );
  await mkdir(baseDir, { recursive: true });
  const filePath = path.join(baseDir, fileName);
  await writeFile(filePath, outputBuffer);
  const url = `/uploads/locations/${location.id}/${typeKey}/${fileName}`;

  const link = await prisma.$transaction(async (tx) => {
    const existing = await tx.mediaLink.findFirst({
      where: {
        entityType,
        entityId: String(location.id),
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const count = await tx.mediaLink.count({
      where: {
        entityType,
        entityId: String(location.id),
      },
    });
    const nextOrder = existing ? existing.sortOrder + 1 : 0;

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

    return tx.mediaLink.create({
      data: {
        assetId: created.id,
        entityType,
        entityId: String(location.id),
        sortOrder: nextOrder,
        isCover: count === 0,
      },
    });
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Добавил фото локации",
    targetType: "location",
    targetId: location.id,
    diffJson: { mediaLinkId: link.id, url, entityType },
  });

  const response = jsonOk({
    id: link.id,
    url,
    entityType,
  });
  return applyCrmAccessCookie(response, auth);
}
