import { defineCrmAgentAction } from "../define-action";
import { readClientPayments } from "./client-write-helpers";

export const clientViewPaymentsAction = defineCrmAgentAction({
  name: "client.view_payments",
  domain: "clients",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Показать платежи клиента.",
  plannerHints: ["Use client.view_payments when the user asks for payments for one client."],
  read: async (payload, ctx) => readClientPayments(ctx.accountId, payload),
});
