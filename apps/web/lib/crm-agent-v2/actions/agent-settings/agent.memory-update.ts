import { defineCrmAgentAction } from "../define-action";
import { executeAgentMemoryUpdate, previewAgentSettingPayload } from "./agent-settings-helpers";

export const agentMemoryUpdateAction = defineCrmAgentAction({
  name: "agent.memory.update",
  domain: "agent-settings",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.assistant.memory.manage",
  confirmation: "medium_plus",
  requiredSlots: ["key", "value"],
  optionalSlots: ["confidence", "source"],
  description: "Обновить память агента.",
  plannerHints: ["Use agent.memory.update to upsert account-scoped CRM Agent memory."],
  preview: previewAgentSettingPayload,
  execute: executeAgentMemoryUpdate,
});
