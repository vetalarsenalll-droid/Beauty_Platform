import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";

type ClientPayload = Record<string, unknown>;

export const clientCreateAction = defineCrmAgentAction({
  name: "client.create",
  domain: "clients",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.clients.create",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: ["firstName", "lastName", "phone", "email", "birthDate"],
  description: "Создать клиента.",
  plannerHints: ["Use client.create only after required slots are resolved and the user intent matches: Создать клиента."],
  preview: async (payload: ClientPayload) => buildActionPreview({ after: payload }),
  execute: async (payload: ClientPayload, ctx) => {
    const client = await prisma.client.create({
      data: {
        accountId: ctx.accountId,
        firstName: optionalString(payload, "firstName"),
        lastName: optionalString(payload, "lastName"),
        phone: optionalString(payload, "phone"),
        email: optionalString(payload, "email"),
        birthDate: optionalDate(payload, "birthDate"),
      },
    });
    return { status: "DONE", data: { clientId: client.id } };
  },
});

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
