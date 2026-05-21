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
  specialist: "specialist.photo",
  work: "specialist.work",
} as const;


function parseSpecialistId(raw: string) {
  const specialistId = Number(raw);
  if (!Number.isInteger(specialistId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id специалиста.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { specialistId };
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.specialists.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseSpecialistId(id);
  if ("error" in parsed) return parsed.error;

  const specialist = await prisma.specialistProfile.findUnique({
    where: { id: parsed.specialistId },
  });

  if (!specialist || specialist.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Специалист не найден.", null, 404);
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
    "specialists",
    String(specialist.id),
    typeKey
  );
  await mkdir(baseDir, { recursive: true });
  const filePath = path.join(baseDir, fileName);
  await writeFile(filePath, outputBuffer);
  const url = `/uploads/specialists/${specialist.id}/${typeKey}/${fileName}`;

  const link = await prisma.$transaction(async (tx) => {
    const existing = await tx.mediaLink.findFirst({
      where: {
        entityType,
        entityId: String(specialist.id),
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const count = await tx.mediaLink.count({
      where: {
        entityType,
        entityId: String(specialist.id),
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
        entityId: String(specialist.id),
        sortOrder: nextOrder,
        isCover: count === 0,
      },
    });
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Загрузил фото специалиста",
    targetType: "specialist",
    targetId: specialist.id,
    diffJson: { mediaLinkId: link.id, url, entityType },
  });

  const response = jsonOk({
    id: link.id,
    url,
    entityType,
  });
  return applyCrmAccessCookie(response, auth);
}
