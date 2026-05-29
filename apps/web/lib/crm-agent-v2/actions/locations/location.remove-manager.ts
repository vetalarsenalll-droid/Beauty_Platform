import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeLocationManagerRemove } from "./location-write-helpers";

export const locationRemoveManagerAction = defineCrmAgentAction({
  name: "location.remove_manager",
  domain: "locations",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.locations.update",
  confirmation: "always",
  requiredSlots: ["locationId", "userId"],
  optionalSlots: [],
  description: "Снять менеджера филиала.",
  plannerHints: ["Use location.remove_manager only after required slots are resolved and the user intent matches: Снять менеджера филиала."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, assigned: false } }),
  execute: executeLocationManagerRemove,
});
