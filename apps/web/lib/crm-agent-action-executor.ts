import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getPendingActionForAccount,
  markPendingActionExecuted,
  markPendingActionFailed,
  upsertAccountMemory,
  writeAgentAudit,
} from "@/lib/crm-agent-persistence";

const executableActionTypes = new Set([
  "appointment.cancel",
  "appointment.create",
  "appointment.reschedule",
  "client.create",
  "client.update",
  "service.create",
  "service.update",
  "service.archive",
  "specialist.update",
  "specialist.schedule.update",
  "location.create",
  "location.update",
  "promo.create",
  "promo.update",
  "promo.archive",
  "review.reply",
  "notification.send",
  "notification.campaign.send",
  "site.service.copy.update",
  "site.specialist.copy.update",
  "site.home.copy.update",
  "site.seo.update",
  "memory.update",
  "autopilot.setting.update",
]);

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(payload: Prisma.JsonObject, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Action payload ${key} is required.`);
  return value.trim();
}

function optionalString(payload: Prisma.JsonObject, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : null;
}

function requiredNumber(payload: Prisma.JsonObject, key: string) {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Action payload ${key} is required.`);
  return value;
}

function optionalNumber(payload: Prisma.JsonObject, key: string) {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalBoolean(payload: Prisma.JsonObject, key: string) {
  const value = payload[key];
  return typeof value === "boolean" ? value : null;
}

function optionalDate(payload: Prisma.JsonObject, key: string) {
  const value = optionalString(payload, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Action payload ${key} must be a valid date.`);
  return date;
}

function requiredDate(payload: Prisma.JsonObject, key: string) {
  const date = optionalDate(payload, key);
  if (!date) throw new Error(`Action payload ${key} is required.`);
  return date;
}

function notificationChannel(value: string) {
  const normalized = value.toUpperCase();
  if (["IN_APP", "EMAIL", "TELEGRAM", "MAX", "PUSH", "SMS", "WEBHOOK", "SSE"].includes(normalized)) return normalized as never;
  throw new Error("Unsupported notification channel.");
}

function resultJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function jsonObject(value: Prisma.JsonValue): Prisma.JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}

function numberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number" && Number.isFinite(item)) : [];
}

function payloadDraftId(payload: Prisma.JsonObject) {
  const value = payload.draftId;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function markSiteDraftApplied(input: {
  accountId: number;
  payload: Prisma.JsonObject;
  result: Record<string, unknown>;
}) {
  const draftId = payloadDraftId(input.payload);
  if (!draftId) return;
  await prisma.aiAgentSiteDraft.updateMany({
    where: { id: draftId, accountId: input.accountId },
    data: {
      status: "APPLIED",
      result: resultJson(input.result),
      error: null,
    },
  });
}

async function markSiteDraftFailed(input: {
  accountId: number;
  payload: Prisma.JsonObject;
  error: string;
}) {
  const draftId = payloadDraftId(input.payload);
  if (!draftId) return;
  await prisma.aiAgentSiteDraft.updateMany({
    where: { id: draftId, accountId: input.accountId },
    data: {
      status: "FAILED",
      error: input.error,
    },
  });
}

async function assertClientMarketingConsent(input: { accountId: number; clientId: number }) {
  const consent = await prisma.clientConsent.findFirst({
    where: {
      clientId: input.clientId,
      client: { accountId: input.accountId },
      type: "marketing",
      grantedAt: { not: null },
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!consent) throw new Error("Client has no active marketing consent.");
}

async function filterClientsWithMarketingConsent(input: { accountId: number; clientIds: number[] }) {
  if (!input.clientIds.length) return { allowedClientIds: [], skippedClientIds: [] };
  const consents = await prisma.clientConsent.findMany({
    where: {
      clientId: { in: input.clientIds },
      client: { accountId: input.accountId },
      type: "marketing",
      grantedAt: { not: null },
      revokedAt: null,
    },
    select: { clientId: true },
  });
  const allowed = new Set(consents.map((consent) => consent.clientId));
  return {
    allowedClientIds: input.clientIds.filter((clientId) => allowed.has(clientId)),
    skippedClientIds: input.clientIds.filter((clientId) => !allowed.has(clientId)),
  };
}

async function assertAppointmentSlotAvailable(input: {
  accountId: number;
  appointmentIdToExclude?: number | null;
  specialistId: number;
  locationId: number;
  startAt: Date;
  endAt: Date;
}) {
  const conflictingAppointment = await prisma.appointment.findFirst({
    where: {
      accountId: input.accountId,
      ...(input.appointmentIdToExclude ? { id: { not: input.appointmentIdToExclude } } : {}),
      specialistId: input.specialistId,
      locationId: input.locationId,
      status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] },
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
    },
    select: { id: true, startAt: true, endAt: true },
  });
  if (conflictingAppointment) {
    throw new Error(`Appointment slot conflicts with appointment #${conflictingAppointment.id}.`);
  }

  const blockedSlot = await prisma.blockedSlot.findFirst({
    where: {
      accountId: input.accountId,
      AND: [
        { OR: [{ specialistId: input.specialistId }, { specialistId: null }] },
        { OR: [{ locationId: input.locationId }, { locationId: null }] },
      ],
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
    },
    select: { id: true, reason: true },
  });
  if (blockedSlot) {
    throw new Error(`Appointment slot is blocked${blockedSlot.reason ? `: ${blockedSlot.reason}` : "."}`);
  }
}

export function canExecuteCrmAgentAction(actionType: string) {
  return executableActionTypes.has(actionType);
}

export async function executeConfirmedCrmAgentAction(input: {
  accountId: number;
  actionId: number;
  userId: number;
}) {
  const action = await getPendingActionForAccount({
    accountId: input.accountId,
    actionId: input.actionId,
  });
  if (!action || action.status !== "CONFIRMED") return null;

  try {
    if (!isJsonObject(action.payload)) {
      throw new Error("Action payload must be an object.");
    }

    const payload = action.payload;
    let executionResult: Record<string, unknown> | null = null;

    if (action.actionType === "memory.update" || action.actionType === "autopilot.setting.update") {
      const key = typeof payload.key === "string" ? payload.key.trim() : "";
      if (!key) throw new Error("Action payload key is required.");

      const memory = await upsertAccountMemory({
        accountId: input.accountId,
        key,
        value: (payload.value ?? null) as Prisma.InputJsonValue,
        confidence: typeof payload.confidence === "number" ? payload.confidence : 1,
        source: typeof payload.source === "string" ? payload.source : "pending_action",
      });
      executionResult = { memoryId: memory.id };
    }

    if (action.actionType === "client.create") {
      const client = await prisma.client.create({
        data: {
          accountId: input.accountId,
          firstName: optionalString(payload, "firstName"),
          lastName: optionalString(payload, "lastName"),
          phone: optionalString(payload, "phone"),
          email: optionalString(payload, "email"),
          birthDate: optionalDate(payload, "birthDate"),
        },
      });
      executionResult = { clientId: client.id };
    }

    if (action.actionType === "client.update") {
      const clientId = requiredNumber(payload, "clientId");
      const client = await prisma.client.updateMany({
        where: { id: clientId, accountId: input.accountId },
        data: {
          ...(payload.firstName !== undefined ? { firstName: optionalString(payload, "firstName") } : {}),
          ...(payload.lastName !== undefined ? { lastName: optionalString(payload, "lastName") } : {}),
          ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
          ...(payload.email !== undefined ? { email: optionalString(payload, "email") } : {}),
          ...(payload.birthDate !== undefined ? { birthDate: optionalDate(payload, "birthDate") } : {}),
        },
      });
      if (!client.count) throw new Error("Client not found in account.");
      executionResult = { clientId };
    }

    if (action.actionType === "appointment.create") {
      const serviceId = requiredNumber(payload, "serviceId");
      const service = await prisma.service.findFirst({
        where: { id: serviceId, accountId: input.accountId, isActive: true },
        select: { id: true, basePrice: true, baseDurationMin: true },
      });
      if (!service) throw new Error("Service not found in account.");

      const startAt = requiredDate(payload, "startAt");
      const endAt = optionalDate(payload, "endAt") ?? new Date(startAt.getTime() + service.baseDurationMin * 60 * 1000);
      const specialistId = requiredNumber(payload, "specialistId");
      const locationId = requiredNumber(payload, "locationId");
      await assertAppointmentSlotAvailable({
        accountId: input.accountId,
        specialistId,
        locationId,
        startAt,
        endAt,
      });
      const appointment = await prisma.appointment.create({
        data: {
          accountId: input.accountId,
          clientId: requiredNumber(payload, "clientId"),
          specialistId,
          locationId,
          startAt,
          endAt,
          status: "NEW",
          priceTotal: optionalString(payload, "priceTotal") ?? service.basePrice,
          durationTotalMin: optionalNumber(payload, "durationTotalMin") ?? service.baseDurationMin,
          source: "CRM_AI_AGENT",
          comment: optionalString(payload, "comment"),
          services: {
            create: {
              serviceId: service.id,
              price: optionalString(payload, "priceTotal") ?? service.basePrice,
              durationMin: optionalNumber(payload, "durationTotalMin") ?? service.baseDurationMin,
              specialistId,
            },
          },
          statusHistory: {
            create: {
              actorType: "CRM_AI_AGENT",
              actorId: String(input.userId),
              toStatus: "NEW",
              comment: optionalString(payload, "comment"),
            },
          },
        },
      });
      executionResult = { appointmentId: appointment.id };
    }

    if (action.actionType === "appointment.reschedule") {
      const appointmentId = requiredNumber(payload, "appointmentId");
      const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, accountId: input.accountId },
        select: { id: true, status: true, durationTotalMin: true },
      });
      if (!appointment) throw new Error("Appointment not found in account.");
      const startAt = requiredDate(payload, "startAt");
      const endAt = optionalDate(payload, "endAt") ?? new Date(startAt.getTime() + appointment.durationTotalMin * 60 * 1000);
      const specialistId = payload.specialistId !== undefined ? requiredNumber(payload, "specialistId") : null;
      const locationId = payload.locationId !== undefined ? requiredNumber(payload, "locationId") : null;
      const current = await prisma.appointment.findUnique({
        where: { id: appointment.id },
        select: { specialistId: true, locationId: true },
      });
      if (!current) throw new Error("Appointment not found in account.");
      await assertAppointmentSlotAvailable({
        accountId: input.accountId,
        appointmentIdToExclude: appointment.id,
        specialistId: specialistId ?? current.specialistId,
        locationId: locationId ?? current.locationId,
        startAt,
        endAt,
      });
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          startAt,
          endAt,
          ...(specialistId != null ? { specialistId } : {}),
          ...(locationId != null ? { locationId } : {}),
          ...(payload.comment !== undefined ? { comment: optionalString(payload, "comment") } : {}),
        },
      });
      executionResult = { appointmentId };
    }

    if (action.actionType === "service.create") {
      const service = await prisma.service.create({
        data: {
          accountId: input.accountId,
          categoryId: optionalNumber(payload, "categoryId"),
          name: requiredString(payload, "name"),
          description: optionalString(payload, "description"),
          baseDurationMin: requiredNumber(payload, "baseDurationMin"),
          basePrice: requiredString(payload, "basePrice"),
          isActive: optionalBoolean(payload, "isActive") ?? true,
        },
      });
      executionResult = { serviceId: service.id };
    }

    if (action.actionType === "service.update" || action.actionType === "site.service.copy.update") {
      const serviceId = requiredNumber(payload, "serviceId");
      const service = await prisma.service.updateMany({
        where: { id: serviceId, accountId: input.accountId },
        data: {
          ...(payload.categoryId !== undefined ? { categoryId: optionalNumber(payload, "categoryId") } : {}),
          ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
          ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
          ...(payload.baseDurationMin !== undefined ? { baseDurationMin: requiredNumber(payload, "baseDurationMin") } : {}),
          ...(payload.basePrice !== undefined ? { basePrice: requiredString(payload, "basePrice") } : {}),
          ...(payload.isActive !== undefined ? { isActive: optionalBoolean(payload, "isActive") ?? true } : {}),
        },
      });
      if (!service.count) throw new Error("Service not found in account.");
      executionResult = { serviceId };
    }

    if (action.actionType === "service.archive") {
      const serviceId = requiredNumber(payload, "serviceId");
      const service = await prisma.service.updateMany({
        where: { id: serviceId, accountId: input.accountId },
        data: { isActive: false },
      });
      if (!service.count) throw new Error("Service not found in account.");
      executionResult = { serviceId };
    }

    if (action.actionType === "specialist.update" || action.actionType === "site.specialist.copy.update") {
      const specialistId = requiredNumber(payload, "specialistId");
      const specialist = await prisma.specialistProfile.updateMany({
        where: { id: specialistId, accountId: input.accountId },
        data: {
          ...(payload.bio !== undefined ? { bio: optionalString(payload, "bio") } : {}),
          ...(payload.isPublic !== undefined ? { isPublic: optionalBoolean(payload, "isPublic") ?? true } : {}),
        },
      });
      if (!specialist.count) throw new Error("Specialist not found in account.");
      executionResult = { specialistId };
    }

    if (action.actionType === "specialist.schedule.update") {
      const specialistId = requiredNumber(payload, "specialistId");
      const date = requiredDate(payload, "date");
      const specialist = await prisma.specialistProfile.findFirst({
        where: { id: specialistId, accountId: input.accountId },
        select: { id: true },
      });
      if (!specialist) throw new Error("Specialist not found in account.");
      const entry = await prisma.scheduleEntry.upsert({
        where: { specialistId_date: { specialistId, date } },
        create: {
          accountId: input.accountId,
          specialistId,
          locationId: optionalNumber(payload, "locationId"),
          date,
          type: (optionalString(payload, "type") ?? "WORKING") as never,
          startTime: optionalString(payload, "startTime"),
          endTime: optionalString(payload, "endTime"),
          notes: optionalString(payload, "notes"),
        },
        update: {
          ...(payload.locationId !== undefined ? { locationId: optionalNumber(payload, "locationId") } : {}),
          ...(payload.type !== undefined ? { type: requiredString(payload, "type") as never } : {}),
          ...(payload.startTime !== undefined ? { startTime: optionalString(payload, "startTime") } : {}),
          ...(payload.endTime !== undefined ? { endTime: optionalString(payload, "endTime") } : {}),
          ...(payload.notes !== undefined ? { notes: optionalString(payload, "notes") } : {}),
        },
      });
      executionResult = { scheduleEntryId: entry.id, specialistId };
    }

    if (action.actionType === "location.create") {
      const location = await prisma.location.create({
        data: {
          accountId: input.accountId,
          name: requiredString(payload, "name"),
          address: requiredString(payload, "address"),
          description: optionalString(payload, "description"),
          phone: optionalString(payload, "phone"),
          status: optionalString(payload, "status") || "ACTIVE",
        },
      });
      executionResult = { locationId: location.id };
    }

    if (action.actionType === "location.update") {
      const locationId = requiredNumber(payload, "locationId");
      const location = await prisma.location.updateMany({
        where: { id: locationId, accountId: input.accountId },
        data: {
          ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
          ...(payload.address !== undefined ? { address: requiredString(payload, "address") } : {}),
          ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
          ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
          ...(payload.status !== undefined ? { status: requiredString(payload, "status") } : {}),
        },
      });
      if (!location.count) throw new Error("Location not found in account.");
      executionResult = { locationId };
    }

    if (action.actionType === "promo.create") {
      const promotion = await prisma.promotion.create({
        data: {
          accountId: input.accountId,
          name: requiredString(payload, "name"),
          type: requiredString(payload, "type") as never,
          value: requiredString(payload, "value"),
          startsAt: optionalString(payload, "startsAt") ? new Date(requiredString(payload, "startsAt")) : null,
          endsAt: optionalString(payload, "endsAt") ? new Date(requiredString(payload, "endsAt")) : null,
          isActive: optionalBoolean(payload, "isActive") ?? true,
        },
      });
      executionResult = { promotionId: promotion.id };
    }

    if (action.actionType === "promo.archive") {
      const promotionId = requiredNumber(payload, "promotionId");
      const promotion = await prisma.promotion.updateMany({
        where: { id: promotionId, accountId: input.accountId },
        data: { isActive: false },
      });
      if (!promotion.count) throw new Error("Promotion not found in account.");
      executionResult = { promotionId };
    }

    if (action.actionType === "promo.update") {
      const promotionId = requiredNumber(payload, "promotionId");
      const promotion = await prisma.promotion.updateMany({
        where: { id: promotionId, accountId: input.accountId },
        data: {
          ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
          ...(payload.type !== undefined ? { type: requiredString(payload, "type") as never } : {}),
          ...(payload.value !== undefined ? { value: requiredString(payload, "value") } : {}),
          ...(payload.startsAt !== undefined ? { startsAt: optionalDate(payload, "startsAt") } : {}),
          ...(payload.endsAt !== undefined ? { endsAt: optionalDate(payload, "endsAt") } : {}),
          ...(payload.isActive !== undefined ? { isActive: optionalBoolean(payload, "isActive") ?? true } : {}),
        },
      });
      if (!promotion.count) throw new Error("Promotion not found in account.");
      executionResult = { promotionId };
    }

    if (action.actionType === "review.reply") {
      const reviewId = requiredNumber(payload, "reviewId");
      const replyText = requiredString(payload, "replyText");
      const review = await prisma.review.updateMany({
        where: { id: reviewId, accountId: input.accountId },
        data: { replyText, repliedAt: new Date(), repliedByUserId: input.userId },
      });
      if (!review.count) throw new Error("Review not found in account.");
      executionResult = { reviewId };
    }

    if (action.actionType === "notification.send") {
      const clientId = requiredNumber(payload, "clientId");
      const client = await prisma.client.findFirst({
        where: { id: clientId, accountId: input.accountId },
        select: { id: true, userId: true, phone: true, email: true },
      });
      if (!client) throw new Error("Client not found in account.");
      await assertClientMarketingConsent({ accountId: input.accountId, clientId });
      const channel = notificationChannel(requiredString(payload, "channel"));
      const bodyText = requiredString(payload, "bodyText");
      const outbox = await prisma.outboxItem.create({
        data: {
          scope: "ACCOUNT",
          accountId: input.accountId,
          userId: client.userId,
          eventName: "crm_agent.notification.send",
          payload: {
            channel,
            clientId,
            title: optionalString(payload, "title"),
            bodyText,
            phone: client.phone,
            email: client.email,
            consentType: "marketing",
            consentCheckedAt: new Date().toISOString(),
          },
          dedupeKey: `crm-agent-notification-${action.id}-${clientId}`,
        },
      });
      executionResult = { outboxItemId: outbox.id, clientId };
    }

    if (action.actionType === "notification.campaign.send") {
      const campaignId = requiredNumber(payload, "campaignId");
      const draft = await prisma.aiAgentNotificationDraft.findFirst({
        where: { campaignId, accountId: input.accountId },
        select: { id: true, channel: true, audience: true, bodyText: true, title: true },
      });
      if (!draft) throw new Error("Notification draft not found in account.");
      const audience = jsonObject(draft.audience);
      const clientIds = numberArray(audience?.clientIds);
      const { allowedClientIds, skippedClientIds } = await filterClientsWithMarketingConsent({
        accountId: input.accountId,
        clientIds,
      });
      if (clientIds.length && !allowedClientIds.length) {
        throw new Error("Campaign has no recipients with active marketing consent.");
      }
      const outbox = await prisma.outboxItem.create({
        data: {
          scope: "ACCOUNT",
          accountId: input.accountId,
          eventName: "crm_agent.notification.campaign.send",
          payload: {
            campaignId,
            draftId: draft.id,
            channel: draft.channel,
            audience: audience
              ? {
                  ...audience,
                  clientIds: allowedClientIds,
                  skippedClientIds,
                  originalSize: clientIds.length,
                }
              : draft.audience,
            bodyText: draft.bodyText,
            title: draft.title,
            consentType: "marketing",
            consentCheckedAt: new Date().toISOString(),
          },
          dedupeKey: `crm-agent-campaign-${action.id}-${campaignId}`,
        },
      });
      await prisma.aiAgentCampaign.updateMany({
        where: { id: campaignId, accountId: input.accountId },
        data: { status: "SCHEDULED" },
      });
      executionResult = { campaignId, outboxItemId: outbox.id, recipients: allowedClientIds.length, skipped: skippedClientIds.length };
    }

    if (action.actionType === "appointment.cancel") {
      const appointmentId = requiredNumber(payload, "appointmentId");
      const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, accountId: input.accountId },
        select: { id: true, status: true },
      });
      if (!appointment) throw new Error("Appointment not found in account.");
      await prisma.$transaction([
        prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: "CANCELLED", comment: optionalString(payload, "comment") },
        }),
        prisma.appointmentStatusHistory.create({
          data: {
            appointmentId: appointment.id,
            actorType: "CRM_AI_AGENT",
            actorId: String(input.userId),
            fromStatus: appointment.status,
            toStatus: "CANCELLED",
            comment: optionalString(payload, "comment"),
          },
        }),
      ]);
      executionResult = { appointmentId };
    }

    if (action.actionType === "site.home.copy.update") {
      const profile = await prisma.accountProfile.upsert({
        where: { accountId: input.accountId },
        create: {
          accountId: input.accountId,
          description: optionalString(payload, "description"),
          phone: optionalString(payload, "phone"),
          email: optionalString(payload, "email"),
          address: optionalString(payload, "address"),
        },
        update: {
          ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
          ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
          ...(payload.email !== undefined ? { email: optionalString(payload, "email") } : {}),
          ...(payload.address !== undefined ? { address: optionalString(payload, "address") } : {}),
        },
      });
      executionResult = { accountProfileId: profile.id };
    }

    if (action.actionType === "site.seo.update") {
      const pageKey = optionalString(payload, "pageKey");
      if (pageKey) {
        const seoPage = await prisma.seoPageSetting.upsert({
          where: { accountId_pageKey: { accountId: input.accountId, pageKey } },
          create: {
            accountId: input.accountId,
            pageKey,
            title: optionalString(payload, "title"),
            description: optionalString(payload, "description"),
            keywords: optionalString(payload, "keywords"),
            canonicalUrl: optionalString(payload, "canonicalUrl"),
            noIndex: optionalBoolean(payload, "noIndex") ?? false,
            noFollow: optionalBoolean(payload, "noFollow") ?? false,
          },
          update: {
            ...(payload.title !== undefined ? { title: optionalString(payload, "title") } : {}),
            ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
            ...(payload.keywords !== undefined ? { keywords: optionalString(payload, "keywords") } : {}),
            ...(payload.canonicalUrl !== undefined ? { canonicalUrl: optionalString(payload, "canonicalUrl") } : {}),
            ...(payload.noIndex !== undefined ? { noIndex: optionalBoolean(payload, "noIndex") ?? false } : {}),
            ...(payload.noFollow !== undefined ? { noFollow: optionalBoolean(payload, "noFollow") ?? false } : {}),
          },
        });
        executionResult = { seoPageSettingId: seoPage.id, pageKey };
      } else {
        const seo = await prisma.seoSetting.upsert({
          where: { accountId: input.accountId },
          create: {
            accountId: input.accountId,
            title: optionalString(payload, "title"),
            description: optionalString(payload, "description"),
            ogImageUrl: optionalString(payload, "ogImageUrl"),
            robots: optionalString(payload, "robots"),
          },
          update: {
            ...(payload.title !== undefined ? { title: optionalString(payload, "title") } : {}),
            ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
            ...(payload.ogImageUrl !== undefined ? { ogImageUrl: optionalString(payload, "ogImageUrl") } : {}),
            ...(payload.robots !== undefined ? { robots: optionalString(payload, "robots") } : {}),
          },
        });
        executionResult = { seoSettingId: seo.id };
      }
    }

    if (executionResult) {
      if (action.actionType.startsWith("site.")) {
        await markSiteDraftApplied({
          accountId: input.accountId,
          payload,
          result: executionResult,
        });
      }

      await writeAgentAudit({
        accountId: input.accountId,
        userId: input.userId,
        action: "ai_agent.action.execute",
        targetType: "ai_pending_action",
        targetId: String(action.id),
        data: { actionType: action.actionType, ...executionResult },
      });

      await markPendingActionExecuted({
        accountId: input.accountId,
        actionId: input.actionId,
        result: resultJson(executionResult),
      });

      return { status: "EXECUTED", result: executionResult };
    }

    return { status: "CONFIRMED" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action execution failed.";
    if (isJsonObject(action.payload) && action.actionType.startsWith("site.")) {
      await markSiteDraftFailed({
        accountId: input.accountId,
        payload: action.payload,
        error: message,
      });
    }
    await markPendingActionFailed({
      accountId: input.accountId,
      actionId: input.actionId,
      error: message,
    });
    return { status: "FAILED", error: message };
  }
}
