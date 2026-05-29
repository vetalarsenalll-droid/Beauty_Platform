import { defineCrmAgentAction } from "../define-action";
import { readReceipt } from "./finance-write-helpers";

export const receiptViewAction = defineCrmAgentAction({
  name: "receipt.view",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: ["receiptId"],
  optionalSlots: [],
  description: "Показать чек.",
  plannerHints: ["Use receipt.view when receiptId is known."],
  read: async (payload, ctx) => readReceipt(ctx.accountId, payload),
});
