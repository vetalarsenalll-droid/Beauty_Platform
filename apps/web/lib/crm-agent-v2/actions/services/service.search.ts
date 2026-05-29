import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { serializeService, serviceMatchesQuery, serviceQuery, serviceSelect, serviceTake, serviceWhere } from "./service-read-helpers";

export const serviceSearchAction = defineCrmAgentAction({
  name: "service.search",
  domain: "services",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.services.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "serviceId", "categoryId", "isActive", "take"],
  description: "Найти услуги.",
  plannerHints: ["Use service.search when the user asks to inspect: Найти услуги."],
  read: async (payload: JsonRecord, ctx) => {
    const query = serviceQuery(payload);
    const services = await prisma.service.findMany({
      where: serviceWhere(payload, ctx.accountId),
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: serviceTake(payload.take),
      select: serviceSelect,
    });
    return { services: services.map(serializeService).filter((service) => serviceMatchesQuery(service, query)) };
  },
});
