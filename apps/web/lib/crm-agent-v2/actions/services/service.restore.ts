import { defineCrmAgentAction } from "../define-action";
import { executeServiceActivate, previewServiceUpdate } from "./service-write-helpers";

export const serviceRestoreAction = defineCrmAgentAction({
  name: "service.restore",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId"],
  optionalSlots: [],
  description: "Восстановить услугу.",
  plannerHints: ["Use service.restore only after required slots are resolved and the user intent matches: Восстановить услугу."],
  preview: (payload, ctx) => previewServiceUpdate({ ...payload, isActive: true }, ctx),
  execute: executeServiceActivate,
});
