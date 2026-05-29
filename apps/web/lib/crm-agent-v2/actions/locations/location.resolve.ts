import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { locationMatchesQuery, locationQuery, locationSelect, locationTake, locationWhere, serializeLocation } from "./location-read-helpers";

export const locationResolveAction = defineCrmAgentAction({
  name: "location.resolve",
  domain: "locations",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.locations.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "locationId", "status", "take"],
  description: "Разрешить неоднозначный филиал.",
  plannerHints: ["Use location.resolve when the user asks to inspect: Разрешить неоднозначный филиал."],
  read: async (payload: JsonRecord, ctx) => {
    const query = locationQuery(payload);
    const rows = await prisma.location.findMany({
      where: locationWhere(payload, ctx.accountId),
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: locationTake(payload.take, 8, 30),
      select: locationSelect,
    });
    const candidates = rows.map(serializeLocation).filter((location) => locationMatchesQuery(location, query));
    return { resolved: candidates.length === 1 ? candidates[0] : null, candidates, ambiguous: candidates.length !== 1 };
  },
});
