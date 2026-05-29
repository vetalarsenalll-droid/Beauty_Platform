import { defineCrmAgentAction } from "../define-action";
import { executeLocationUpdate, previewLocationUpdate } from "./location-write-helpers";

export const locationUpdateNameAction = defineCrmAgentAction({
  name: "location.update_name",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.locations.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId", "name"],
  optionalSlots: [],
  description: "Изменить название филиала.",
  plannerHints: ["Use location.update_name only after required slots are resolved and the user intent matches: Изменить название филиала."],
  preview: previewLocationUpdate,
  execute: executeLocationUpdate,
});
