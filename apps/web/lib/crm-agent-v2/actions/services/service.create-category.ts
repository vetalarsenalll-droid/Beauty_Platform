import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceCategoryCreate } from "./service-write-helpers";

export const serviceCreateCategoryAction = defineCrmAgentAction({
  name: "service.create_category",
  domain: "services",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.create",
  confirmation: "medium_plus",
  requiredSlots: ["name"],
  optionalSlots: ["slug"],
  description: "Создать категорию услуг.",
  plannerHints: ["Use service.create_category only after required slots are resolved and the user intent matches: Создать категорию услуг."],
  preview: async (payload) => buildActionPreview({ after: payload }),
  execute: executeServiceCategoryCreate,
});
