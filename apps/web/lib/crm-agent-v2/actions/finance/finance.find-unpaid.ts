import { defineCrmAgentAction } from "../define-action";
import { readFindUnpaid } from "./finance-write-helpers";

export const financeFindUnpaidAction = defineCrmAgentAction({
  name: "finance.find_unpaid",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Найти неоплаченные записи.",
  plannerHints: ["Use finance.find_unpaid to list appointments where successful payments do not cover total price."],
  read: async (payload, ctx) => readFindUnpaid(ctx.accountId, payload),
});
