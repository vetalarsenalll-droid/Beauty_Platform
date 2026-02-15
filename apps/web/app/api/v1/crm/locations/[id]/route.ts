import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };
const LOCATION_STATUSES = new Set(["ACTIVE", "INACTIVE"]);

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

function ensureHttps(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function normalizeWebsite(value: string | null) {
  if (!value) return null;
  return ensureHttps(value);
}

function normalizeByDomain(
  value: string | null,
  domain: string,
  pathPrefix = ""
) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const trimmed = value.replace(/^@/, "");
  if (trimmed.toLowerCase().startsWith(domain)) {
    return ensureHttps(trimmed);
  }
  return `https://${domain}/${pathPrefix}${trimmed}`.replace(/\/+$/, "");
}

function normalizeTelegram(value: string | null) {
  if (!value) return null;
  if (/^(https?:\/\/t\.me\/|tg:\/\/)/i.test(value)) return value;
  return normalizeByDomain(value, "t.me");
}

function normalizeWhatsApp(value: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function normalizeViber(value: string | null) {
  if (!value) return null;
  if (/^viber:\/\//i.test(value)) return value;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? `viber://chat?number=${digits}` : null;
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
    return jsonError("NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const data: {
    name?: string;
    address?: string;
    phone?: string | null;
    status?: string;
    websiteUrl?: string | null;
    instagramUrl?: string | null;
    whatsappUrl?: string | null;
    telegramUrl?: string | null;
    maxUrl?: string | null;
    vkUrl?: string | null;
    viberUrl?: string | null;
    pinterestUrl?: string | null;
  } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.address !== undefined) data.address = String(body.address).trim();
  if (body.phone !== undefined)
    data.phone = body.phone ? String(body.phone).trim() : null;
  if (body.status !== undefined) {
    const status = String(body.status).trim().toUpperCase();
    if (!LOCATION_STATUSES.has(status)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректный статус локации. Допустимые: ACTIVE, INACTIVE.",
        { fields: [{ path: "status", issue: "invalid" }] },
        400
      );
    }
    data.status = status;
  }
  if (body.websiteUrl !== undefined)
    data.websiteUrl = normalizeWebsite(
      body.websiteUrl ? String(body.websiteUrl).trim() : null
    );
  if (body.instagramUrl !== undefined)
    data.instagramUrl = normalizeByDomain(
      body.instagramUrl ? String(body.instagramUrl).trim() : null,
      "instagram.com"
    );
  if (body.whatsappUrl !== undefined)
    data.whatsappUrl = normalizeWhatsApp(
      body.whatsappUrl ? String(body.whatsappUrl).trim() : null
    );
  if (body.telegramUrl !== undefined)
    data.telegramUrl = normalizeTelegram(
      body.telegramUrl ? String(body.telegramUrl).trim() : null
    );
  if (body.maxUrl !== undefined)
    data.maxUrl = normalizeByDomain(
      body.maxUrl ? String(body.maxUrl).trim() : null,
      "max.ru"
    );
  if (body.vkUrl !== undefined)
    data.vkUrl = normalizeByDomain(
      body.vkUrl ? String(body.vkUrl).trim() : null,
      "vk.com"
    );
  if (body.viberUrl !== undefined)
    data.viberUrl = normalizeViber(
      body.viberUrl ? String(body.viberUrl).trim() : null
    );
  if (body.pinterestUrl !== undefined)
    data.pinterestUrl = normalizeByDomain(
      body.pinterestUrl ? String(body.pinterestUrl).trim() : null,
      "pinterest.com"
    );

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
    action: "Обновил локацию",
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
    websiteUrl: updated.websiteUrl,
    instagramUrl: updated.instagramUrl,
    whatsappUrl: updated.whatsappUrl,
    telegramUrl: updated.telegramUrl,
    maxUrl: updated.maxUrl,
    vkUrl: updated.vkUrl,
    viberUrl: updated.viberUrl,
    pinterestUrl: updated.pinterestUrl,
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
    return jsonError("NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const response = jsonOk({
    id: location.id,
    name: location.name,
    address: location.address,
    phone: location.phone,
    status: location.status,
    websiteUrl: location.websiteUrl,
    instagramUrl: location.instagramUrl,
    whatsappUrl: location.whatsappUrl,
    telegramUrl: location.telegramUrl,
    maxUrl: location.maxUrl,
    vkUrl: location.vkUrl,
    viberUrl: location.viberUrl,
    pinterestUrl: location.pinterestUrl,
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
    return jsonError("NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const archived = await prisma.location.update({
    where: { id: location.id },
    data: { status: "INACTIVE" },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Архивировал локацию",
    targetType: "location",
    targetId: archived.id,
    diffJson: { status: "INACTIVE" },
  });

  const response = jsonOk({ id: archived.id, status: archived.status });
  return applyCrmAccessCookie(response, auth);
}
