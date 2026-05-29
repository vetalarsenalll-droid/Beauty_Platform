import { defineCrmAgentAction } from "../define-action";
import { executeLocationUpdate, previewLocationUpdate } from "./location-write-helpers";

export const locationDeactivateAction = defineCrmAgentAction({
  name: "location.deactivate",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.locations.update",
  confirmation: "always",
  requiredSlots: ["locationId"],
  optionalSlots: [],
  description: "Деактивировать филиал.",
  plannerHints: ["Use location.deactivate only after required slots are resolved and the user intent matches: Деактивировать филиал."],
  preview: (payload, ctx) => previewLocationUpdate({ ...payload, status: "INACTIVE" }, ctx),
  execute: (payload, ctx) => executeLocationUpdate({ ...payload, status: "INACTIVE" }, ctx),
});
