import { defineCrmAgentAction } from "../define-action";
import { executeServiceLocationUnassign, executeServiceRelationPreview } from "./service-write-helpers";

export const serviceUnassignLocationAction = defineCrmAgentAction({
  name: "service.unassign_location",
  domain: "services",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.services.update",
  confirmation: "always",
  requiredSlots: ["serviceId", "locationId"],
  optionalSlots: [],
  description: "Отвязать филиал от услуги.",
  plannerHints: ["Use service.unassign_location only after required slots are resolved and the user intent matches: Отвязать филиал от услуги."],
  preview: (payload, ctx) => executeServiceRelationPreview(payload, ctx, { locationId: payload.locationId, assigned: false }),
  execute: executeServiceLocationUnassign,
});
