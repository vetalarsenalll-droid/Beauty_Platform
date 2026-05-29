import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";

type ClientPayload = Record<string, unknown>;

export const clientUpdateAction = defineCrmAgentAction({
  name: "client.update",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.clients.update",
  confirmation: "medium_plus",
  requiredSlots: ["clientId"],
  optionalSlots: ["firstName", "lastName", "phone", "email", "birthDate"],
  description: "Изменить карточку клиента.",
  plannerHints: ["Use client.update only after required slots are resolved and the user intent matches: Изменить карточку клиента."],
  preview: async (payload: ClientPayload, ctx) => {
    const before = await loadClientBefore(payload, ctx.accountId);
    return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
  },
  execute: async (payload: ClientPayload, ctx) => {
    const clientId = requiredNumber(payload.clientId, "clientId");
    const updated = await prisma.client.updateMany({
      where: { id: clientId, accountId: ctx.accountId },
      data: {
        ...(payload.firstName !== undefined ? { firstName: optionalString(payload, "firstName") } : {}),
        ...(payload.lastName !== undefined ? { lastName: optionalString(payload, "lastName") } : {}),
        ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
        ...(payload.email !== undefined ? { email: optionalString(payload, "email") } : {}),
        ...(payload.birthDate !== undefined ? { birthDate: optionalDate(payload, "birthDate") } : {}),
      },
    });
    if (!updated.count) throw new Error("Client not found.");
    return { status: "DONE", data: { clientId } };
  },
});

async function loadClientBefore(payload: ClientPayload, accountId: number) {
  const clientId = numberArg(payload.clientId);
  if (!clientId) return null;
  const client = await prisma.client.findFirst({
    where: { id: clientId, accountId },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, birthDate: true },
  });
  return client ? { ...client, birthDate: client.birthDate?.toISOString() ?? null } : null;
}

function optionalString(payload: ClientPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : null;
}

function optionalDate(payload: ClientPayload, key: string) {
  const value = optionalString(payload, key);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Action payload ${key} must be a valid date.`);
  return date;
}

function requiredNumber(value: unknown, key: string) {
  const parsed = numberArg(value);
  if (parsed == null) throw new Error(`Action payload ${key} is required.`);
  return parsed;
}

function numberArg(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}
