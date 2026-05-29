import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const clientSearchAction = defineCrmAgentAction({
  name: "client.search",
  domain: "clients",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.clients.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "take"],
  description: "Найти клиентов по имени, телефону, email, тегам.",
  plannerHints: ["Use client.search when the user asks to inspect: Найти клиентов по имени, телефону, email, тегам."],
  read: async (payload: JsonRecord, ctx) => {
    const query = optionalString(payload, "query");
    const take = clampTake(payload.take, 20, 50);
    const clients = await prisma.client.findMany({
      where: {
        accountId: ctx.accountId,
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
                { phone: { contains: query } },
                { email: { contains: query, mode: "insensitive" } },
                { tags: { some: { tag: { name: { contains: query, mode: "insensitive" } } } } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take,
      select: clientListSelect,
    });
    return { clients: clients.map(serializeClient) };
  },
});

const clientListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  birthDate: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: { tag: { select: { id: true, name: true } } } },
} as const;

export function serializeClient(client: {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  birthDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ tag: { id: number; name: string } }>;
}) {
  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    displayName: [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || null,
    phone: client.phone,
    email: client.email,
    birthDate: client.birthDate?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    tags: client.tags.map((item) => item.tag),
  };
}

export function clampTake(value: unknown, fallback: number, max: number) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}
