import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };

function parseLocationId(raw: string) {
  const locationId = Number(raw);
  if (!Number.isInteger(locationId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id локации",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { locationId };
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.locations.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseLocationId(id);
  if ("error" in parsed) return parsed.error;

  const location = await prisma.location.findUnique({
    where: { id: parsed.locationId },
    include: { geoPoint: true },
  });

  if (!location || location.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Локация не найдена", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректный формат запроса",
      null,
      400
    );
  }

  const data: {
    name?: string;
    address?: string;
    phone?: string | null;
    status?: string;
  } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.address !== undefined) data.address = String(body.address).trim();
  if (body.phone !== undefined)
    data.phone = body.phone ? String(body.phone).trim() : null;
  if (body.status !== undefined) data.status = String(body.status).trim();

  const geo = body.geo as { lat?: number; lng?: number } | null | undefined;
  const lat =
    geo && typeof geo.lat === "number" ? Number(geo.lat) : undefined;
  const lng =
    geo && typeof geo.lng === "number" ? Number(geo.lng) : undefined;
  const hasGeo = lat !== undefined && lng !== undefined;

  const updated = await prisma.location.update({
    where: { id: location.id },
    data: {
      ...data,
      geoPoint:
        geo === null
          ? { delete: true }
          : hasGeo
            ? { upsert: { update: { lat, lng }, create: { lat, lng } } }
            : undefined,
    },
    include: { geoPoint: true },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновление локации",
    targetType: "location",
    targetId: updated.id,
    diffJson: {
      ...data,
      geo: geo === null ? null : hasGeo ? { lat, lng } : undefined,
    },
  });

  const response = jsonOk({
    id: updated.id,
    name: updated.name,
    address: updated.address,
    phone: updated.phone,
    status: updated.status,
    geo: updated.geoPoint
      ? { lat: updated.geoPoint.lat, lng: updated.geoPoint.lng }
      : null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.locations.read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseLocationId(id);
  if ("error" in parsed) return parsed.error;

  const location = await prisma.location.findUnique({
    where: { id: parsed.locationId },
    include: { geoPoint: true },
  });

  if (!location || location.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Локация не найдена", null, 404);
  }

  const response = jsonOk({
    id: location.id,
    name: location.name,
    address: location.address,
    phone: location.phone,
    status: location.status,
    geo: location.geoPoint
      ? { lat: location.geoPoint.lat, lng: location.geoPoint.lng }
      : null,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.locations.delete");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseLocationId(id);
  if ("error" in parsed) return parsed.error;

  const location = await prisma.location.findUnique({
    where: { id: parsed.locationId },
  });

  if (!location || location.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Локация не найдена", null, 404);
  }

  const archived = await prisma.location.update({
    where: { id: location.id },
    data: { status: "INACTIVE" },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удаление локации",
    targetType: "location",
    targetId: archived.id,
    diffJson: { status: "INACTIVE" },
  });

  const response = jsonOk({ id: archived.id, status: archived.status });
  return applyCrmAccessCookie(response, auth);
}
