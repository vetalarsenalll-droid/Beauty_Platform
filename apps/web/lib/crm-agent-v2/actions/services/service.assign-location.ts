import { defineCrmAgentAction } from "../define-action";
import { executeServiceLocationAssign, executeServiceRelationPreview } from "./service-write-helpers";

export const serviceAssignLocationAction = defineCrmAgentAction({
  name: "service.assign_location",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "locationId"],
  optionalSlots: [],
  description: "Привязать филиал к услуге.",
  plannerHints: ["Use service.assign_location only after required slots are resolved and the user intent matches: Привязать филиал к услуге."],
  preview: (payload, ctx) => executeServiceRelationPreview(payload, ctx, { locationId: payload.locationId, assigned: true }),
  execute: executeServiceLocationAssign,
});
