import { defineCrmAgentAction } from "../define-action";
import { executeServiceUpdate, previewServiceUpdate } from "./service-write-helpers";

export const serviceUpdateDurationAction = defineCrmAgentAction({
  name: "service.update_duration",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "baseDurationMin"],
  optionalSlots: [],
  description: "Изменить длительность.",
  plannerHints: ["Use service.update_duration only after required slots are resolved and the user intent matches: Изменить длительность."],
  preview: previewServiceUpdate,
  execute: executeServiceUpdate,
});
