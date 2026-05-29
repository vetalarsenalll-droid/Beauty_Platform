import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeLocationExceptionAdd } from "./location-write-helpers";

export const locationAddExceptionAction = defineCrmAgentAction({
  name: "location.add_exception",
  domain: "locations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.locations.update",
  confirmation: "always",
  requiredSlots: ["locationId", "date"],
  optionalSlots: ["isClosed", "startTime", "endTime"],
  description: "Добавить исключение в часы работы.",
  plannerHints: ["Use location.add_exception only after required slots are resolved and the user intent matches: Добавить исключение в часы работы."],
  preview: async (payload) => buildActionPreview({ after: payload }),
  execute: executeLocationExceptionAdd,
});
