import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { clampTake, serializeClient } from "./client.search";

export const clientResolveAction = defineCrmAgentAction({
  name: "client.resolve",
  domain: "clients",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.clients.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["clientId", "query", "take"],
  description: "Разрешить неоднозначного клиента из candidates.",
  plannerHints: ["Use client.resolve when the user asks to inspect: Разрешить неоднозначного клиента из candidates."],
  read: async (payload: JsonRecord, ctx) => {
    const clientId = numberOrNull(payload.clientId ?? payload.id);
    const query = optionalString(payload, "query");
    const take = clampTake(payload.take, 5, 20);
    const clients = await prisma.client.findMany({
      where: {
        accountId: ctx.accountId,
        ...(clientId
          ? { id: clientId }
          : query
            ? {
                OR: [
                  { firstName: { contains: query, mode: "insensitive" } },
                  { lastName: { contains: query, mode: "insensitive" } },
                  { phone: { contains: query } },
                  { email: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
      },
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        birthDate: true,
        createdAt: true,
        updatedAt: true,
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
    });
    const candidates = clients.map(serializeClient);
    return {
      resolved: candidates.length === 1 ? candidates[0] : null,
      candidates,
      ambiguous: candidates.length !== 1,
    };
  },
});
