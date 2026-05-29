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

export const specialistSearchAction = defineCrmAgentAction({
  name: "specialist.search",
  domain: "specialists",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.specialists.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "specialistId", "serviceId", "locationId", "isPublic", "take"],
  description: "Найти сотрудников/специалистов.",
  plannerHints: ["Use specialist.search when the user asks to inspect: Найти сотрудников/специалистов."],
  read: async (payload: JsonRecord, ctx) => {
    const query = specialistQuery(payload);
    const rows = await prisma.specialistProfile.findMany({
      where: specialistWhere(payload, ctx.accountId),
      orderBy: [{ isPublic: "desc" }, { createdAt: "desc" }],
      take: specialistTake(payload.take),
      select: specialistSelect,
    });
    return { specialists: rows.map(serializeSpecialist).filter((specialist) => specialistMatchesQuery(specialist, query)) };
  },
});
