import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import {
  serializeSpecialist,
  specialistMatchesQuery,
  specialistQuery,
  specialistSelect,
  specialistTake,
  specialistWhere,
} from "./specialist-read-helpers";

export const specialistResolveAction = defineCrmAgentAction({
  name: "specialist.resolve",
  domain: "specialists",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.specialists.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "specialistId", "serviceId", "locationId", "isPublic", "take"],
  description: "Разрешить неоднозначного специалиста.",
  plannerHints: ["Use specialist.resolve when the user asks to inspect: Разрешить неоднозначного специалиста."],
  read: async (payload: JsonRecord, ctx) => {
    const query = specialistQuery(payload);
    const rows = await prisma.specialistProfile.findMany({
      where: specialistWhere(payload, ctx.accountId),
      orderBy: [{ isPublic: "desc" }, { createdAt: "desc" }],
      take: specialistTake(payload.take, 8, 30),
      select: specialistSelect,
    });
    const candidates = rows.map(serializeSpecialist).filter((specialist) => specialistMatchesQuery(specialist, query));
    return { resolved: candidates.length === 1 ? candidates[0] : null, candidates, ambiguous: candidates.length !== 1 };
  },
});
