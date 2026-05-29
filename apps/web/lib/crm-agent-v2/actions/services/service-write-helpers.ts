import { ServiceBookingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import {
  assertLocationBelongsToAccount,
  assertServiceCategoryBelongsToAccount,
  assertSpecialistBelongsToAccount,
  numberOrNull,
  optionalBoolean,
  optionalString,
  requiredNumber,
  requiredString,
  type JsonRecord,
} from "../action-helpers";
import type { CrmAgentActionContext, CrmAgentActionPreview } from "../types";
import { loadServiceBefore, updateService } from "./service.update";

export async function previewServiceUpdate(payload: JsonRecord, ctx: CrmAgentActionContext): Promise<CrmAgentActionPreview> {
  const before = await loadServiceBefore(payload, ctx.accountId);
  return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
}

export async function executeServiceUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = await updateService(payload, ctx.accountId);
  return { status: "DONE" as const, data: { serviceId } };
}

export async function executeServiceActivate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  return executeServiceUpdate({ ...payload, isActive: true }, ctx);
}

export async function executeServiceRelationPreview(payload: JsonRecord, ctx: CrmAgentActionContext, after: Record<string, unknown>) {
  const before = await loadServiceBefore(payload, ctx.accountId);
  return buildActionPreview({ before, after: { serviceId: payload.serviceId, ...after } });
}

export async function executeServiceSpecialistAssign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  await prisma.specialistService.upsert({
    where: { specialistId_serviceId: { specialistId, serviceId } },
    create: {
      specialistId,
      serviceId,
      priceOverride: optionalString(payload, "priceOverride"),
      durationOverrideMin: numberOrNull(payload.durationOverrideMin),
    },
    update: {
      ...(payload.priceOverride !== undefined ? { priceOverride: optionalString(payload, "priceOverride") } : {}),
      ...(payload.durationOverrideMin !== undefined ? { durationOverrideMin: numberOrNull(payload.durationOverrideMin) } : {}),
    },
  });
  return { status: "DONE" as const, data: { serviceId, specialistId } };
}

export async function executeServiceSpecialistUnassign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  await prisma.specialistService.deleteMany({ where: { specialistId, serviceId } });
  return { status: "DONE" as const, data: { serviceId, specialistId } };
}

export async function executeServiceLocationAssign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  await prisma.serviceLocation.upsert({
    where: { serviceId_locationId: { serviceId, locationId } },
    create: { serviceId, locationId },
    update: {},
  });
  return { status: "DONE" as const, data: { serviceId, locationId } };
}

export async function executeServiceLocationUnassign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  await prisma.serviceLocation.deleteMany({ where: { serviceId, locationId } });
  return { status: "DONE" as const, data: { serviceId, locationId } };
}

export async function executeServiceVariantAdd(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  const variant = await prisma.serviceVariant.create({
    data: {
      serviceId,
      name: requiredString(payload, "name"),
      durationMin: numberOrNull(payload.durationMin),
      price: optionalString(payload, "price"),
    },
  });
  return { status: "DONE" as const, data: { serviceId, variantId: variant.id } };
}

export async function executeServiceVariantUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const variantId = requiredNumber(payload.variantId, "variantId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  const updated = await prisma.serviceVariant.updateMany({
    where: { id: variantId, serviceId },
    data: {
      ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
      ...(payload.durationMin !== undefined ? { durationMin: numberOrNull(payload.durationMin) } : {}),
      ...(payload.price !== undefined ? { price: optionalString(payload, "price") } : {}),
    },
  });
  if (!updated.count) throw new Error("Service variant not found.");
  return { status: "DONE" as const, data: { serviceId, variantId } };
}

export async function executeServiceVariantDelete(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const variantId = requiredNumber(payload.variantId, "variantId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await prisma.serviceVariant.deleteMany({ where: { id: variantId, serviceId } });
  return { status: "DONE" as const, data: { serviceId, variantId } };
}

export async function executeServiceLevelConfigUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const levelId = requiredNumber(payload.levelId, "levelId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await assertSpecialistLevelBelongsToAccount(ctx.accountId, levelId);
  await prisma.serviceLevelConfig.upsert({
    where: { serviceId_levelId: { serviceId, levelId } },
    create: { serviceId, levelId, durationMin: numberOrNull(payload.durationMin), price: optionalString(payload, "price") },
    update: {
      ...(payload.durationMin !== undefined ? { durationMin: numberOrNull(payload.durationMin) } : {}),
      ...(payload.price !== undefined ? { price: optionalString(payload, "price") } : {}),
    },
  });
  return { status: "DONE" as const, data: { serviceId, levelId } };
}

export async function executeServiceCategoryCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const name = requiredString(payload, "name");
  const category = await prisma.serviceCategory.create({ data: { accountId: ctx.accountId, name, slug: slugify(optionalString(payload, "slug") ?? name) } });
  return { status: "DONE" as const, data: { categoryId: category.id } };
}

export async function executeServiceCategoryUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const categoryId = requiredNumber(payload.categoryId, "categoryId");
  await assertServiceCategoryBelongsToAccount(ctx.accountId, categoryId);
  const name = optionalString(payload, "name");
  const slug = optionalString(payload, "slug");
  const updated = await prisma.serviceCategory.updateMany({
    where: { id: categoryId, accountId: ctx.accountId },
    data: { ...(name ? { name } : {}), ...(slug ? { slug: slugify(slug) } : {}) },
  });
  if (!updated.count) throw new Error("Service category not found.");
  return { status: "DONE" as const, data: { categoryId } };
}

export async function executeServiceCategoryDelete(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const categoryId = requiredNumber(payload.categoryId, "categoryId");
  await assertServiceCategoryBelongsToAccount(ctx.accountId, categoryId);
  const services = await prisma.service.count({ where: { accountId: ctx.accountId, categoryId } });
  if (services > 0) throw new Error("Service category is not empty.");
  await prisma.serviceCategory.deleteMany({ where: { id: categoryId, accountId: ctx.accountId } });
  return { status: "DONE" as const, data: { categoryId } };
}

export async function executeServiceDeleteIfEmpty(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  const [appointmentServices, groupSessions] = await Promise.all([
    prisma.appointmentService.count({ where: { serviceId } }),
    prisma.groupSession.count({ where: { serviceId, accountId: ctx.accountId } }),
  ]);
  if (appointmentServices || groupSessions) throw new Error("Service has bookings and cannot be deleted.");
  await prisma.service.deleteMany({ where: { id: serviceId, accountId: ctx.accountId } });
  return { status: "DONE" as const, data: { serviceId } };
}

export async function executeServiceMediaAttach(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const assetId = requiredNumber(payload.assetId, "assetId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await assertMediaAssetBelongsToAccount(ctx.accountId, assetId);
  const link = await prisma.mediaLink.create({
    data: {
      assetId,
      entityType: "service",
      entityId: String(serviceId),
      sortOrder: numberOrNull(payload.sortOrder) ?? 0,
      isCover: optionalBoolean(payload, "isCover") ?? false,
    },
  });
  return { status: "DONE" as const, data: { serviceId, assetId, mediaLinkId: link.id } };
}

export async function executeServiceMediaDetach(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const assetId = requiredNumber(payload.assetId, "assetId");
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await assertMediaAssetBelongsToAccount(ctx.accountId, assetId);
  await prisma.mediaLink.deleteMany({ where: { assetId, entityType: "service", entityId: String(serviceId) } });
  return { status: "DONE" as const, data: { serviceId, assetId } };
}

export async function previewGeneratedServiceDescription(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const before = await loadServiceBefore(payload, ctx.accountId);
  if (!before) throw new Error("Service not found.");
  const description = `${before.name} - услуга с длительностью ${before.baseDurationMin} мин. Подходит для клиентов, которым нужен понятный результат и аккуратный профессиональный уход.`;
  return buildActionPreview({ before, after: { ...before, description, generated: true } });
}

export function bookingType(payload: JsonRecord) {
  const value = requiredString(payload, "bookingType");
  if (value === ServiceBookingType.SINGLE || value === ServiceBookingType.GROUP) return value;
  throw new Error("Action payload bookingType must be SINGLE or GROUP.");
}

async function assertServiceBelongsToAccount(accountId: number, serviceId: number) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, accountId }, select: { id: true } });
  if (!service) throw new Error("Service not found.");
}

async function assertSpecialistLevelBelongsToAccount(accountId: number, levelId: number) {
  const level = await prisma.specialistLevel.findFirst({ where: { id: levelId, OR: [{ accountId }, { accountId: null }] }, select: { id: true } });
  if (!level) throw new Error("Specialist level not found.");
}

async function assertMediaAssetBelongsToAccount(accountId: number, assetId: number) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, OR: [{ accountId }, { accountId: null }] }, select: { id: true } });
  if (!asset) throw new Error("Media asset not found.");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}
