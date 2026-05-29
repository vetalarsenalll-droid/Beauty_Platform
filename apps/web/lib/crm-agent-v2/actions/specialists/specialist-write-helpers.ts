import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import {
  assertLocationBelongsToAccount,
  assertSpecialistBelongsToAccount,
  numberOrNull,
  optionalBoolean,
  optionalString,
  requiredNumber,
  type JsonRecord,
} from "../action-helpers";
import type { CrmAgentActionContext, CrmAgentActionPreview } from "../types";

export async function previewSpecialistProfileUpdate(payload: JsonRecord, ctx: CrmAgentActionContext): Promise<CrmAgentActionPreview> {
  const before = await loadSpecialistProfileBefore(ctx.accountId, numberOrNull(payload.specialistId));
  return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
}

export async function executeSpecialistProfileUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  if (payload.levelId !== undefined) {
    const levelId = numberOrNull(payload.levelId);
    if (levelId != null) await assertSpecialistLevelBelongsToAccount(ctx.accountId, levelId);
  }
  const data = profileUpdateData(payload);
  if (!Object.keys(data.specialist).length && !Object.keys(data.userProfile).length) throw new Error("No specialist fields to update.");

  await prisma.$transaction(async (tx) => {
    const specialist = await tx.specialistProfile.findFirst({
      where: { id: specialistId, accountId: ctx.accountId },
      select: { id: true, userId: true },
    });
    if (!specialist) throw new Error("Specialist not found.");
    if (Object.keys(data.specialist).length) {
      await tx.specialistProfile.update({ where: { id: specialist.id }, data: data.specialist });
    }
    if (Object.keys(data.userProfile).length) {
      await tx.userProfile.upsert({
        where: { userId: specialist.userId },
        create: { userId: specialist.userId, ...data.userProfile },
        update: data.userProfile,
      });
    }
  });

  return { status: "DONE" as const, data: { specialistId } };
}

export async function previewSpecialistRelation(payload: JsonRecord, ctx: CrmAgentActionContext, after: Record<string, unknown>) {
  const before = await loadSpecialistProfileBefore(ctx.accountId, numberOrNull(payload.specialistId));
  return buildActionPreview({ before, after: { specialistId: payload.specialistId, ...after } });
}

export async function executeSpecialistServiceAssign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
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
  return { status: "DONE" as const, data: { specialistId, serviceId } };
}

export async function executeSpecialistServiceUnassign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  await assertServiceBelongsToAccount(ctx.accountId, serviceId);
  await prisma.specialistService.deleteMany({ where: { specialistId, serviceId } });
  return { status: "DONE" as const, data: { specialistId, serviceId } };
}

export async function executeSpecialistLocationAssign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  await prisma.specialistLocation.upsert({
    where: { specialistId_locationId: { specialistId, locationId } },
    create: { specialistId, locationId },
    update: {},
  });
  return { status: "DONE" as const, data: { specialistId, locationId } };
}

export async function executeSpecialistLocationUnassign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  await prisma.specialistLocation.deleteMany({ where: { specialistId, locationId } });
  return { status: "DONE" as const, data: { specialistId, locationId } };
}

export async function executeSpecialistCategoryAssign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const categoryId = requiredNumber(payload.categoryId, "categoryId");
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  await assertSpecialistCategoryBelongsToAccount(ctx.accountId, categoryId);
  await prisma.specialistCategoryLink.upsert({
    where: { specialistId_categoryId: { specialistId, categoryId } },
    create: { specialistId, categoryId },
    update: {},
  });
  return { status: "DONE" as const, data: { specialistId, categoryId } };
}

export async function executeSpecialistCategoryRemove(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const categoryId = requiredNumber(payload.categoryId, "categoryId");
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  await assertSpecialistCategoryBelongsToAccount(ctx.accountId, categoryId);
  await prisma.specialistCategoryLink.deleteMany({ where: { specialistId, categoryId } });
  return { status: "DONE" as const, data: { specialistId, categoryId } };
}

export async function executeSpecialistLevelSet(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const levelId = numberOrNull(payload.levelId);
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  if (levelId != null) await assertSpecialistLevelBelongsToAccount(ctx.accountId, levelId);
  await prisma.$transaction(async (tx) => {
    await tx.specialistProfile.update({ where: { id: specialistId }, data: { levelId } });
    if (levelId != null) await tx.specialistLevelHistory.create({ data: { specialistId, levelId } });
  });
  return { status: "DONE" as const, data: { specialistId, levelId } };
}

export async function previewSpecialistGeneratedBio(payload: JsonRecord, ctx: CrmAgentActionContext): Promise<CrmAgentActionPreview> {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const before = await loadSpecialistProfileBefore(ctx.accountId, specialistId);
  if (!before) throw new Error("Specialist not found.");
  const services = await prisma.specialistService.findMany({
    where: { specialistId, specialist: { accountId: ctx.accountId } },
    select: { service: { select: { name: true } } },
    take: 8,
  });
  const serviceNames = services.map((item) => item.service.name).filter(Boolean);
  const displayName = [before.firstName, before.lastName].filter(Boolean).join(" ").trim() || "Специалист";
  const generatedBio = [
    `${displayName} принимает клиентов и помогает подобрать подходящий уход под задачу и комфортный темп процедуры.`,
    serviceNames.length ? `Основные направления: ${serviceNames.join(", ")}.` : null,
    "В работе уделяет внимание аккуратной консультации, понятным рекомендациям и стабильному результату.",
  ]
    .filter(Boolean)
    .join(" ");
  return buildActionPreview({ before, after: { ...before, bio: generatedBio, generated: true } });
}

async function loadSpecialistProfileBefore(accountId: number, specialistId: number | null) {
  if (!specialistId) return null;
  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: specialistId, accountId },
    select: {
      id: true,
      levelId: true,
      bio: true,
      isPublic: true,
      user: { select: { profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
    },
  });
  if (!specialist) return null;
  return {
    id: specialist.id,
    levelId: specialist.levelId,
    bio: specialist.bio,
    isPublic: specialist.isPublic,
    firstName: specialist.user.profile?.firstName ?? null,
    lastName: specialist.user.profile?.lastName ?? null,
    avatarUrl: specialist.user.profile?.avatarUrl ?? null,
  };
}

function profileUpdateData(payload: JsonRecord) {
  return {
    specialist: {
      ...(payload.bio !== undefined ? { bio: optionalString(payload, "bio") } : {}),
      ...(payload.isPublic !== undefined ? { isPublic: optionalBoolean(payload, "isPublic") ?? true } : {}),
      ...(payload.levelId !== undefined ? { levelId: numberOrNull(payload.levelId) } : {}),
    },
    userProfile: {
      ...(payload.firstName !== undefined ? { firstName: optionalString(payload, "firstName") } : {}),
      ...(payload.lastName !== undefined ? { lastName: optionalString(payload, "lastName") } : {}),
      ...(payload.avatarUrl !== undefined ? { avatarUrl: optionalString(payload, "avatarUrl") } : {}),
    },
  };
}

async function assertServiceBelongsToAccount(accountId: number, serviceId: number) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, accountId }, select: { id: true } });
  if (!service) throw new Error("Service not found.");
}

async function assertSpecialistCategoryBelongsToAccount(accountId: number, categoryId: number) {
  const category = await prisma.specialistCategory.findFirst({ where: { id: categoryId, OR: [{ accountId }, { accountId: null }] }, select: { id: true } });
  if (!category) throw new Error("Specialist category not found.");
}

async function assertSpecialistLevelBelongsToAccount(accountId: number, levelId: number) {
  const level = await prisma.specialistLevel.findFirst({ where: { id: levelId, OR: [{ accountId }, { accountId: null }] }, select: { id: true } });
  if (!level) throw new Error("Specialist level not found.");
}
