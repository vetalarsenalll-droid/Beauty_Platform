import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalBoolean, optionalString, type JsonRecord } from "../action-helpers";

export const specialistSelect = {
  id: true,
  userId: true,
  levelId: true,
  bio: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { email: true, phone: true, status: true, profile: true } },
  level: { select: { id: true, name: true, rank: true } },
  services: { select: { service: { select: { id: true, name: true } }, priceOverride: true, durationOverrideMin: true }, take: 50 },
  locations: { select: { location: { select: { id: true, name: true, address: true } } }, take: 50 },
  categories: { select: { category: { select: { id: true, name: true, slug: true } } }, take: 20 },
} as const;

export function specialistWhere(payload: JsonRecord, accountId: number) {
  const specialistId = numberOrNull(payload.specialistId ?? payload.id);
  const serviceId = numberOrNull(payload.serviceId);
  const locationId = numberOrNull(payload.locationId);
  const isPublic = optionalBoolean(payload, "isPublic");
  return {
    accountId,
    ...(specialistId ? { id: specialistId } : {}),
    ...(serviceId ? { services: { some: { serviceId } } } : {}),
    ...(locationId ? { locations: { some: { locationId } } } : {}),
    ...(isPublic != null ? { isPublic } : {}),
  };
}

export function serializeSpecialist(specialist: {
  id: number;
  userId: number;
  levelId: number | null;
  bio: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string | null; phone: string | null; status: unknown; profile: { firstName: string | null; lastName: string | null; avatarUrl: string | null } | null };
  level: { id: number; name: string; rank: number } | null;
  services: Array<{ service: { id: number; name: string }; priceOverride: { toString(): string } | null; durationOverrideMin: number | null }>;
  locations: Array<{ location: { id: number; name: string; address: string | null } }>;
  categories: Array<{ category: { id: number; name: string; slug: string } }>;
}) {
  const profile = specialist.user.profile;
  return {
    id: specialist.id,
    userId: specialist.userId,
    levelId: specialist.levelId,
    displayName: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || null,
    firstName: profile?.firstName ?? null,
    lastName: profile?.lastName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    email: specialist.user.email,
    phone: specialist.user.phone,
    userStatus: specialist.user.status,
    bio: specialist.bio,
    isPublic: specialist.isPublic,
    createdAt: specialist.createdAt.toISOString(),
    updatedAt: specialist.updatedAt.toISOString(),
    level: specialist.level,
    services: specialist.services.map((item) => ({
      service: item.service,
      priceOverride: item.priceOverride?.toString() ?? null,
      durationOverrideMin: item.durationOverrideMin,
    })),
    locations: specialist.locations.map((item) => item.location),
    categories: specialist.categories.map((item) => item.category),
  };
}

export function specialistQuery(payload: JsonRecord) {
  return optionalString(payload, "query");
}

export function specialistMatchesQuery(specialist: ReturnType<typeof serializeSpecialist>, query: string | null) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase("ru-RU");
  return [
    specialist.displayName,
    specialist.firstName,
    specialist.lastName,
    specialist.email,
    specialist.phone,
    specialist.bio,
    specialist.level?.name,
    ...specialist.services.map((item) => item.service.name),
    ...specialist.locations.map((item) => item.name),
    ...specialist.categories.map((item) => item.name),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalized));
}

export function specialistTake(value: unknown, fallback = 20, max = 100) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}

export async function getSpecialistById(accountId: number, specialistId: number) {
  return prisma.specialistProfile.findFirst({ where: { accountId, id: specialistId }, select: specialistSelect });
}
