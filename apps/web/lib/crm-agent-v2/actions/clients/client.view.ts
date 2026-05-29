import { prisma } from "@/lib/prisma";
import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { serializeClient } from "./client.search";

export const clientViewAction = defineCrmAgentAction({
  name: "client.view",
  domain: "clients",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.clients.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: [],
  description: "Показать карточку клиента.",
  plannerHints: ["Use client.view when the user asks to inspect: Показать карточку клиента."],
  read: async (payload: JsonRecord, ctx) => {
    const clientId = requiredNumber(payload.clientId, "clientId");
    const client = await prisma.client.findFirst({
      where: { id: clientId, accountId: ctx.accountId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        birthDate: true,
        createdAt: true,
        updatedAt: true,
        contacts: true,
        notes: { orderBy: { createdAt: "desc" }, take: 10 },
        tags: { select: { tag: { select: { id: true, name: true } } } },
        consents: true,
        appointments: {
          orderBy: { startAt: "desc" },
          take: 10,
          select: { id: true, startAt: true, endAt: true, status: true, priceTotal: true, specialistId: true, locationId: true },
        },
      },
    });
    if (!client) throw new Error("Client not found.");
    return {
      client: {
        ...serializeClient(client),
        contacts: client.contacts,
        notes: client.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
        consents: client.consents.map((consent) => ({
          ...consent,
          grantedAt: consent.grantedAt?.toISOString() ?? null,
          revokedAt: consent.revokedAt?.toISOString() ?? null,
        })),
        appointments: client.appointments.map((appointment) => ({
          ...appointment,
          startAt: appointment.startAt.toISOString(),
          endAt: appointment.endAt.toISOString(),
          priceTotal: appointment.priceTotal.toString(),
        })),
      },
    };
  },
});
