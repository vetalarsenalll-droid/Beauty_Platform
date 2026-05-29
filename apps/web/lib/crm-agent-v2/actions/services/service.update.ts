import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import {
  assertServiceCategoryBelongsToAccount,
  numberOrNull,
  optionalBoolean,
  optionalString,
  requiredNumber,
  requiredString,
  type JsonRecord,
} from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const serviceUpdateAction = defineCrmAgentAction({
  name: "service.update",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId"],
  optionalSlots: ["categoryId", "name", "description", "baseDurationMin", "basePrice", "isActive"],
  description: "Изменить услугу.",
  plannerHints: ["Use service.update only after required slots are resolved and the user intent matches: Изменить услугу."],
  preview: async (payload: JsonRecord, ctx) => {
    const before = await loadServiceBefore(payload, ctx.accountId);
    return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
  },
  execute: async (payload: JsonRecord, ctx) => {
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
    return { status: "DONE", data: { serviceId } };
  },
});

export async function loadServiceBefore(payload: JsonRecord, accountId: number) {
  const serviceId = numberOrNull(payload.serviceId);
  if (!serviceId) return null;
  const service = await prisma.service.findFirst({
    where: { id: serviceId, accountId },
    select: { id: true, categoryId: true, name: true, description: true, baseDurationMin: true, basePrice: true, isActive: true },
  });
  return service ? { ...service, basePrice: service.basePrice.toString() } : null;
}

export async function updateService(payload: JsonRecord, accountId: number) {
  if (payload.categoryId !== undefined) {
    const categoryId = numberOrNull(payload.categoryId);
    if (categoryId != null) await assertServiceCategoryBelongsToAccount(accountId, categoryId);
  }
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const updated = await prisma.service.updateMany({
    where: { id: serviceId, accountId },
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
  return serviceId;
}
