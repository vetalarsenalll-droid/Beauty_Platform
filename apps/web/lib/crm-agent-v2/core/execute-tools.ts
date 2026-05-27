import { Prisma, UserStatus } from "@prisma/client";
import { normalizeRuPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  confirmCrmAgentAction,
  getCrmAgentAction,
  markCrmAgentActionExecuted,
  markCrmAgentActionFailed,
  rejectCrmAgentAction,
} from "./persistence";
import type { CrmAgentToolContext, CrmAgentToolDefinition, CrmAgentToolHandler } from "./types";

type JsonRecord = Record<string, unknown>;

const executeToolHandlers: Partial<Record<string, CrmAgentToolHandler<JsonRecord, unknown>>> = {
  "actions.confirm": confirmAndExecuteAction,
  "actions.reject": rejectAction,
};

export function attachCrmAgentExecuteToolHandlers<T extends CrmAgentToolDefinition>(tools: T[]): T[] {
  return tools.map((tool) => {
    const handler = executeToolHandlers[tool.name];
    return handler ? { ...tool, handler } : tool;
  });
}

export function getCrmAgentExecuteToolHandler(name: string) {
  return executeToolHandlers[name] ?? null;
}

async function confirmAndExecuteAction(args: JsonRecord, ctx: CrmAgentToolContext) {
  const actionId = requiredNumber(args.actionId, "actionId");
  const action = await getCrmAgentAction({ accountId: ctx.accountId, actionId });
  if (!action) throw new Error("Action not found.");
  if (!canUsePermission(ctx.permissions, action.permission)) throw new Error(`Missing permission: ${action.permission}`);
  if (action.status === "EXECUTED") return { status: "EXECUTED", result: action.result };
  if (action.status === "REJECTED" || action.status === "FAILED" || action.status === "EXPIRED") {
    throw new Error(`Action cannot be executed from status ${action.status}.`);
  }

  await confirmCrmAgentAction({ accountId: ctx.accountId, actionId });

  try {
    const payload = jsonObject(action.payload);
    const result = await executeActionMutation(ctx, action.actionType, payload);
    await markCrmAgentActionExecuted({
      accountId: ctx.accountId,
      actionId,
      result: result as Prisma.InputJsonValue,
    });
    return { status: "EXECUTED", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action execution failed.";
    await markCrmAgentActionFailed({ accountId: ctx.accountId, actionId, error: message });
    return { status: "FAILED", error: message };
  }
}

async function rejectAction(args: JsonRecord, ctx: CrmAgentToolContext) {
  const actionId = requiredNumber(args.actionId, "actionId");
  const action = await getCrmAgentAction({ accountId: ctx.accountId, actionId });
  if (!action) throw new Error("Action not found.");
  if (!canUsePermission(ctx.permissions, action.permission)) throw new Error(`Missing permission: ${action.permission}`);
  const rejected = await rejectCrmAgentAction({
    accountId: ctx.accountId,
    actionId,
    error: typeof args.reason === "string" ? args.reason : null,
  });
  return { status: rejected?.status ?? "REJECTED", actionId };
}

async function executeActionMutation(ctx: CrmAgentToolContext, actionType: string, payload: JsonRecord) {
  if (actionType === "memory.update" || actionType === "autopilot.setting.update") {
    const key = requiredString(payload, "key");
    const memory = await prisma.crmAgentMemory.upsert({
      where: { accountId_key: { accountId: ctx.accountId, key } },
      create: {
        accountId: ctx.accountId,
        key,
        value: inputJson(payload.value ?? null),
        confidence: typeof payload.confidence === "number" ? payload.confidence : 1,
        source: typeof payload.source === "string" ? payload.source : "execute_tool",
      },
      update: {
        value: inputJson(payload.value ?? null),
        confidence: typeof payload.confidence === "number" ? payload.confidence : 1,
        source: typeof payload.source === "string" ? payload.source : "execute_tool",
      },
    });
    return { memoryId: memory.id };
  }

  if (actionType === "client.create") {
    const client = await prisma.client.create({
      data: {
        accountId: ctx.accountId,
        firstName: optionalString(payload, "firstName"),
        lastName: optionalString(payload, "lastName"),
        phone: optionalString(payload, "phone"),
        email: optionalString(payload, "email"),
        birthDate: optionalDate(payload, "birthDate"),
      },
    });
    return { clientId: client.id };
  }

  if (actionType === "client.update") {
    const clientId = requiredNumber(payload.clientId, "clientId");
    const updated = await prisma.client.updateMany({
      where: { id: clientId, accountId: ctx.accountId },
      data: {
        ...(payload.firstName !== undefined ? { firstName: optionalString(payload, "firstName") } : {}),
        ...(payload.lastName !== undefined ? { lastName: optionalString(payload, "lastName") } : {}),
        ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
        ...(payload.email !== undefined ? { email: optionalString(payload, "email") } : {}),
        ...(payload.birthDate !== undefined ? { birthDate: optionalDate(payload, "birthDate") } : {}),
      },
    });
    if (!updated.count) throw new Error("Client not found.");
    return { clientId };
  }

  if (actionType === "appointment.cancel") {
    const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, accountId: ctx.accountId },
      select: { id: true, status: true },
    });
    if (!appointment) throw new Error("Appointment not found.");
    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: "CANCELLED", comment: optionalString(payload, "comment") },
      }),
      prisma.appointmentStatusHistory.create({
        data: {
          appointmentId: appointment.id,
          actorType: "CRM_AGENT_V2",
          actorId: ctx.userId ? String(ctx.userId) : null,
          fromStatus: appointment.status,
          toStatus: "CANCELLED",
          comment: optionalString(payload, "comment"),
        },
      }),
    ]);
    return { appointmentId };
  }

  if (actionType === "appointment.create") {
    const serviceId = requiredNumber(payload.serviceId, "serviceId");
    const service = await prisma.service.findFirst({
      where: { id: serviceId, accountId: ctx.accountId, isActive: true },
      select: { id: true, basePrice: true, baseDurationMin: true },
    });
    if (!service) throw new Error("Service not found.");
    const startAt = requiredDate(payload, "startAt");
    const endAt = optionalDate(payload, "endAt") ?? new Date(startAt.getTime() + service.baseDurationMin * 60 * 1000);
    const clientId = requiredNumber(payload.clientId, "clientId");
    const specialistId = requiredNumber(payload.specialistId, "specialistId");
    const locationId = requiredNumber(payload.locationId, "locationId");
    await assertClientBelongsToAccount(ctx.accountId, clientId);
    await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
    await assertLocationBelongsToAccount(ctx.accountId, locationId);
    await assertServiceSpecialistBinding(service.id, specialistId);
    await assertServiceLocationBinding(service.id, locationId);
    await assertSlotAvailable(ctx.accountId, specialistId, locationId, startAt, endAt);
    const appointment = await prisma.appointment.create({
      data: {
        accountId: ctx.accountId,
        clientId,
        specialistId,
        locationId,
        startAt,
        endAt,
        status: "NEW",
        priceTotal: optionalString(payload, "priceTotal") ?? service.basePrice,
        durationTotalMin: numberOrNull(payload.durationTotalMin) ?? service.baseDurationMin,
        source: "CRM_AGENT_V2",
        comment: optionalString(payload, "comment"),
        services: {
          create: {
            serviceId: service.id,
            price: optionalString(payload, "priceTotal") ?? service.basePrice,
            durationMin: numberOrNull(payload.durationTotalMin) ?? service.baseDurationMin,
            specialistId,
          },
        },
        statusHistory: {
          create: {
            actorType: "CRM_AGENT_V2",
            actorId: ctx.userId ? String(ctx.userId) : null,
            toStatus: "NEW",
            comment: optionalString(payload, "comment"),
          },
        },
      },
    });
    return { appointmentId: appointment.id };
  }

  if (actionType === "service.create") {
    const categoryId = numberOrNull(payload.categoryId);
    if (categoryId != null) await assertServiceCategoryBelongsToAccount(ctx.accountId, categoryId);
    const service = await prisma.service.create({
      data: {
        accountId: ctx.accountId,
        categoryId,
        name: requiredString(payload, "name"),
        description: optionalString(payload, "description"),
        baseDurationMin: requiredNumber(payload.baseDurationMin, "baseDurationMin"),
        basePrice: requiredString(payload, "basePrice"),
        isActive: optionalBoolean(payload, "isActive") ?? true,
      },
    });
    return { serviceId: service.id };
  }

  if (actionType === "service.update" || actionType === "site.service.copy.update") {
    const serviceId = requiredNumber(payload.serviceId, "serviceId");
    if (payload.categoryId !== undefined) {
      const categoryId = numberOrNull(payload.categoryId);
      if (categoryId != null) await assertServiceCategoryBelongsToAccount(ctx.accountId, categoryId);
    }
    const updated = await prisma.service.updateMany({
      where: { id: serviceId, accountId: ctx.accountId },
      data: {
        ...(payload.categoryId !== undefined ? { categoryId: numberOrNull(payload.categoryId) } : {}),
        ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
        ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
        ...(payload.baseDurationMin !== undefined ? { baseDurationMin: requiredNumber(payload.baseDurationMin, "baseDurationMin") } : {}),
        ...(payload.basePrice !== undefined ? { basePrice: requiredString(payload, "basePrice") } : {}),
        ...(payload.isActive !== undefined ? { isActive: optionalBoolean(payload, "isActive") ?? true } : {}),
      },
    });
    if (!updated.count) throw new Error("Service not found.");
    return { serviceId };
  }

  if (actionType === "service.archive") {
    const serviceId = requiredNumber(payload.serviceId, "serviceId");
    const updated = await prisma.service.updateMany({ where: { id: serviceId, accountId: ctx.accountId }, data: { isActive: false } });
    if (!updated.count) throw new Error("Service not found.");
    return { serviceId };
  }

  if (actionType === "specialist.create") {
    const nameParts = splitSpecialistName(payload);
    const firstName = requiredResolvedString(nameParts.firstName, "firstName");
    const lastName = nameParts.lastName;
    const email = optionalString(payload, "email");
    const phoneRaw = optionalString(payload, "phone");
    const phone = phoneRaw ? normalizeRuPhone(phoneRaw) : null;
    if (phoneRaw && !phone) throw new Error("Action payload phone must be a valid Russian phone.");
    const levelId = numberOrNull(payload.levelId);
    const categoryIds = numberArray(payload.categoryIds);
    const status = optionalUserStatus(payload, "status") ?? UserStatus.INVITED;

    if (levelId != null) await assertSpecialistLevelBelongsToAccount(ctx.accountId, levelId);
    if (categoryIds.length) await assertSpecialistCategoriesBelongToAccount(ctx.accountId, categoryIds);

    const specialist = await prisma.$transaction(async (tx) => {
      const existingUser =
        email || phone
          ? await tx.user.findFirst({
              where: { OR: [email ? { email } : null, phone ? { phone } : null].filter((item): item is { email: string } | { phone: string } => Boolean(item)) },
              include: { profile: true },
            })
          : null;

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            phone,
            status,
            type: "STAFF",
          },
        }));

      if (existingUser) {
        if (user.type !== "STAFF") throw new Error("User is not a staff member.");
        await tx.user.update({
          where: { id: user.id },
          data: {
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
            ...(payload.status !== undefined ? { status } : {}),
          },
        });
      }

      const profile = await tx.userProfile.findUnique({ where: { userId: user.id } });
      if (profile) {
        await tx.userProfile.update({
          where: { id: profile.id },
          data: { firstName, lastName },
        });
      } else {
        await tx.userProfile.create({ data: { userId: user.id, firstName, lastName } });
      }

      const existingSpecialist = await tx.specialistProfile.findFirst({
        where: { accountId: ctx.accountId, userId: user.id },
        select: { id: true },
      });
      if (existingSpecialist) throw new Error("Specialist already exists.");

      let role = await tx.role.findFirst({ where: { accountId: ctx.accountId, name: "SPECIALIST" } });
      if (!role) {
        role = await tx.role.create({ data: { accountId: ctx.accountId, name: "SPECIALIST" } });
      }

      const existingAssignment = await tx.roleAssignment.findFirst({
        where: { accountId: ctx.accountId, userId: user.id },
        select: { id: true },
      });
      if (!existingAssignment) {
        await tx.roleAssignment.create({ data: { accountId: ctx.accountId, userId: user.id, roleId: role.id } });
      }

      const created = await tx.specialistProfile.create({
        data: {
          accountId: ctx.accountId,
          userId: user.id,
          levelId,
          bio: optionalString(payload, "bio"),
          isPublic: optionalBoolean(payload, "isPublic") ?? true,
        },
      });

      if (categoryIds.length) {
        await tx.specialistCategoryLink.createMany({
          data: categoryIds.map((categoryId) => ({ specialistId: created.id, categoryId })),
        });
      }

      return created;
    });

    return { specialistId: specialist.id };
  }

  if (actionType === "location.create") {
    const location = await prisma.location.create({
      data: {
        accountId: ctx.accountId,
        name: requiredString(payload, "name"),
        address: requiredString(payload, "address"),
        description: optionalString(payload, "description"),
        phone: optionalString(payload, "phone"),
        status: optionalString(payload, "status") ?? "ACTIVE",
      },
    });
    return { locationId: location.id };
  }

  if (actionType === "location.update") {
    const locationId = requiredNumber(payload.locationId, "locationId");
    const updated = await prisma.location.updateMany({
      where: { id: locationId, accountId: ctx.accountId },
      data: {
        ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
        ...(payload.address !== undefined ? { address: requiredString(payload, "address") } : {}),
        ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
        ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
        ...(payload.status !== undefined ? { status: requiredString(payload, "status") } : {}),
      },
    });
    if (!updated.count) throw new Error("Location not found.");
    return { locationId };
  }

  if (actionType === "review.reply") {
    const reviewId = requiredNumber(payload.reviewId, "reviewId");
    const updated = await prisma.review.updateMany({
      where: { id: reviewId, accountId: ctx.accountId },
      data: { replyText: requiredString(payload, "replyText"), repliedAt: new Date(), repliedByUserId: ctx.userId ?? null },
    });
    if (!updated.count) throw new Error("Review not found.");
    return { reviewId };
  }

  throw new Error(`Execute action is not implemented: ${actionType}`);
}

async function assertSlotAvailable(accountId: number, specialistId: number, locationId: number, startAt: Date, endAt: Date) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      accountId,
      specialistId,
      locationId,
      status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });
  if (appointment) throw new Error(`Appointment slot conflicts with appointment #${appointment.id}.`);

  const blocked = await prisma.blockedSlot.findFirst({
    where: {
      accountId,
      AND: [
        { OR: [{ specialistId }, { specialistId: null }] },
        { OR: [{ locationId }, { locationId: null }] },
      ],
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, reason: true },
  });
  if (blocked) throw new Error(`Appointment slot is blocked${blocked.reason ? `: ${blocked.reason}` : "."}`);
}

async function assertClientBelongsToAccount(accountId: number, clientId: number) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, accountId },
    select: { id: true },
  });
  if (!client) throw new Error("Client not found.");
}

async function assertSpecialistBelongsToAccount(accountId: number, specialistId: number) {
  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: specialistId, accountId },
    select: { id: true },
  });
  if (!specialist) throw new Error("Specialist not found.");
}

async function assertLocationBelongsToAccount(accountId: number, locationId: number) {
  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId },
    select: { id: true },
  });
  if (!location) throw new Error("Location not found.");
}

async function assertServiceCategoryBelongsToAccount(accountId: number, categoryId: number) {
  const category = await prisma.serviceCategory.findFirst({
    where: { id: categoryId, OR: [{ accountId }, { accountId: null }] },
    select: { id: true },
  });
  if (!category) throw new Error("Service category not found.");
}

async function assertSpecialistLevelBelongsToAccount(accountId: number, levelId: number) {
  const level = await prisma.specialistLevel.findFirst({
    where: { id: levelId, OR: [{ accountId }, { accountId: null }] },
    select: { id: true },
  });
  if (!level) throw new Error("Specialist level not found.");
}

async function assertSpecialistCategoriesBelongToAccount(accountId: number, categoryIds: number[]) {
  const categories = await prisma.specialistCategory.findMany({
    where: { accountId, id: { in: categoryIds } },
    select: { id: true },
  });
  if (categories.length !== categoryIds.length) throw new Error("Specialist category not found.");
}

async function assertServiceSpecialistBinding(serviceId: number, specialistId: number) {
  const binding = await prisma.specialistService.findFirst({
    where: { serviceId, specialistId },
    select: { specialistId: true },
  });
  if (!binding) throw new Error("Specialist is not assigned to service.");
}

async function assertServiceLocationBinding(serviceId: number, locationId: number) {
  const binding = await prisma.serviceLocation.findFirst({
    where: { serviceId, locationId },
    select: { locationId: true },
  });
  if (!binding) throw new Error("Service is not available at location.");
}

function canUsePermission(permissions: string[], permission: string | null) {
  return !permission || permissions.includes("crm.all") || permissions.includes(permission);
}

function jsonObject(value: unknown): JsonRecord {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as JsonRecord;
  throw new Error("Action payload must be an object.");
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function requiredString(payload: JsonRecord, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Action payload ${key} is required.`);
  return value.trim();
}

function requiredResolvedString(value: unknown, key: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Action payload ${key} is required.`);
  return value.trim();
}

function optionalString(payload: JsonRecord, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : null;
}

function requiredNumber(value: unknown, key: string) {
  const parsed = numberOrNull(value);
  if (parsed == null) throw new Error(`Action payload ${key} is required.`);
  return parsed;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0)));
}

function optionalBoolean(payload: JsonRecord, key: string) {
  const value = payload[key];
  return typeof value === "boolean" ? value : null;
}

function optionalUserStatus(payload: JsonRecord, key: string) {
  const value = optionalString(payload, key);
  if (!value) return null;
  if (value === UserStatus.ACTIVE || value === UserStatus.INVITED || value === UserStatus.DISABLED) return value;
  throw new Error(`Action payload ${key} must be ACTIVE, INVITED or DISABLED.`);
}

function optionalDate(payload: JsonRecord, key: string) {
  const value = optionalString(payload, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Action payload ${key} must be a valid date.`);
  return date;
}

function requiredDate(payload: JsonRecord, key: string) {
  const date = optionalDate(payload, key);
  if (!date) throw new Error(`Action payload ${key} is required.`);
  return date;
}

function splitSpecialistName(payload: JsonRecord) {
  const explicitFirstName = optionalString(payload, "firstName");
  const explicitLastName = optionalString(payload, "lastName");
  const fullName = optionalString(payload, "name") ?? [explicitLastName, explicitFirstName].filter(Boolean).join(" ");
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: explicitFirstName ?? parts[1] ?? parts[0] ?? "",
    lastName: explicitLastName ?? (parts.length > 1 ? parts[0] : null),
  };
}
