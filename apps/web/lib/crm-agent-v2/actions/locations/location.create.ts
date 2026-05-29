import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { optionalString, requiredString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const locationCreateAction = defineCrmAgentAction({
  name: "location.create",
  domain: "locations",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.locations.create",
  confirmation: "medium_plus",
  requiredSlots: ["name", "address"],
  optionalSlots: ["description", "phone", "status"],
  description: "Создать филиал.",
  plannerHints: ["Use location.create only after required slots are resolved and the user intent matches: Создать филиал."],
  preview: async (payload: JsonRecord) => buildActionPreview({ after: payload }),
  execute: async (payload: JsonRecord, ctx) => {
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
    return { status: "DONE", data: { locationId: location.id } };
  },
});
