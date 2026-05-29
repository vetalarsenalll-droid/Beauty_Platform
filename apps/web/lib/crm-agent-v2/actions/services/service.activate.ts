import { defineCrmAgentAction } from "../define-action";
import { executeServiceActivate, previewServiceUpdate } from "./service-write-helpers";

export const serviceActivateAction = defineCrmAgentAction({
  name: "service.activate",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId"],
  optionalSlots: [],
  description: "Активировать услугу.",
  plannerHints: ["Use service.activate only after required slots are resolved and the user intent matches: Активировать услугу."],
  preview: (payload, ctx) => previewServiceUpdate({ ...payload, isActive: true }, ctx),
  execute: executeServiceActivate,
});
