import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeLocationExceptionRemove } from "./location-write-helpers";

export const locationRemoveExceptionAction = defineCrmAgentAction({
  name: "location.remove_exception",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.locations.update",
  confirmation: "always",
  requiredSlots: ["locationId"],
  optionalSlots: ["exceptionId", "date"],
  description: "Удалить исключение часов работы.",
  plannerHints: ["Use location.remove_exception only after required slots are resolved and the user intent matches: Удалить исключение часов работы."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, removed: true } }),
  execute: executeLocationExceptionRemove,
});
