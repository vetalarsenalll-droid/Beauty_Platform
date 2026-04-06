import { resolveAishaSystemPrompt } from "@/lib/aisha-chat-thread";
import type { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import { prisma } from "@/lib/prisma";
import { normalizeDraft, resolveAishaWidgetConfig } from "@/lib/site-builder";

const prismaAny = prisma as any;

type AccountProfileLite = {
  description: string | null;
  address: string | null;
  phone: string | null;
} | null;

export async function loadPublicAiChatContext(accountId: number): Promise<{
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  requiredVersionIds: number[];
  accountProfile: AccountProfileLite;
  customPrompt: string | null;
  assistantName: string;
}> {
  const [locationsRaw, servicesRaw, specialistsRaw, requiredDocs, accountProfile, customPrompt, publicPage] = await Promise.all([
    prismaAny.location.findMany({
      where: { accountId, status: "ACTIVE" },
      select: { id: true, name: true, address: true, description: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.service.findMany({
      where: { accountId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: { select: { name: true } },
        baseDurationMin: true,
        basePrice: true,
        allowMultiServiceBooking: true,
        bookingType: true,
        groupCapacityDefault: true,
        levelConfigs: { select: { levelId: true, durationMin: true, price: true } },
        specialists: { select: { specialistId: true, durationOverrideMin: true, priceOverride: true } },
        locations: { select: { locationId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId },
      select: {
        id: true,
        levelId: true,
        bio: true,
        level: { select: { name: true } },
        user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
        locations: { select: { locationId: true } },
        services: { select: { serviceId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.legalDocument.findMany({
      where: { accountId },
      select: {
        isRequired: true,
        versions: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1, select: { id: true } },
      },
    }),
    prisma.accountProfile.findUnique({ where: { accountId }, select: { description: true, address: true, phone: true } }),
    resolveAishaSystemPrompt(accountId),
    prisma.publicPage.findFirst({
      where: { accountId },
      select: { draftJson: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const locations: LocationLite[] = locationsRaw;
  const services: ServiceLite[] = servicesRaw.map((s) => ({
    id: s.id,
    name: s.name,
    baseDurationMin: s.baseDurationMin,
    description: s.description ?? null,
    categoryName: s.category?.name ?? null,
    basePrice: Number(s.basePrice),
    allowMultiServiceBooking: Boolean(s.allowMultiServiceBooking),
    bookingType: (s.bookingType as "SINGLE" | "GROUP") ?? "SINGLE",
    groupCapacityDefault: s.groupCapacityDefault ?? null,
    levelConfigs: s.levelConfigs.map((x) => ({
      levelId: x.levelId,
      durationMin: x.durationMin ?? null,
      price: x.price == null ? null : Number(x.price),
    })),
    specialistConfigs: s.specialists.map((x) => ({
      specialistId: x.specialistId,
      durationOverrideMin: x.durationOverrideMin ?? null,
      priceOverride: x.priceOverride == null ? null : Number(x.priceOverride),
    })),
    locationIds: s.locations.map((x) => x.locationId),
  }));

  const specialists: SpecialistLite[] = specialistsRaw.map((s) => {
    const fullName = [s.user.profile?.firstName, s.user.profile?.lastName].filter(Boolean).join(" ").trim();
    return {
      id: s.id,
      name: fullName || s.user.email || `Специалист #${s.id}`,
      levelId: s.levelId ?? null,
      levelName: s.level?.name ?? null,
      bio: s.bio ?? null,
      locationIds: s.locations.map((x) => x.locationId),
      serviceIds: s.services.map((x) => x.serviceId),
    };
  });

  const requiredVersionIds = (() => {
    const required = requiredDocs
      .filter((d) => d.isRequired)
      .map((d) => d.versions[0]?.id)
      .filter((x): x is number => Number.isInteger(x));
    if (required.length) return required;
    return requiredDocs.map((d) => d.versions[0]?.id).filter((x): x is number => Number.isInteger(x));
  })();

  const draft = normalizeDraft((publicPage?.draftJson ?? null) as object | null);
  const assistantName = resolveAishaWidgetConfig(draft).assistantName || "Ассистент";

  return { locations, services, specialists, requiredVersionIds, accountProfile, customPrompt, assistantName };
}
