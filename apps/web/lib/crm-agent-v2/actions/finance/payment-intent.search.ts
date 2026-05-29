import { defineCrmAgentAction } from "../define-action";
import { readPaymentIntents } from "./finance-write-helpers";

export const paymentIntentSearchAction = defineCrmAgentAction({
  name: "payment_intent.search",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["clientId", "appointmentId", "status", "dateFrom", "dateTo", "take"],
  description: "Найти payment intents.",
  plannerHints: ["Use payment_intent.search to inspect payment intents with transactions and refunds."],
  read: async (payload, ctx) => readPaymentIntents(ctx.accountId, payload),
});
