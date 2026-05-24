import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function isObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFromTarget(value: string | null, fallback: unknown) {
  const raw = typeof fallback === "number" ? fallback : Number(value ?? "");
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

function pickPatch(patch: Prisma.JsonObject, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]));
}

function mergePreview(current: Record<string, unknown> | null, patch: Record<string, unknown>) {
  return {
    current,
    after: { ...(current ?? {}), ...patch },
    patch,
  };
}

export async function buildCrmAgentSiteDraftPreview(input: {
  accountId: number;
  draftId: number;
}) {
  const draft = await prisma.aiAgentSiteDraft.findFirst({
    where: { id: input.draftId, accountId: input.accountId },
  });
  if (!draft) return null;

  const patch = isObject(draft.patch) ? draft.patch : {};

  if (draft.targetType === "service") {
    const serviceId = numberFromTarget(draft.targetId, patch.serviceId);
    const service = serviceId
      ? await prisma.service.findFirst({
          where: { id: serviceId, accountId: input.accountId },
          select: { id: true, name: true, description: true, searchKeywords: true, synonyms: true, isActive: true },
        })
      : null;
    return {
      draft,
      target: { type: "Услуга", id: serviceId },
      preview: mergePreview(service, pickPatch(patch, ["name", "description", "searchKeywords", "synonyms", "isActive"])),
    };
  }

  if (draft.targetType === "specialist") {
    const specialistId = numberFromTarget(draft.targetId, patch.specialistId);
    const specialist = specialistId
      ? await prisma.specialistProfile.findFirst({
          where: { id: specialistId, accountId: input.accountId },
          select: { id: true, bio: true, isPublic: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
        })
      : null;
    return {
      draft,
      target: { type: "Сотрудник", id: specialistId },
      preview: mergePreview(specialist, pickPatch(patch, ["bio", "isPublic"])),
    };
  }

  if (draft.targetType === "home") {
    const profile = await prisma.accountProfile.findUnique({
      where: { accountId: input.accountId },
      select: { description: true, phone: true, email: true, address: true, websiteUrl: true },
    });
    return {
      draft,
      target: { type: "Главная страница", id: input.accountId },
      preview: mergePreview(profile, pickPatch(patch, ["description", "phone", "email", "address", "websiteUrl"])),
    };
  }

  if (draft.targetType === "seo") {
    const pageKey = typeof patch.pageKey === "string" ? patch.pageKey : null;
    const current = pageKey
      ? await prisma.seoPageSetting.findUnique({
          where: { accountId_pageKey: { accountId: input.accountId, pageKey } },
          select: { pageKey: true, title: true, description: true, keywords: true, canonicalUrl: true, noIndex: true, noFollow: true },
        })
      : await prisma.seoSetting.findUnique({
          where: { accountId: input.accountId },
          select: { title: true, description: true, ogImageUrl: true, robots: true, sitemapEnabled: true },
        });
    return {
      draft,
      target: { type: pageKey ? "Поисковые настройки страницы" : "Общие поисковые настройки", id: pageKey ?? input.accountId },
      preview: mergePreview(current, pickPatch(patch, ["title", "description", "keywords", "canonicalUrl", "noIndex", "noFollow", "ogImageUrl", "robots"])),
    };
  }

  return {
    draft,
    target: { type: draft.targetType, id: draft.targetId },
    preview: mergePreview(null, patch),
  };
}
