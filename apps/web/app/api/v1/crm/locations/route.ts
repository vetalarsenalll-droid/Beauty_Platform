import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type DbLocation = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  geoPoint: { lat: number; lng: number } | null;
};

function mapLocation(location: DbLocation) {
  return {
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
  };
}

export async function GET() {
  const auth = await requireCrmApiPermission("crm.locations.read");
  if ("response" in auth) return auth.response;

  const locations = await prisma.location.findMany({
    where: { accountId: auth.session.accountId },
    include: { geoPoint: true },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(
    locations.map((location) => mapLocation(location as DbLocation))
  );
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.locations.create");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректный формат запроса",
      null,
      400
    );
  }

  const name = String(body.name ?? "").trim();
  const address = String(body.address ?? "").trim();
  const phone = body.phone ? String(body.phone).trim() : null;
  const status = body.status ? String(body.status).trim() : "ACTIVE";
  const geo = body.geo as { lat?: number; lng?: number } | undefined;

  if (!name || !address) {
    return jsonError(
      "VALIDATION_FAILED",
      "Название и адрес обязательны",
      {
        fields: [
          { path: "name", issue: name ? null : "required" },
          { path: "address", issue: address ? null : "required" },
        ],
      },
      400
    );
  }

  const lat =
    geo && typeof geo.lat === "number" ? Number(geo.lat) : undefined;
  const lng =
    geo && typeof geo.lng === "number" ? Number(geo.lng) : undefined;
  const hasGeo = lat !== undefined && lng !== undefined;

  const created = await prisma.location.create({
    data: {
      accountId: auth.session.accountId,
      name,
      address,
      phone,
      status,
      geoPoint: hasGeo ? { create: { lat, lng } } : undefined,
    },
    include: { geoPoint: true },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Создание локации",
    targetType: "location",
    targetId: created.id,
    diffJson: { name, address, phone, status, geo: hasGeo ? { lat, lng } : null },
  });

  const response = jsonOk(mapLocation(created as DbLocation), 201);
  return applyCrmAccessCookie(response, auth);
}
