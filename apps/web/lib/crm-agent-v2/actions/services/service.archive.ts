import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { loadServiceBefore } from "./service.update";

export const serviceArchiveAction = defineCrmAgentAction({
  name: "service.archive",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.services.delete",
  confirmation: "always",
  requiredSlots: ["serviceId"],
  optionalSlots: [],
  description: "Архивировать услугу.",
  plannerHints: ["Use service.archive only after required slots are resolved and the user intent matches: Архивировать услугу."],
  preview: async (payload: JsonRecord, ctx) => {
    const before = await loadServiceBefore(payload, ctx.accountId);
    return buildActionPreview({ before, after: { ...(before ?? {}), ...payload, isActive: false } });
  },
  execute: async (payload: JsonRecord, ctx) => {
    const serviceId = requiredNumber(payload.serviceId, "serviceId");
    const updated = await prisma.service.updateMany({ where: { id: serviceId, accountId: ctx.accountId }, data: { isActive: false } });
    if (!updated.count) throw new Error("Service not found.");
    return { status: "DONE", data: { serviceId } };
  },
});
