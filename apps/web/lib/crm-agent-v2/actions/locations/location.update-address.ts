import { defineCrmAgentAction } from "../define-action";
import { executeLocationUpdate, previewLocationUpdate } from "./location-write-helpers";

export const locationUpdateAddressAction = defineCrmAgentAction({
  name: "location.update_address",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.locations.update",
  confirmation: "always",
  requiredSlots: ["locationId", "address"],
  optionalSlots: [],
  description: "Изменить адрес филиала.",
  plannerHints: ["Use location.update_address only after required slots are resolved and the user intent matches: Изменить адрес филиала."],
  preview: previewLocationUpdate,
  execute: executeLocationUpdate,
});
