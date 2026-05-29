import { defineCrmAgentAction } from "../define-action";
import { executeServiceUpdate, previewServiceUpdate } from "./service-write-helpers";

export const serviceUpdateNameAction = defineCrmAgentAction({
  name: "service.update_name",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "name"],
  optionalSlots: [],
  description: "Изменить название услуги.",
  plannerHints: ["Use service.update_name only after required slots are resolved and the user intent matches: Изменить название услуги."],
  preview: previewServiceUpdate,
  execute: executeServiceUpdate,
});
