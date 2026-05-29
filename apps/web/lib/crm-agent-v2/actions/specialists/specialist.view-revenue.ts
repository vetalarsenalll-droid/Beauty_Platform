import { defineCrmAgentAction } from "../define-action";
import { readSpecialistInsightAction } from "./specialist-insight-helpers";

export const specialistViewRevenueAction = defineCrmAgentAction({
  name: "specialist.view_revenue",
  domain: "specialists",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать выручку специалиста.",
  plannerHints: ["Use specialist.view_revenue when the user asks to inspect: Показать выручку специалиста."],
  read: (payload, ctx) => readSpecialistInsightAction("specialist.view_revenue", payload, ctx),
});
