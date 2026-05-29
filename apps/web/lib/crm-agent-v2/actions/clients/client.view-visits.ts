import { defineCrmAgentAction } from "../define-action";
import { readClientVisits } from "./client-write-helpers";

export const clientViewVisitsAction = defineCrmAgentAction({
  name: "client.view_visits",
  domain: "clients",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.clients.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Показать визиты клиента.",
  plannerHints: ["Use client.view_visits when the user asks for a client's appointments or visit history."],
  read: async (payload, ctx) => readClientVisits(ctx.accountId, payload),
});
