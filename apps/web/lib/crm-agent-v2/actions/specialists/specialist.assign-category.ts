import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistCategoryAssign, previewSpecialistRelation } from "./specialist-write-helpers";

export const specialistAssignCategoryAction = defineCrmAgentAction({
  name: "specialist.assign_category",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "low",
  permission: "crm.specialists.update",
  confirmation: "never",
  requiredSlots: ["specialistId", "categoryId"],
  optionalSlots: [],
  description: "Назначить категорию специалиста.",
  plannerHints: ["Use specialist.assign_category only after required slots are resolved and the user intent matches: Назначить категорию специалиста."],
  preview: (payload, ctx) => previewSpecialistRelation(payload, ctx, { categoryId: payload.categoryId, assigned: true }),
  execute: executeSpecialistCategoryAssign,
});
