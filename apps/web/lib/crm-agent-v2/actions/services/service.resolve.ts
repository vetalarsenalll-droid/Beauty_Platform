import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { serializeService, serviceMatchesQuery, serviceQuery, serviceSelect, serviceTake, serviceWhere } from "./service-read-helpers";

export const serviceResolveAction = defineCrmAgentAction({
  name: "service.resolve",
  domain: "services",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.services.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "serviceId", "categoryId", "isActive", "take"],
  description: "Разрешить неоднозначную услугу.",
  plannerHints: ["Use service.resolve when the user asks to inspect: Разрешить неоднозначную услугу."],
  read: async (payload: JsonRecord, ctx) => {
    const query = serviceQuery(payload);
    const rows = await prisma.service.findMany({
      where: serviceWhere(payload, ctx.accountId),
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: serviceTake(payload.take, 8, 30),
      select: serviceSelect,
    });
    const candidates = rows.map(serializeService).filter((service) => serviceMatchesQuery(service, query));
    return { resolved: candidates.length === 1 ? candidates[0] : null, candidates, ambiguous: candidates.length !== 1 };
  },
});
