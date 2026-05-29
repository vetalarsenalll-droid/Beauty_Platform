import { defineCrmAgentAction } from "../define-action";
import { executeAgentMemoryDelete, previewAgentSettingPayload } from "./agent-settings-helpers";

export const agentMemoryDeleteAction = defineCrmAgentAction({
  name: "agent.memory.delete",
  domain: "agent-settings",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.assistant.memory.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["memoryId", "key"],
  description: "Удалить запись памяти.",
  plannerHints: ["Use agent.memory.delete with memoryId or key."],
  preview: previewAgentSettingPayload,
  execute: executeAgentMemoryDelete,
});
