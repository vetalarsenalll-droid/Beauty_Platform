import { defineCrmAgentAction } from "../define-action";
import { readRevenueByService } from "./finance-write-helpers";

export const financeRevenueByServiceAction = defineCrmAgentAction({
  name: "finance.revenue_by_service",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Выручка по услугам.",
  plannerHints: ["Use finance.revenue_by_service to group transaction revenue by appointment services."],
  read: async (payload, ctx) => readRevenueByService(ctx.accountId, payload),
});
