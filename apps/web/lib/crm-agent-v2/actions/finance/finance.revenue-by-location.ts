import { defineCrmAgentAction } from "../define-action";
import { readRevenueByLocation } from "./finance-write-helpers";

export const financeRevenueByLocationAction = defineCrmAgentAction({
  name: "finance.revenue_by_location",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Выручка по филиалам.",
  plannerHints: ["Use finance.revenue_by_location to group transaction revenue by appointment location."],
  read: async (payload, ctx) => readRevenueByLocation(ctx.accountId, payload),
});
