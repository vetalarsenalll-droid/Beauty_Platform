import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { revenueSummary } from "./finance-read-helpers";

export const financeViewRevenueAction = defineCrmAgentAction({
  name: "finance.view_revenue",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Показать выручку.",
  plannerHints: ["Use finance.view_revenue when the user asks to inspect: Показать выручку."],
  read: async (payload: JsonRecord, ctx) => ({ revenue: await revenueSummary(ctx.accountId, payload) }),
});
