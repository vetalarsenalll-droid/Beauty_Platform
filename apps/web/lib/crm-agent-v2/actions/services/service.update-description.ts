import { defineCrmAgentAction } from "../define-action";
import { executeServiceUpdate, previewServiceUpdate } from "./service-write-helpers";

export const serviceUpdateDescriptionAction = defineCrmAgentAction({
  name: "service.update_description",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "description"],
  optionalSlots: [],
  description: "Изменить описание услуги.",
  plannerHints: ["Use service.update_description only after required slots are resolved and the user intent matches: Изменить описание услуги."],
  preview: previewServiceUpdate,
  execute: executeServiceUpdate,
});
