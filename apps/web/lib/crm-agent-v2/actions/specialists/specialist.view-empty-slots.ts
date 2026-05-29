import { defineCrmAgentAction } from "../define-action";
import { readSpecialistInsightAction } from "./specialist-insight-helpers";

export const specialistViewEmptySlotsAction = defineCrmAgentAction({
  name: "specialist.view_empty_slots",
  domain: "specialists",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать свободные окна специалиста.",
  plannerHints: ["Use specialist.view_empty_slots when the user asks to inspect: Показать свободные окна специалиста."],
  read: (payload, ctx) => readSpecialistInsightAction("specialist.view_empty_slots", payload, ctx),
});
