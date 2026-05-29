import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistCategoryRemove, previewSpecialistRelation } from "./specialist-write-helpers";

export const specialistRemoveCategoryAction = defineCrmAgentAction({
  name: "specialist.remove_category",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "low",
  permission: "crm.specialists.update",
  confirmation: "never",
  requiredSlots: ["specialistId", "categoryId"],
  optionalSlots: [],
  description: "Убрать категорию специалиста.",
  plannerHints: ["Use specialist.remove_category only after required slots are resolved and the user intent matches: Убрать категорию специалиста."],
  preview: (payload, ctx) => previewSpecialistRelation(payload, ctx, { categoryId: payload.categoryId, assigned: false }),
  execute: executeSpecialistCategoryRemove,
});
