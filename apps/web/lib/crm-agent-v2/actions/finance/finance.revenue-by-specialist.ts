import { defineCrmAgentAction } from "../define-action";
import { readRevenueBySpecialist } from "./finance-write-helpers";

export const financeRevenueBySpecialistAction = defineCrmAgentAction({
  name: "finance.revenue_by_specialist",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Выручка по специалистам.",
  plannerHints: ["Use finance.revenue_by_specialist to group transaction revenue by appointment specialist."],
  read: async (payload, ctx) => readRevenueBySpecialist(ctx.accountId, payload),
});
