import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceLevelConfigUpdate } from "./service-write-helpers";

export const serviceUpdateLevelConfigAction = defineCrmAgentAction({
  name: "service.update_level_config",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.services.update",
  confirmation: "always",
  requiredSlots: ["serviceId", "levelId"],
  optionalSlots: ["durationMin", "price"],
  description: "Изменить настройки цены/длительности по уровню специалиста.",
  plannerHints: ["Use service.update_level_config only after required slots are resolved and the user intent matches: Изменить настройки цены/длительности по уровню специалиста."],
  preview: async (payload) => buildActionPreview({ after: payload }),
  execute: executeServiceLevelConfigUpdate,
});
