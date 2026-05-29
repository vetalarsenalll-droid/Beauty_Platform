import { defineCrmAgentAction } from "../define-action";
import { executeLocationUpdate, previewLocationUpdate } from "./location-write-helpers";

export const locationUpdatePhoneAction = defineCrmAgentAction({
  name: "location.update_phone",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.locations.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId", "phone"],
  optionalSlots: [],
  description: "Изменить телефон филиала.",
  plannerHints: ["Use location.update_phone only after required slots are resolved and the user intent matches: Изменить телефон филиала."],
  preview: previewLocationUpdate,
  execute: executeLocationUpdate,
});
