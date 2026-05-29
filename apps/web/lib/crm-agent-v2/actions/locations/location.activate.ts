import { defineCrmAgentAction } from "../define-action";
import { executeLocationUpdate, previewLocationUpdate } from "./location-write-helpers";

export const locationActivateAction = defineCrmAgentAction({
  name: "location.activate",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.locations.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId"],
  optionalSlots: [],
  description: "Активировать филиал.",
  plannerHints: ["Use location.activate only after required slots are resolved and the user intent matches: Активировать филиал."],
  preview: (payload, ctx) => previewLocationUpdate({ ...payload, status: "ACTIVE" }, ctx),
  execute: (payload, ctx) => executeLocationUpdate({ ...payload, status: "ACTIVE" }, ctx),
});
