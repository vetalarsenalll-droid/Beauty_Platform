import { defineCrmAgentAction } from "../define-action";
import { executeServiceUpdate, previewServiceUpdate } from "./service-write-helpers";

export const serviceMoveToCategoryAction = defineCrmAgentAction({
  name: "service.move_to_category",
  domain: "services",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "categoryId"],
  optionalSlots: [],
  description: "Переместить услугу в категорию.",
  plannerHints: ["Use service.move_to_category only after required slots are resolved and the user intent matches: Переместить услугу в категорию."],
  preview: previewServiceUpdate,
  execute: executeServiceUpdate,
});
