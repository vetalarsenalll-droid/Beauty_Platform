import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceCategoryUpdate } from "./service-write-helpers";

export const serviceUpdateCategoryAction = defineCrmAgentAction({
  name: "service.update_category",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["categoryId"],
  optionalSlots: ["name", "slug"],
  description: "Изменить категорию услуг.",
  plannerHints: ["Use service.update_category only after required slots are resolved and the user intent matches: Изменить категорию услуг."],
  preview: async (payload) => buildActionPreview({ after: payload }),
  execute: executeServiceCategoryUpdate,
});
