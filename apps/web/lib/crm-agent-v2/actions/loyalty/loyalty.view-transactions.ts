import { defineCrmAgentAction } from "../define-action";
import { readTransactions } from "./loyalty-helpers";

export const loyaltyViewTransactionsAction = defineCrmAgentAction({
  name: "loyalty.view_transactions",
  domain: "loyalty",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.loyalty.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["take"],
  description: "Показать транзакции лояльности.",
  plannerHints: ["Use loyalty.view_transactions to inspect loyalty ledger entries for one client."],
  read: async (payload, ctx) => readTransactions(ctx.accountId, payload),
});
