import { defineCrmAgentAction } from "../define-action";
import { readSpecialistInsightAction } from "./specialist-insight-helpers";

export const specialistViewWorkloadAction = defineCrmAgentAction({
  name: "specialist.view_workload",
  domain: "specialists",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать загрузку специалиста.",
  plannerHints: ["Use specialist.view_workload when the user asks to inspect: Показать загрузку специалиста."],
  read: (payload, ctx) => readSpecialistInsightAction("specialist.view_workload", payload, ctx),
});
