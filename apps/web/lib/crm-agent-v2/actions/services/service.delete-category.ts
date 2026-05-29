import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceCategoryDelete } from "./service-write-helpers";

export const serviceDeleteCategoryAction = defineCrmAgentAction({
  name: "service.delete_category",
  domain: "services",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.services.delete",
  confirmation: "always",
  requiredSlots: ["categoryId"],
  optionalSlots: [],
  description: "Удалить категорию услуг.",
  plannerHints: ["Use service.delete_category only after required slots are resolved and the user intent matches: Удалить категорию услуг."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, deleted: true } }),
  execute: executeServiceCategoryDelete,
});
