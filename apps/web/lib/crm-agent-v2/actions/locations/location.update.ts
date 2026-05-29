import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { numberOrNull, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const locationUpdateAction = defineCrmAgentAction({
  name: "location.update",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.locations.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId"],
  optionalSlots: ["name", "address", "description", "phone", "status"],
  description: "Изменить филиал.",
  plannerHints: ["Use location.update only after required slots are resolved and the user intent matches: Изменить филиал."],
  preview: async (payload: JsonRecord, ctx) => {
    const locationId = numberOrNull(payload.locationId);
    const before = locationId
      ? await prisma.location.findFirst({
          where: { id: locationId, accountId: ctx.accountId },
          select: { id: true, name: true, address: true, description: true, phone: true, status: true },
        })
      : null;
    return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
  },
  execute: async (payload: JsonRecord, ctx) => {
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
    return { status: "DONE", data: { locationId } };
  },
});
