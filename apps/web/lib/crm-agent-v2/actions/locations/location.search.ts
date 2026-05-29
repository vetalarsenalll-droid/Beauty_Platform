import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { locationMatchesQuery, locationQuery, locationSelect, locationTake, locationWhere, serializeLocation } from "./location-read-helpers";

export const locationSearchAction = defineCrmAgentAction({
  name: "location.search",
  domain: "locations",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.locations.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "locationId", "status", "take"],
  description: "Найти филиалы/локации.",
  plannerHints: ["Use location.search when the user asks to inspect: Найти филиалы/локации."],
  read: async (payload: JsonRecord, ctx) => {
    const query = locationQuery(payload);
    const rows = await prisma.location.findMany({
      where: locationWhere(payload, ctx.accountId),
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: locationTake(payload.take),
      select: locationSelect,
    });
    return { locations: rows.map(serializeLocation).filter((location) => locationMatchesQuery(location, query)) };
  },
});
