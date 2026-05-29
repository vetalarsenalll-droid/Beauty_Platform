import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeLocationHoursUpdate } from "./location-write-helpers";

export const locationUpdateHoursAction = defineCrmAgentAction({
  name: "location.update_hours",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.locations.update",
  confirmation: "always",
  requiredSlots: ["locationId", "hours"],
  optionalSlots: [],
  description: "Изменить часы работы филиала.",
  plannerHints: ["Use location.update_hours only after required slots are resolved and the user intent matches: Изменить часы работы филиала."],
  preview: async (payload) => buildActionPreview({ after: payload }),
  execute: executeLocationHoursUpdate,
});
