import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeLocationManagerAssign } from "./location-write-helpers";

export const locationAssignManagerAction = defineCrmAgentAction({
  name: "location.assign_manager",
  domain: "locations",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.locations.update",
  confirmation: "always",
  requiredSlots: ["locationId", "userId"],
  optionalSlots: [],
  description: "Назначить менеджера филиала.",
  plannerHints: ["Use location.assign_manager only after required slots are resolved and the user intent matches: Назначить менеджера филиала."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, assigned: true } }),
  execute: executeLocationManagerAssign,
});
