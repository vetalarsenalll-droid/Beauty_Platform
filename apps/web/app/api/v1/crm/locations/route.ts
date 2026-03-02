import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type DbLocation = {
  id: number;
  name: string;
  address: string;
  description: string | null;
  phone: string | null;
  status: string;
  websiteUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
  maxUrl: string | null;
  vkUrl: string | null;
  viberUrl: string | null;
  pinterestUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  geoPoint: { lat: number; lng: number } | null;
};
const LOCATION_STATUSES = new Set(["ACTIVE", "INACTIVE"]);

function mapLocation(location: DbLocation) {
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    description: location.description,
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
  };
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
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const name = String(body.name ?? "").trim();
  const address = String(body.address ?? "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const statusRaw = body.status ? String(body.status).trim().toUpperCase() : "ACTIVE";
  if (!LOCATION_STATUSES.has(statusRaw)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный статус локации. Допустимые: ACTIVE, INACTIVE.",
      { fields: [{ path: "status", issue: "invalid" }] },
      400
    );
  }
  const status = statusRaw;
  const geo = body.geo as { lat?: number; lng?: number } | undefined;
  const websiteUrl =
    body.websiteUrl !== undefined ? String(body.websiteUrl).trim() : null;
  const instagramUrl =
    body.instagramUrl !== undefined ? String(body.instagramUrl).trim() : null;
  const whatsappUrl =
    body.whatsappUrl !== undefined ? String(body.whatsappUrl).trim() : null;
  const telegramUrl =
    body.telegramUrl !== undefined ? String(body.telegramUrl).trim() : null;
  const maxUrl =
    body.maxUrl !== undefined ? String(body.maxUrl).trim() : null;
  const vkUrl =
    body.vkUrl !== undefined ? String(body.vkUrl).trim() : null;
  const viberUrl =
    body.viberUrl !== undefined ? String(body.viberUrl).trim() : null;
  const pinterestUrl =
    body.pinterestUrl !== undefined ? String(body.pinterestUrl).trim() : null;

  const normalizedWebsiteUrl = normalizeWebsite(websiteUrl);
  const normalizedInstagramUrl = normalizeByDomain(
    instagramUrl,
    "instagram.com"
  );
  const normalizedWhatsAppUrl = normalizeWhatsApp(whatsappUrl);
  const normalizedTelegramUrl = normalizeTelegram(telegramUrl);
  const normalizedMaxUrl = normalizeByDomain(maxUrl, "max.ru");
  const normalizedVkUrl = normalizeByDomain(vkUrl, "vk.com");
  const normalizedViberUrl = normalizeViber(viberUrl);
  const normalizedPinterestUrl = normalizeByDomain(
    pinterestUrl,
    "pinterest.com"
  );

  if (!name || !address) {
    return jsonError(
      "VALIDATION_FAILED",
      "Заполните название и адрес локации.",
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
      description,
      phone,
      status,
      websiteUrl: normalizedWebsiteUrl,
      instagramUrl: normalizedInstagramUrl,
      whatsappUrl: normalizedWhatsAppUrl,
      telegramUrl: normalizedTelegramUrl,
      maxUrl: normalizedMaxUrl,
      vkUrl: normalizedVkUrl,
      viberUrl: normalizedViberUrl,
      pinterestUrl: normalizedPinterestUrl,
      geoPoint: hasGeo ? { create: { lat, lng } } : undefined,
    },
    include: { geoPoint: true },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Создал локацию",
    targetType: "location",
    targetId: created.id,
    diffJson: {
      name,
      address,
      description,
      phone,
      status,
      websiteUrl: normalizedWebsiteUrl,
      instagramUrl: normalizedInstagramUrl,
      whatsappUrl: normalizedWhatsAppUrl,
      telegramUrl: normalizedTelegramUrl,
      maxUrl: normalizedMaxUrl,
      vkUrl: normalizedVkUrl,
      viberUrl: normalizedViberUrl,
      pinterestUrl: normalizedPinterestUrl,
      geo: hasGeo ? { lat, lng } : null,
    },
  });

  const response = jsonOk(mapLocation(created as DbLocation), 201);
  return applyCrmAccessCookie(response, auth);
}

