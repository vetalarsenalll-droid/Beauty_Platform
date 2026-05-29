import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACCOUNT_NAME, createDefaultDraft } from "@/lib/site-builder";
import { buildActionPreview } from "../action-preview";
import { inputJson, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

type PublicPageStatusValue = "DRAFT" | "PUBLISHED";

export async function previewSitePayload(payload: JsonRecord) {
  return buildActionPreview({ after: payload });
}

export async function readSiteHealth(accountId: number) {
  const [page, seo, seoPages, sections, blocks, account] = await Promise.all([
    prisma.publicPage.findFirst({ where: { accountId }, include: { publishedVersion: true } }),
    prisma.seoSetting.findUnique({ where: { accountId } }),
    prisma.seoPageSetting.count({ where: { accountId } }),
    prisma.publicPageSection.count({ where: { publicPage: { accountId } } }),
    prisma.publicPageBlock.count({ where: { section: { publicPage: { accountId } } } }),
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true, slug: true } }),
  ]);
  return {
    health: {
      account,
      publicPage: page ? serializePublicPage(page) : null,
      hasDraft: Boolean(page?.draftJson),
      hasPublishedVersion: Boolean(page?.publishedVersionId),
      seoConfigured: Boolean(seo?.title || seo?.description || seo?.robots),
      seoPageSettings: seoPages,
      sections,
      blocks,
      warnings: [
        ...(page ? [] : ["Public page draft is missing."]),
        ...(page?.publishedVersionId ? [] : ["Public page has not been published yet."]),
        ...(seo?.title || seo?.description ? [] : ["Global SEO title/description are not configured."]),
      ],
    },
  };
}

export async function readPublicPage(accountId: number) {
  const page = await ensurePublicPage(accountId);
  const sections = await prisma.publicPageSection.findMany({
    where: { publicPageId: page.id },
    orderBy: { sortOrder: "asc" },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
  return { publicPage: serializePublicPage(page), sections: sections.map(serializeSection) };
}

export async function executeCreatePublicPage(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const existing = await prisma.publicPage.findFirst({ where: { accountId: ctx.accountId } });
  if (existing) return { status: "DONE" as const, data: { publicPageId: existing.id, alreadyExisted: true } };
  const account = await prisma.account.findUnique({ where: { id: ctx.accountId }, select: { name: true } });
  const page = await prisma.publicPage.create({
    data: {
      accountId: ctx.accountId,
      status: statusValue(payload.status ?? "DRAFT"),
      draftJson: inputJson(payload.draftJson ?? createDefaultDraft(account?.name?.trim() || DEFAULT_ACCOUNT_NAME)),
    },
  });
  return { status: "DONE" as const, data: { publicPageId: page.id } };
}

export async function executeUpdatePublicPage(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const page = await ensurePublicPage(ctx.accountId);
  const updated = await prisma.publicPage.update({
    where: { id: page.id },
    data: {
      ...(payload.status !== undefined ? { status: statusValue(payload.status) } : {}),
      ...(payload.draftJson !== undefined ? { draftJson: inputJson(payload.draftJson) } : {}),
    },
  });
  return { status: "DONE" as const, data: { publicPageId: updated.id, status: updated.status } };
}

export async function executeArchivePublicPage(_payload: JsonRecord, ctx: CrmAgentActionContext) {
  const page = await ensurePublicPage(ctx.accountId);
  const updated = await prisma.publicPage.update({ where: { id: page.id }, data: { status: "DRAFT", publishedVersionId: null } });
  return { status: "DONE" as const, data: { publicPageId: updated.id, status: updated.status } };
}

export async function executeApplySiteChanges(_payload: JsonRecord, ctx: CrmAgentActionContext) {
  const page = await ensurePublicPage(ctx.accountId);
  const lastVersion = await prisma.publicPageVersion.findFirst({ where: { publicPageId: page.id }, orderBy: { version: "desc" } });
  const version = await prisma.publicPageVersion.create({
    data: {
      publicPageId: page.id,
      version: (lastVersion?.version ?? 0) + 1,
      contentJson: inputJson(page.draftJson ?? {}) as Prisma.InputJsonValue,
    },
  });
  const updated = await prisma.publicPage.update({ where: { id: page.id }, data: { status: "PUBLISHED", publishedVersionId: version.id } });
  return { status: "DONE" as const, data: { publicPageId: updated.id, versionId: version.id, version: version.version } };
}

export async function executeCreateSection(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const page = await ensurePublicPage(ctx.accountId);
  const section = await prisma.publicPageSection.create({
    data: {
      publicPageId: page.id,
      key: requiredString(payload, "key"),
      title: optionalString(payload, "title"),
      sortOrder: numberOrDefault(payload.sortOrder, 0),
      isVisible: payload.isVisible === undefined ? true : Boolean(payload.isVisible),
      layoutPreset: optionalString(payload, "layoutPreset"),
    },
  });
  return { status: "DONE" as const, data: { sectionId: section.id } };
}

export async function executeUpdateSection(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const sectionId = requiredNumber(payload.sectionId, "sectionId");
  const updated = await prisma.publicPageSection.updateMany({
    where: { id: sectionId, publicPage: { accountId: ctx.accountId } },
    data: {
      ...(payload.key !== undefined ? { key: requiredString(payload, "key") } : {}),
      ...(payload.title !== undefined ? { title: optionalString(payload, "title") } : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: numberOrDefault(payload.sortOrder, 0) } : {}),
      ...(payload.isVisible !== undefined ? { isVisible: Boolean(payload.isVisible) } : {}),
      ...(payload.layoutPreset !== undefined ? { layoutPreset: optionalString(payload, "layoutPreset") } : {}),
    },
  });
  if (!updated.count) throw new Error("Public page section not found.");
  return { status: "DONE" as const, data: { sectionId } };
}

export async function executeDeleteSection(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const sectionId = requiredNumber(payload.sectionId, "sectionId");
  await assertSection(ctx.accountId, sectionId);
  await prisma.publicPageBlock.deleteMany({ where: { sectionId } });
  await prisma.publicPageSection.delete({ where: { id: sectionId } });
  return { status: "DONE" as const, data: { sectionId } };
}

export async function executeCreateBlock(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const sectionId = requiredNumber(payload.sectionId, "sectionId");
  await assertSection(ctx.accountId, sectionId);
  const block = await prisma.publicPageBlock.create({
    data: {
      sectionId,
      type: requiredString(payload, "type"),
      contentJson: inputJson(payload.contentJson ?? {}),
      sortOrder: numberOrDefault(payload.sortOrder, 0),
    },
  });
  return { status: "DONE" as const, data: { blockId: block.id } };
}

export async function executeUpdateBlock(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const blockId = requiredNumber(payload.blockId, "blockId");
  const updated = await prisma.publicPageBlock.updateMany({
    where: { id: blockId, section: { publicPage: { accountId: ctx.accountId } } },
    data: {
      ...(payload.type !== undefined ? { type: requiredString(payload, "type") } : {}),
      ...(payload.contentJson !== undefined ? { contentJson: inputJson(payload.contentJson) } : {}),
      ...(payload.sortOrder !== undefined ? { sortOrder: numberOrDefault(payload.sortOrder, 0) } : {}),
    },
  });
  if (!updated.count) throw new Error("Public page block not found.");
  return { status: "DONE" as const, data: { blockId } };
}

export async function executeDeleteBlock(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const blockId = requiredNumber(payload.blockId, "blockId");
  const deleted = await prisma.publicPageBlock.deleteMany({ where: { id: blockId, section: { publicPage: { accountId: ctx.accountId } } } });
  if (!deleted.count) throw new Error("Public page block not found.");
  return { status: "DONE" as const, data: { blockId } };
}

export async function executeUpdateHomeCopy(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const profile = await prisma.accountProfile.upsert({
    where: { accountId: ctx.accountId },
    create: { accountId: ctx.accountId, ...accountProfileData(payload) },
    update: accountProfileData(payload),
  });
  return { status: "DONE" as const, data: { accountProfileId: profile.id } };
}

export async function executeUpdateServiceCopy(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const updated = await prisma.service.updateMany({
    where: { id: serviceId, accountId: ctx.accountId },
    data: {
      ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
      ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
      ...(payload.searchKeywords !== undefined ? { searchKeywords: optionalString(payload, "searchKeywords") } : {}),
      ...(payload.synonyms !== undefined ? { synonyms: optionalString(payload, "synonyms") } : {}),
    },
  });
  if (!updated.count) throw new Error("Service not found.");
  return { status: "DONE" as const, data: { serviceId } };
}

export async function executeUpdateSpecialistCopy(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const updated = await prisma.specialistProfile.updateMany({
    where: { id: specialistId, accountId: ctx.accountId },
    data: {
      ...(payload.bio !== undefined ? { bio: optionalString(payload, "bio") } : {}),
      ...(payload.isPublic !== undefined ? { isPublic: Boolean(payload.isPublic) } : {}),
    },
  });
  if (!updated.count) throw new Error("Specialist not found.");
  return { status: "DONE" as const, data: { specialistId } };
}

export async function executeUpdateLocationCopy(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  const updated = await prisma.location.updateMany({
    where: { id: locationId, accountId: ctx.accountId },
    data: locationCopyData(payload),
  });
  if (!updated.count) throw new Error("Location not found.");
  return { status: "DONE" as const, data: { locationId } };
}

export async function executeUpdateBookingSettings(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const settings = await prisma.accountSetting.upsert({
    where: { accountId: ctx.accountId },
    create: { accountId: ctx.accountId, ...bookingSettingsData(payload) },
    update: bookingSettingsData(payload),
  });
  return { status: "DONE" as const, data: { accountSettingId: settings.id } };
}

export async function executeUpdateSeoGlobal(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const seo = await prisma.seoSetting.upsert({
    where: { accountId: ctx.accountId },
    create: { accountId: ctx.accountId, ...seoGlobalData(payload) },
    update: seoGlobalData(payload),
  });
  return { status: "DONE" as const, data: { seoSettingId: seo.id } };
}

export async function executeUpdateSeoPage(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const pageKey = requiredString(payload, "pageKey");
  const seo = await prisma.seoPageSetting.upsert({
    where: { accountId_pageKey: { accountId: ctx.accountId, pageKey } },
    create: { accountId: ctx.accountId, pageKey, ...seoPageData(payload) },
    update: seoPageData(payload),
  });
  return { status: "DONE" as const, data: { seoPageSettingId: seo.id, pageKey } };
}

export async function previewMissingDescriptions(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const [services, specialists, locations] = await Promise.all([
    prisma.service.findMany({ where: { accountId: ctx.accountId, description: null }, take: take(payload.take), select: { id: true, name: true } }),
    prisma.specialistProfile.findMany({
      where: { accountId: ctx.accountId, bio: null },
      take: take(payload.take),
      select: { id: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
    }),
    prisma.location.findMany({ where: { accountId: ctx.accountId, description: null }, take: take(payload.take), select: { id: true, name: true } }),
  ]);
  return buildActionPreview({
    after: {
      generated: true,
      services: services.map((service) => ({ serviceId: service.id, draftDescription: `${service.name}: краткое описание услуги для сайта.` })),
      specialists: specialists.map((specialist) => {
        const name = [specialist.user.profile?.firstName, specialist.user.profile?.lastName].filter(Boolean).join(" ") || "Специалист";
        return { specialistId: specialist.id, draftBio: `${name}: краткое описание профиля для сайта.` };
      }),
      locations: locations.map((location) => ({ locationId: location.id, draftDescription: `${location.name}: краткое описание филиала для сайта.` })),
    },
  });
}

async function ensurePublicPage(accountId: number) {
  const existing = await prisma.publicPage.findFirst({ where: { accountId } });
  if (existing) return existing;
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { name: true } });
  return prisma.publicPage.create({
    data: {
      accountId,
      status: "DRAFT",
      draftJson: inputJson(createDefaultDraft(account?.name?.trim() || DEFAULT_ACCOUNT_NAME)),
    },
  });
}

async function assertSection(accountId: number, sectionId: number) {
  const section = await prisma.publicPageSection.findFirst({ where: { id: sectionId, publicPage: { accountId } }, select: { id: true } });
  if (!section) throw new Error("Public page section not found.");
}

function accountProfileData(payload: JsonRecord) {
  return {
    ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
    ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
    ...(payload.email !== undefined ? { email: optionalString(payload, "email") } : {}),
    ...(payload.address !== undefined ? { address: optionalString(payload, "address") } : {}),
    ...(payload.websiteUrl !== undefined ? { websiteUrl: optionalString(payload, "websiteUrl") } : {}),
    ...(payload.instagramUrl !== undefined ? { instagramUrl: optionalString(payload, "instagramUrl") } : {}),
    ...(payload.whatsappUrl !== undefined ? { whatsappUrl: optionalString(payload, "whatsappUrl") } : {}),
    ...(payload.telegramUrl !== undefined ? { telegramUrl: optionalString(payload, "telegramUrl") } : {}),
    ...(payload.maxUrl !== undefined ? { maxUrl: optionalString(payload, "maxUrl") } : {}),
    ...(payload.vkUrl !== undefined ? { vkUrl: optionalString(payload, "vkUrl") } : {}),
    ...(payload.viberUrl !== undefined ? { viberUrl: optionalString(payload, "viberUrl") } : {}),
    ...(payload.pinterestUrl !== undefined ? { pinterestUrl: optionalString(payload, "pinterestUrl") } : {}),
  };
}

function locationCopyData(payload: JsonRecord) {
  return {
    ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
    ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
    ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
    ...(payload.address !== undefined ? { address: requiredString(payload, "address") } : {}),
    ...(payload.websiteUrl !== undefined ? { websiteUrl: optionalString(payload, "websiteUrl") } : {}),
    ...(payload.instagramUrl !== undefined ? { instagramUrl: optionalString(payload, "instagramUrl") } : {}),
    ...(payload.whatsappUrl !== undefined ? { whatsappUrl: optionalString(payload, "whatsappUrl") } : {}),
    ...(payload.telegramUrl !== undefined ? { telegramUrl: optionalString(payload, "telegramUrl") } : {}),
    ...(payload.maxUrl !== undefined ? { maxUrl: optionalString(payload, "maxUrl") } : {}),
    ...(payload.vkUrl !== undefined ? { vkUrl: optionalString(payload, "vkUrl") } : {}),
    ...(payload.viberUrl !== undefined ? { viberUrl: optionalString(payload, "viberUrl") } : {}),
    ...(payload.pinterestUrl !== undefined ? { pinterestUrl: optionalString(payload, "pinterestUrl") } : {}),
  };
}

function bookingSettingsData(payload: JsonRecord) {
  return {
    ...(payload.slotStepMinutes !== undefined ? { slotStepMinutes: numberOrDefault(payload.slotStepMinutes, 15) } : {}),
    ...(payload.requireDeposit !== undefined ? { requireDeposit: Boolean(payload.requireDeposit) } : {}),
    ...(payload.requirePaymentToConfirm !== undefined ? { requirePaymentToConfirm: Boolean(payload.requirePaymentToConfirm) } : {}),
    ...(payload.cancellationWindowHours !== undefined ? { cancellationWindowHours: numberOrNull(payload.cancellationWindowHours) } : {}),
    ...(payload.rescheduleWindowHours !== undefined ? { rescheduleWindowHours: numberOrNull(payload.rescheduleWindowHours) } : {}),
    ...(payload.holdTtlMinutes !== undefined ? { holdTtlMinutes: numberOrNull(payload.holdTtlMinutes) } : {}),
  };
}

function seoGlobalData(payload: JsonRecord) {
  return {
    ...(payload.title !== undefined ? { title: optionalString(payload, "title") } : {}),
    ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
    ...(payload.ogImageUrl !== undefined ? { ogImageUrl: optionalString(payload, "ogImageUrl") } : {}),
    ...(payload.robots !== undefined ? { robots: optionalString(payload, "robots") } : {}),
    ...(payload.sitemapEnabled !== undefined ? { sitemapEnabled: Boolean(payload.sitemapEnabled) } : {}),
    ...(payload.schemaJson !== undefined ? { schemaJson: inputJson(payload.schemaJson) } : {}),
    ...(payload.verificationMetaTags !== undefined ? { verificationMetaTags: optionalString(payload, "verificationMetaTags") } : {}),
  };
}

function seoPageData(payload: JsonRecord) {
  return {
    ...(payload.title !== undefined ? { title: optionalString(payload, "title") } : {}),
    ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
    ...(payload.ogImageUrl !== undefined ? { ogImageUrl: optionalString(payload, "ogImageUrl") } : {}),
    ...(payload.keywords !== undefined ? { keywords: optionalString(payload, "keywords") } : {}),
    ...(payload.canonicalUrl !== undefined ? { canonicalUrl: optionalString(payload, "canonicalUrl") } : {}),
    ...(payload.noIndex !== undefined ? { noIndex: Boolean(payload.noIndex) } : {}),
    ...(payload.noFollow !== undefined ? { noFollow: Boolean(payload.noFollow) } : {}),
  };
}

function serializePublicPage(page: { id: number; accountId: number; status: unknown; draftJson: unknown; publishedVersionId: number | null; createdAt: Date; updatedAt: Date }) {
  return { ...page, createdAt: page.createdAt.toISOString(), updatedAt: page.updatedAt.toISOString() };
}

function serializeSection(section: {
  id: number;
  publicPageId: number;
  key: string;
  title: string | null;
  sortOrder: number;
  isVisible: boolean;
  layoutPreset: string | null;
  createdAt: Date;
  updatedAt: Date;
  blocks: Array<{ id: number; sectionId: number; type: string; contentJson: unknown; sortOrder: number; createdAt: Date; updatedAt: Date }>;
}) {
  return {
    ...section,
    createdAt: section.createdAt.toISOString(),
    updatedAt: section.updatedAt.toISOString(),
    blocks: section.blocks.map((block) => ({ ...block, createdAt: block.createdAt.toISOString(), updatedAt: block.updatedAt.toISOString() })),
  };
}

function statusValue(value: unknown): PublicPageStatusValue {
  if (value === "DRAFT" || value === "PUBLISHED") return value;
  throw new Error("Action payload status must be DRAFT or PUBLISHED.");
}

function numberOrDefault(value: unknown, fallback: number) {
  return numberOrNull(value) ?? fallback;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function take(value: unknown, fallback = 20, max = 100) {
  return Math.min(Math.max(numberOrDefault(value, fallback), 1), max);
}
