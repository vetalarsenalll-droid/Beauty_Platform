import { defineCrmAgentAction } from "../define-action";
import { executeServiceUpdate, previewServiceUpdate } from "./service-write-helpers";

export const serviceUpdatePriceAction = defineCrmAgentAction({
  name: "service.update_price",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.services.update",
  confirmation: "always",
  requiredSlots: ["serviceId", "basePrice"],
  optionalSlots: [],
  description: "Изменить цену.",
  plannerHints: ["Use service.update_price only after required slots are resolved and the user intent matches: Изменить цену."],
  preview: previewServiceUpdate,
  execute: executeServiceUpdate,
});
