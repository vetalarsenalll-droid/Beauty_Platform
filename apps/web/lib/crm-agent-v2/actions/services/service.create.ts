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

export const serviceCreateAction = defineCrmAgentAction({
  name: "service.create",
  domain: "services",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.create",
  confirmation: "medium_plus",
  requiredSlots: ["name", "baseDurationMin", "basePrice"],
  optionalSlots: ["categoryId", "description", "isActive"],
  description: "Создать услугу.",
  plannerHints: ["Use service.create only after required slots are resolved and the user intent matches: Создать услугу."],
  preview: async (payload: JsonRecord) => buildActionPreview({ after: payload }),
  execute: async (payload: JsonRecord, ctx) => {
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
    return { status: "DONE", data: { serviceId: service.id } };
  },
});
