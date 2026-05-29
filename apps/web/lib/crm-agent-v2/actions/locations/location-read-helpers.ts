import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalString, type JsonRecord } from "../action-helpers";

export const locationSelect = {
  id: true,
  name: true,
  address: true,
  description: true,
  phone: true,
  status: true,
  websiteUrl: true,
  instagramUrl: true,
  whatsappUrl: true,
  telegramUrl: true,
  createdAt: true,
  updatedAt: true,
  hours: { select: { dayOfWeek: true, startTime: true, endTime: true }, orderBy: { dayOfWeek: "asc" } },
  services: { select: { service: { select: { id: true, name: true, isActive: true } } }, take: 50 },
  specialists: { select: { specialistId: true, specialist: { select: { user: { select: { profile: true } } } } }, take: 50 },
} as const;

export function locationWhere(payload: JsonRecord, accountId: number) {
  const locationId = numberOrNull(payload.locationId ?? payload.id);
  const status = optionalString(payload, "status");
  return { accountId, ...(locationId ? { id: locationId } : {}), ...(status ? { status } : {}) };
}

export function serializeLocation(location: {
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
  createdAt: Date;
  updatedAt: Date;
  hours: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  services: Array<{ service: { id: number; name: string; isActive: boolean } }>;
  specialists: Array<{ specialistId: number; specialist: { user: { profile: { firstName: string | null; lastName: string | null } | null } } }>;
}) {
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
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
    hours: location.hours,
    services: location.services.map((item) => item.service),
    specialists: location.specialists.map((item) => {
      const profile = item.specialist.user.profile;
      return {
        specialistId: item.specialistId,
        displayName: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || null,
      };
    }),
  };
}

export function locationQuery(payload: JsonRecord) {
  return optionalString(payload, "query");
}

export function locationMatchesQuery(location: ReturnType<typeof serializeLocation>, query: string | null) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase("ru-RU");
  return [location.name, location.address, location.description, location.phone, ...location.services.map((item) => item.name)]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalized));
}

export function locationTake(value: unknown, fallback = 20, max = 100) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}

export async function getLocationById(accountId: number, locationId: number) {
  return prisma.location.findFirst({ where: { accountId, id: locationId }, select: locationSelect });
}
