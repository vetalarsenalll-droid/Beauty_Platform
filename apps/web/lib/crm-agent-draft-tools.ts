import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPendingAction, writeAgentAudit } from "@/lib/crm-agent-persistence";
import type { CrmAgentScope, CrmAgentToolDefinition } from "@/lib/crm-agent-types";

function stringArg(args: Prisma.JsonObject, key: string) {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberArg(args: Prisma.JsonObject, key: string) {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanArg(args: Prisma.JsonObject, key: string) {
  const value = args[key];
  return typeof value === "boolean" ? value : null;
}

function requiredString(args: Prisma.JsonObject, key: string) {
  const value = stringArg(args, key);
  if (!value) throw new Error(`Для черновика нужно поле ${key}.`);
  return value;
}

function requiredNumber(args: Prisma.JsonObject, key: string) {
  const value = numberArg(args, key);
  if (value == null) throw new Error(`Для черновика нужно поле ${key}.`);
  return value;
}

function optionalDateString(args: Prisma.JsonObject, key: string) {
  const value = stringArg(args, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Поле ${key} должно быть датой.`);
  return date.toISOString();
}

function requiredDateString(args: Prisma.JsonObject, key: string) {
  const value = optionalDateString(args, key);
  if (!value) throw new Error(`Для черновика нужно поле ${key}.`);
  return value;
}

function hasPermission(scope: CrmAgentScope, permission: string) {
  return scope.permissions.includes("crm.all") || scope.permissions.includes(permission);
}

function assertPermission(scope: CrmAgentScope, permission: string) {
  if (!hasPermission(scope, permission)) throw new Error(`Недостаточно прав: ${permission}`);
}

function jsonValue(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

async function createDraftAction(input: {
  scope: CrmAgentScope;
  actionType: string;
  summary: string;
  payload: Prisma.InputJsonValue;
  permission: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  targetType: string;
  targetId?: string | null;
}) {
  assertPermission(input.scope, input.permission);
  const action = await createPendingAction({
    accountId: input.scope.accountId,
    userId: input.scope.userId,
    threadId: input.scope.threadId ?? null,
    actionType: input.actionType,
    summary: input.summary,
    payload: input.payload,
    riskLevel: input.riskLevel ?? "medium",
    permission: input.permission,
  });
  await writeAgentAudit({
    accountId: input.scope.accountId,
    userId: input.scope.userId,
    action: "ai_agent.draft_tool.prepare",
    targetType: input.targetType,
    targetId: input.targetId ?? String(action.id),
    data: { actionId: action.id, actionType: input.actionType, permission: input.permission },
  });
  return jsonValue({ pendingActionId: action.id, status: action.status, actionType: action.actionType, summary: action.summary });
}

async function assertClient(accountId: number, clientId: number) {
  const client = await prisma.client.findFirst({ where: { id: clientId, accountId }, select: { id: true } });
  if (!client) throw new Error("Клиент не найден в аккаунте.");
}

async function assertReview(accountId: number, reviewId: number) {
  const review = await prisma.review.findFirst({ where: { id: reviewId, accountId }, select: { id: true } });
  if (!review) throw new Error("Review was not found in account.");
}

async function assertCampaign(accountId: number, campaignId: number) {
  const campaign = await prisma.aiAgentCampaign.findFirst({ where: { id: campaignId, accountId }, select: { id: true } });
  if (!campaign) throw new Error("Campaign was not found in account.");
}

export async function draftClientCreate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const firstName = stringArg(args, "firstName");
  const lastName = stringArg(args, "lastName");
  const phone = stringArg(args, "phone");
  const email = stringArg(args, "email");
  if (!firstName && !lastName && !phone && !email) throw new Error("Client draft needs at least a name, phone or email.");
  return createDraftAction({
    scope,
    actionType: "client.create",
    summary: `Create client ${[firstName, lastName].filter(Boolean).join(" ") || phone || email}`,
    payload: {
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(optionalDateString(args, "birthDate") ? { birthDate: optionalDateString(args, "birthDate") } : {}),
    },
    permission: "crm.clients.create",
    riskLevel: "medium",
    targetType: "client",
  });
}

export async function draftClientUpdate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const clientId = requiredNumber(args, "clientId");
  await assertClient(scope.accountId, clientId);
  return createDraftAction({
    scope,
    actionType: "client.update",
    summary: `Update client #${clientId}`,
    payload: {
      clientId,
      ...(args.firstName !== undefined ? { firstName: stringArg(args, "firstName") } : {}),
      ...(args.lastName !== undefined ? { lastName: stringArg(args, "lastName") } : {}),
      ...(args.phone !== undefined ? { phone: stringArg(args, "phone") } : {}),
      ...(args.email !== undefined ? { email: stringArg(args, "email") } : {}),
      ...(args.birthDate !== undefined ? { birthDate: optionalDateString(args, "birthDate") } : {}),
    },
    permission: "crm.clients.update",
    riskLevel: "medium",
    targetType: "client",
    targetId: String(clientId),
  });
}

async function assertService(accountId: number, serviceId: number) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, accountId },
    select: { id: true, name: true, baseDurationMin: true, basePrice: true, isActive: true },
  });
  if (!service) throw new Error("Услуга не найдена в аккаунте.");
  return service;
}

async function assertSpecialist(accountId: number, specialistId: number) {
  const specialist = await prisma.specialistProfile.findFirst({ where: { id: specialistId, accountId }, select: { id: true } });
  if (!specialist) throw new Error("Сотрудник не найден в аккаунте.");
}

async function assertLocation(accountId: number, locationId: number) {
  const location = await prisma.location.findFirst({ where: { id: locationId, accountId }, select: { id: true } });
  if (!location) throw new Error("Локация не найдена в аккаунте.");
}

async function assertAppointment(accountId: number, appointmentId: number) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, accountId },
    select: { id: true, durationTotalMin: true, specialistId: true, locationId: true },
  });
  if (!appointment) throw new Error("Запись не найдена в аккаунте.");
  return appointment;
}

export async function draftAppointmentCreate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const clientId = requiredNumber(args, "clientId");
  const serviceId = requiredNumber(args, "serviceId");
  const specialistId = requiredNumber(args, "specialistId");
  const locationId = requiredNumber(args, "locationId");
  await Promise.all([
    assertClient(scope.accountId, clientId),
    assertService(scope.accountId, serviceId),
    assertSpecialist(scope.accountId, specialistId),
    assertLocation(scope.accountId, locationId),
  ]);

  const startAt = requiredDateString(args, "startAt");
  const payload = {
    clientId,
    serviceId,
    specialistId,
    locationId,
    startAt,
    ...(optionalDateString(args, "endAt") ? { endAt: optionalDateString(args, "endAt") } : {}),
    ...(numberArg(args, "durationTotalMin") != null ? { durationTotalMin: numberArg(args, "durationTotalMin") } : {}),
    ...(stringArg(args, "priceTotal") ? { priceTotal: stringArg(args, "priceTotal") } : {}),
    ...(stringArg(args, "comment") ? { comment: stringArg(args, "comment") } : {}),
  };
  return createDraftAction({
    scope,
    actionType: "appointment.create",
    summary: `Создать запись клиента #${clientId} на ${startAt}`,
    payload,
    permission: "crm.appointments.create",
    riskLevel: "high",
    targetType: "appointment",
  });
}

export async function draftAppointmentReschedule(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const appointmentId = requiredNumber(args, "appointmentId");
  await assertAppointment(scope.accountId, appointmentId);
  const startAt = requiredDateString(args, "startAt");
  const specialistId = numberArg(args, "specialistId");
  const locationId = numberArg(args, "locationId");
  if (specialistId != null) await assertSpecialist(scope.accountId, specialistId);
  if (locationId != null) await assertLocation(scope.accountId, locationId);

  return createDraftAction({
    scope,
    actionType: "appointment.reschedule",
    summary: `Перенести запись #${appointmentId} на ${startAt}`,
    payload: {
      appointmentId,
      startAt,
      ...(optionalDateString(args, "endAt") ? { endAt: optionalDateString(args, "endAt") } : {}),
      ...(specialistId != null ? { specialistId } : {}),
      ...(locationId != null ? { locationId } : {}),
      ...(stringArg(args, "comment") ? { comment: stringArg(args, "comment") } : {}),
    },
    permission: "crm.appointments.reschedule",
    riskLevel: "high",
    targetType: "appointment",
    targetId: String(appointmentId),
  });
}

export async function draftAppointmentCancel(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const appointmentId = requiredNumber(args, "appointmentId");
  await assertAppointment(scope.accountId, appointmentId);
  return createDraftAction({
    scope,
    actionType: "appointment.cancel",
    summary: `Отменить запись #${appointmentId}`,
    payload: { appointmentId, ...(stringArg(args, "comment") ? { comment: stringArg(args, "comment") } : {}) },
    permission: "crm.appointments.cancel",
    riskLevel: "high",
    targetType: "appointment",
    targetId: String(appointmentId),
  });
}

export async function draftServiceCreate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const name = requiredString(args, "name");
  return createDraftAction({
    scope,
    actionType: "service.create",
    summary: `Создать услугу «${name}»`,
    payload: {
      name,
      baseDurationMin: requiredNumber(args, "baseDurationMin"),
      basePrice: requiredString(args, "basePrice"),
      ...(numberArg(args, "categoryId") != null ? { categoryId: numberArg(args, "categoryId") } : {}),
      ...(stringArg(args, "description") ? { description: stringArg(args, "description") } : {}),
      ...(booleanArg(args, "isActive") != null ? { isActive: booleanArg(args, "isActive") } : {}),
    },
    permission: "crm.services.create",
    riskLevel: "medium",
    targetType: "service",
  });
}

export async function draftServiceUpdate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const serviceId = requiredNumber(args, "serviceId");
  await assertService(scope.accountId, serviceId);
  return createDraftAction({
    scope,
    actionType: "service.update",
    summary: `Обновить услугу #${serviceId}`,
    payload: {
      serviceId,
      ...(numberArg(args, "categoryId") != null ? { categoryId: numberArg(args, "categoryId") } : {}),
      ...(stringArg(args, "name") ? { name: stringArg(args, "name") } : {}),
      ...(args.description !== undefined ? { description: stringArg(args, "description") } : {}),
      ...(numberArg(args, "baseDurationMin") != null ? { baseDurationMin: numberArg(args, "baseDurationMin") } : {}),
      ...(stringArg(args, "basePrice") ? { basePrice: stringArg(args, "basePrice") } : {}),
      ...(booleanArg(args, "isActive") != null ? { isActive: booleanArg(args, "isActive") } : {}),
    },
    permission: "crm.services.update",
    riskLevel: "medium",
    targetType: "service",
    targetId: String(serviceId),
  });
}

export async function draftServiceArchive(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const serviceId = requiredNumber(args, "serviceId");
  await assertService(scope.accountId, serviceId);
  return createDraftAction({
    scope,
    actionType: "service.archive",
    summary: `Архивировать услугу #${serviceId}`,
    payload: { serviceId },
    permission: "crm.services.delete",
    riskLevel: "high",
    targetType: "service",
    targetId: String(serviceId),
  });
}

export async function draftSpecialistUpdate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const specialistId = requiredNumber(args, "specialistId");
  await assertSpecialist(scope.accountId, specialistId);
  return createDraftAction({
    scope,
    actionType: "specialist.update",
    summary: `Обновить карточку сотрудника #${specialistId}`,
    payload: {
      specialistId,
      ...(args.bio !== undefined ? { bio: stringArg(args, "bio") } : {}),
      ...(booleanArg(args, "isPublic") != null ? { isPublic: booleanArg(args, "isPublic") } : {}),
    },
    permission: "crm.specialists.update",
    riskLevel: "medium",
    targetType: "specialist",
    targetId: String(specialistId),
  });
}

export async function draftSpecialistScheduleUpdate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const specialistId = requiredNumber(args, "specialistId");
  const locationId = numberArg(args, "locationId");
  await assertSpecialist(scope.accountId, specialistId);
  if (locationId != null) await assertLocation(scope.accountId, locationId);
  return createDraftAction({
    scope,
    actionType: "specialist.schedule.update",
    summary: `Обновить график сотрудника #${specialistId}`,
    payload: {
      specialistId,
      date: requiredDateString(args, "date"),
      ...(locationId != null ? { locationId } : {}),
      ...(stringArg(args, "type") ? { type: stringArg(args, "type") } : {}),
      ...(args.startTime !== undefined ? { startTime: stringArg(args, "startTime") } : {}),
      ...(args.endTime !== undefined ? { endTime: stringArg(args, "endTime") } : {}),
      ...(args.notes !== undefined ? { notes: stringArg(args, "notes") } : {}),
    },
    permission: "crm.schedule.update",
    riskLevel: "high",
    targetType: "schedule",
    targetId: String(specialistId),
  });
}

export async function draftLocationCreate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const name = requiredString(args, "name");
  return createDraftAction({
    scope,
    actionType: "location.create",
    summary: `Создать локацию «${name}»`,
    payload: {
      name,
      address: requiredString(args, "address"),
      ...(stringArg(args, "description") ? { description: stringArg(args, "description") } : {}),
      ...(stringArg(args, "phone") ? { phone: stringArg(args, "phone") } : {}),
      ...(stringArg(args, "status") ? { status: stringArg(args, "status") } : {}),
    },
    permission: "crm.locations.create",
    riskLevel: "medium",
    targetType: "location",
  });
}

export async function draftLocationUpdate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const locationId = requiredNumber(args, "locationId");
  await assertLocation(scope.accountId, locationId);
  return createDraftAction({
    scope,
    actionType: "location.update",
    summary: `Обновить локацию #${locationId}`,
    payload: {
      locationId,
      ...(stringArg(args, "name") ? { name: stringArg(args, "name") } : {}),
      ...(stringArg(args, "address") ? { address: stringArg(args, "address") } : {}),
      ...(args.description !== undefined ? { description: stringArg(args, "description") } : {}),
      ...(args.phone !== undefined ? { phone: stringArg(args, "phone") } : {}),
      ...(stringArg(args, "status") ? { status: stringArg(args, "status") } : {}),
    },
    permission: "crm.locations.update",
    riskLevel: "medium",
    targetType: "location",
    targetId: String(locationId),
  });
}

export async function draftPromoCreate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const name = requiredString(args, "name");
  return createDraftAction({
    scope,
    actionType: "promo.create",
    summary: `Создать акцию «${name}»`,
    payload: {
      name,
      type: requiredString(args, "type"),
      value: requiredString(args, "value"),
      ...(optionalDateString(args, "startsAt") ? { startsAt: optionalDateString(args, "startsAt") } : {}),
      ...(optionalDateString(args, "endsAt") ? { endsAt: optionalDateString(args, "endsAt") } : {}),
      ...(booleanArg(args, "isActive") != null ? { isActive: booleanArg(args, "isActive") } : {}),
    },
    permission: "crm.promos.create",
    riskLevel: "medium",
    targetType: "promo",
  });
}

async function assertPromo(accountId: number, promotionId: number) {
  const promotion = await prisma.promotion.findFirst({ where: { id: promotionId, accountId }, select: { id: true } });
  if (!promotion) throw new Error("Акция не найдена в аккаунте.");
}

export async function draftPromoUpdate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const promotionId = requiredNumber(args, "promotionId");
  await assertPromo(scope.accountId, promotionId);
  return createDraftAction({
    scope,
    actionType: "promo.update",
    summary: `Обновить акцию #${promotionId}`,
    payload: {
      promotionId,
      ...(stringArg(args, "name") ? { name: stringArg(args, "name") } : {}),
      ...(stringArg(args, "type") ? { type: stringArg(args, "type") } : {}),
      ...(stringArg(args, "value") ? { value: stringArg(args, "value") } : {}),
      ...(args.startsAt !== undefined ? { startsAt: optionalDateString(args, "startsAt") } : {}),
      ...(args.endsAt !== undefined ? { endsAt: optionalDateString(args, "endsAt") } : {}),
      ...(booleanArg(args, "isActive") != null ? { isActive: booleanArg(args, "isActive") } : {}),
    },
    permission: "crm.promos.update",
    riskLevel: "medium",
    targetType: "promo",
    targetId: String(promotionId),
  });
}

export async function draftPromoArchive(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const promotionId = requiredNumber(args, "promotionId");
  await assertPromo(scope.accountId, promotionId);
  return createDraftAction({
    scope,
    actionType: "promo.archive",
    summary: `Архивировать акцию #${promotionId}`,
    payload: { promotionId },
    permission: "crm.promos.update",
    riskLevel: "high",
    targetType: "promo",
    targetId: String(promotionId),
  });
}

export async function draftReviewReply(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const reviewId = requiredNumber(args, "reviewId");
  await assertReview(scope.accountId, reviewId);
  return createDraftAction({
    scope,
    actionType: "review.reply",
    summary: `Reply to review #${reviewId}`,
    payload: { reviewId, replyText: requiredString(args, "replyText") },
    permission: "crm.reviews.manage",
    riskLevel: "medium",
    targetType: "review",
    targetId: String(reviewId),
  });
}

export async function draftNotificationSend(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const clientId = requiredNumber(args, "clientId");
  await assertClient(scope.accountId, clientId);
  return createDraftAction({
    scope,
    actionType: "notification.send",
    summary: `Send notification to client #${clientId}`,
    payload: {
      clientId,
      channel: requiredString(args, "channel"),
      bodyText: requiredString(args, "bodyText"),
      ...(stringArg(args, "title") ? { title: stringArg(args, "title") } : {}),
    },
    permission: "crm.assistant.campaigns.manage",
    riskLevel: "high",
    targetType: "notification",
    targetId: String(clientId),
  });
}

export async function draftCampaignNotificationSend(args: Prisma.JsonObject, scope: CrmAgentScope) {
  const campaignId = requiredNumber(args, "campaignId");
  await assertCampaign(scope.accountId, campaignId);
  return createDraftAction({
    scope,
    actionType: "notification.campaign.send",
    summary: `Send campaign #${campaignId}`,
    payload: { campaignId },
    permission: "crm.assistant.campaigns.manage",
    riskLevel: "high",
    targetType: "ai_agent_campaign",
    targetId: String(campaignId),
  });
}

export async function draftSiteHomeCopyUpdate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  return createDraftAction({
    scope,
    actionType: "site.home.copy.update",
    summary: "Update site home copy",
    payload: {
      ...(args.description !== undefined ? { description: stringArg(args, "description") } : {}),
      ...(args.phone !== undefined ? { phone: stringArg(args, "phone") } : {}),
      ...(args.email !== undefined ? { email: stringArg(args, "email") } : {}),
      ...(args.address !== undefined ? { address: stringArg(args, "address") } : {}),
    },
    permission: "crm.settings.update",
    riskLevel: "medium",
    targetType: "site",
  });
}

export async function draftSiteSeoUpdate(args: Prisma.JsonObject, scope: CrmAgentScope) {
  return createDraftAction({
    scope,
    actionType: "site.seo.update",
    summary: "Update site SEO",
    payload: {
      ...(args.pageKey !== undefined ? { pageKey: stringArg(args, "pageKey") } : {}),
      ...(args.title !== undefined ? { title: stringArg(args, "title") } : {}),
      ...(args.description !== undefined ? { description: stringArg(args, "description") } : {}),
      ...(args.keywords !== undefined ? { keywords: stringArg(args, "keywords") } : {}),
      ...(args.canonicalUrl !== undefined ? { canonicalUrl: stringArg(args, "canonicalUrl") } : {}),
      ...(args.ogImageUrl !== undefined ? { ogImageUrl: stringArg(args, "ogImageUrl") } : {}),
      ...(args.robots !== undefined ? { robots: stringArg(args, "robots") } : {}),
      ...(booleanArg(args, "noIndex") != null ? { noIndex: booleanArg(args, "noIndex") } : {}),
      ...(booleanArg(args, "noFollow") != null ? { noFollow: booleanArg(args, "noFollow") } : {}),
    },
    permission: "crm.settings.update",
    riskLevel: "medium",
    targetType: "site",
  });
}

export function attachCrmAgentDraftHandlers(tools: CrmAgentToolDefinition[]): CrmAgentToolDefinition[] {
  const handlers: Record<string, CrmAgentToolDefinition["handler"]> = {
    "clients.draftCreate": draftClientCreate,
    "clients.draftUpdate": draftClientUpdate,
    "appointments.draftCreate": draftAppointmentCreate,
    "appointments.draftReschedule": draftAppointmentReschedule,
    "appointments.draftCancel": draftAppointmentCancel,
    "services.draftCreate": draftServiceCreate,
    "services.draftUpdate": draftServiceUpdate,
    "services.draftArchive": draftServiceArchive,
    "specialists.draftUpdate": draftSpecialistUpdate,
    "specialists.draftScheduleUpdate": draftSpecialistScheduleUpdate,
    "locations.draftCreate": draftLocationCreate,
    "locations.draftUpdate": draftLocationUpdate,
    "promos.draftCreate": draftPromoCreate,
    "promos.draftUpdate": draftPromoUpdate,
    "promos.draftArchive": draftPromoArchive,
    "reviews.draftReply": draftReviewReply,
    "notifications.draftSend": draftNotificationSend,
    "notifications.draftCampaignSend": draftCampaignNotificationSend,
    "site.draftHomeCopyUpdate": draftSiteHomeCopyUpdate,
    "site.draftSeoUpdate": draftSiteSeoUpdate,
  };

  return tools.map((tool) => ({ ...tool, handler: handlers[tool.name] ?? tool.handler }));
}
