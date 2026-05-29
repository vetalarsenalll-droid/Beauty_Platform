import { defineCrmAgentAction } from "../define-action";
import { executeLocationUpdate, previewLocationUpdate } from "./location-write-helpers";

export const locationUpdateDescriptionAction = defineCrmAgentAction({
  name: "location.update_description",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.locations.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId", "description"],
  optionalSlots: [],
  description: "Изменить описание филиала.",
  plannerHints: ["Use location.update_description only after required slots are resolved and the user intent matches: Изменить описание филиала."],
  preview: previewLocationUpdate,
  execute: executeLocationUpdate,
});
