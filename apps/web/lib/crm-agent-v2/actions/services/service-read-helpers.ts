import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalBoolean, optionalString, type JsonRecord } from "../action-helpers";

export const serviceSelect = {
  id: true,
  categoryId: true,
  name: true,
  description: true,
  searchKeywords: true,
  synonyms: true,
  baseDurationMin: true,
  basePrice: true,
  isActive: true,
  allowMultiServiceBooking: true,
  bookingType: true,
  groupCapacityDefault: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  variants: { select: { id: true, name: true, durationMin: true, price: true }, take: 30 },
  levelConfigs: { select: { id: true, levelId: true, durationMin: true, price: true, level: { select: { id: true, name: true } } }, take: 30 },
  specialists: {
    select: { specialistId: true, priceOverride: true, durationOverrideMin: true, specialist: { select: { user: { select: { profile: true } } } } },
    take: 50,
  },
  locations: { select: { location: { select: { id: true, name: true, address: true } } }, take: 50 },
} as const;

export function serviceWhere(payload: JsonRecord, accountId: number) {
  const serviceId = numberOrNull(payload.serviceId ?? payload.id);
  const categoryId = numberOrNull(payload.categoryId);
  const isActive = optionalBoolean(payload, "isActive");
  return {
    accountId,
    ...(serviceId ? { id: serviceId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(isActive != null ? { isActive } : {}),
  };
}

export function serializeService(service: {
  id: number;
  categoryId: number | null;
  name: string;
  description: string | null;
  searchKeywords: string | null;
  synonyms: string | null;
  baseDurationMin: number;
  basePrice: { toString(): string };
  isActive: boolean;
  allowMultiServiceBooking: boolean;
  bookingType: unknown;
  groupCapacityDefault: number | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: number; name: string; slug: string } | null;
  variants: Array<{ id: number; name: string; durationMin: number | null; price: { toString(): string } | null }>;
  levelConfigs: Array<{ id: number; levelId: number; durationMin: number | null; price: { toString(): string } | null; level: { id: number; name: string } }>;
  specialists: Array<{
    specialistId: number;
    priceOverride: { toString(): string } | null;
    durationOverrideMin: number | null;
    specialist: { user: { profile: { firstName: string | null; lastName: string | null } | null } };
  }>;
  locations: Array<{ location: { id: number; name: string; address: string | null } }>;
}) {
  return {
    id: service.id,
    categoryId: service.categoryId,
    name: service.name,
    description: service.description,
    searchKeywords: service.searchKeywords,
    synonyms: service.synonyms,
    baseDurationMin: service.baseDurationMin,
    basePrice: service.basePrice.toString(),
    isActive: service.isActive,
    allowMultiServiceBooking: service.allowMultiServiceBooking,
    bookingType: service.bookingType,
    groupCapacityDefault: service.groupCapacityDefault,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
    category: service.category,
    variants: service.variants.map((variant) => ({ ...variant, price: variant.price?.toString() ?? null })),
    levelConfigs: service.levelConfigs.map((config) => ({ ...config, price: config.price?.toString() ?? null })),
    specialists: service.specialists.map((item) => {
      const profile = item.specialist.user.profile;
      return {
        specialistId: item.specialistId,
        displayName: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || null,
        priceOverride: item.priceOverride?.toString() ?? null,
        durationOverrideMin: item.durationOverrideMin,
      };
    }),
    locations: service.locations.map((item) => item.location),
  };
}

export async function getServiceById(accountId: number, serviceId: number) {
  return prisma.service.findFirst({ where: { accountId, id: serviceId }, select: serviceSelect });
}

export function serviceMatchesQuery(service: ReturnType<typeof serializeService>, query: string | null) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase("ru-RU");
  return [service.name, service.description, service.searchKeywords, service.synonyms, service.category?.name]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalized));
}

export function serviceTake(value: unknown, fallback = 20, max = 100) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}

export function serviceQuery(payload: JsonRecord) {
  return optionalString(payload, "query");
}
