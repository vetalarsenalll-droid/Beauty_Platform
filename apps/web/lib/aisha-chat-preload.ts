import { resolveAishaSystemPrompt } from "@/lib/aisha-chat-thread";
import { getAccountAiSetting } from "@/lib/ai-settings";
import type { LocationLite, ServiceLite, SpecialistLite } from "@/lib/booking-tools";
import { prisma } from "@/lib/prisma";
import { normalizeDraft, resolveAishaWidgetConfig } from "@/lib/site-builder";

type AccountProfileLite = {
  description: string | null;
  address: string | null;
  phone: string | null;
} | null;

export type RequiredLegalDocumentLite = {
  title: string;
  versionId: number;
};

function parseIdSet(value: unknown) {
  return Array.isArray(value)
    ? new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))
    : null;
}

export async function loadPublicAiChatContext(accountId: number): Promise<{
  locations: LocationLite[];
  services: ServiceLite[];
  specialists: SpecialistLite[];
  requiredVersionIds: number[];
  requiredLegalDocuments: RequiredLegalDocumentLite[];
  accountProfile: AccountProfileLite;
  customPrompt: string | null;
  assistantName: string;
}> {
  const [
    locationsRaw,
    servicesRaw,
    specialistsRaw,
    requiredDocs,
    accountProfile,
    customPrompt,
    publicPage,
    assistantNameSetting,
    enabledLocationIdsSetting,
    enabledServiceIdsSetting,
    enabledSpecialistIdsSetting,
  ] = await Promise.all([
    prisma.location.findMany({
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
        searchKeywords: true,
        synonyms: true,
        category: { select: { name: true } },
        baseDurationMin: true,
        basePrice: true,
        allowMultiServiceBooking: true,
        bookingType: true,
        groupCapacityDefault: true,
        levelConfigs: { select: { levelId: true, durationMin: true, price: true } },
        specialists: {
          where: { specialist: { isPublic: true, user: { status: "ACTIVE" } } },
          select: { specialistId: true, durationOverrideMin: true, priceOverride: true },
        },
        locations: { where: { location: { status: "ACTIVE" } }, select: { locationId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId, isPublic: true, user: { status: "ACTIVE" } },
      select: {
        id: true,
        levelId: true,
        bio: true,
        level: { select: { name: true } },
        user: { select: { profile: { select: { firstName: true, lastName: true } } } },
        locations: { where: { location: { status: "ACTIVE" } }, select: { locationId: true } },
        services: { where: { service: { isActive: true } }, select: { serviceId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.legalDocument.findMany({
      where: { accountId },
      select: {
        isRequired: true,
        title: true,
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
    getAccountAiSetting(accountId, "aisha.assistantName"),
    getAccountAiSetting(accountId, "aisha.enabledLocationIds"),
    getAccountAiSetting(accountId, "aisha.enabledServiceIds"),
    getAccountAiSetting(accountId, "aisha.enabledSpecialistIds"),
  ]);

  const enabledLocationIds = parseIdSet(enabledLocationIdsSetting);
  const enabledServiceIds = parseIdSet(enabledServiceIdsSetting);
  const enabledSpecialistIds = parseIdSet(enabledSpecialistIdsSetting);

  const locations: LocationLite[] = enabledLocationIds
    ? locationsRaw.filter((location) => enabledLocationIds.has(location.id))
    : locationsRaw;

  const services: ServiceLite[] = servicesRaw
    .filter((service) => !enabledServiceIds || enabledServiceIds.has(service.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      baseDurationMin: s.baseDurationMin,
      description: s.description ?? null,
      searchKeywords: s.searchKeywords ?? null,
      synonyms: s.synonyms ?? null,
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
      specialistConfigs: s.specialists
        .filter((x) => !enabledSpecialistIds || enabledSpecialistIds.has(x.specialistId))
        .map((x) => ({
          specialistId: x.specialistId,
          durationOverrideMin: x.durationOverrideMin ?? null,
          priceOverride: x.priceOverride == null ? null : Number(x.priceOverride),
        })),
      locationIds: s.locations.map((x) => x.locationId).filter((id) => !enabledLocationIds || enabledLocationIds.has(id)),
    }));

  const specialists: SpecialistLite[] = specialistsRaw
    .filter((specialist) => !enabledSpecialistIds || enabledSpecialistIds.has(specialist.id))
    .map((s) => {
      const fullName = [s.user.profile?.firstName, s.user.profile?.lastName].filter(Boolean).join(" ").trim();
      return {
        id: s.id,
        name: fullName || `Специалист #${s.id}`,
        levelId: s.levelId ?? null,
        levelName: s.level?.name ?? null,
        bio: s.bio ?? null,
        locationIds: s.locations.map((x) => x.locationId).filter((id) => !enabledLocationIds || enabledLocationIds.has(id)),
        serviceIds: s.services.map((x) => x.serviceId).filter((id) => !enabledServiceIds || enabledServiceIds.has(id)),
      };
    });

  const requiredLegalDocuments = requiredDocs
    .filter((d) => d.isRequired)
    .map((d) => {
      const versionId = d.versions[0]?.id;
      if (!Number.isInteger(versionId)) return null;
      return { title: d.title, versionId };
    })
    .filter((x): x is RequiredLegalDocumentLite => Boolean(x));
  const requiredVersionIds = requiredLegalDocuments.map((doc) => doc.versionId);

  const draft = normalizeDraft((publicPage?.draftJson ?? null) as object | null);
  const assistantName =
    (typeof assistantNameSetting === "string" && assistantNameSetting.trim()) ||
    resolveAishaWidgetConfig(draft).assistantName ||
    "Ассистент";

  return { locations, services, specialists, requiredVersionIds, requiredLegalDocuments, accountProfile, customPrompt, assistantName };
}
