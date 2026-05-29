import { defineCrmAgentAction } from "../define-action";
import { executeAgentPolicyUpdate, previewAgentSettingPayload } from "./agent-settings-helpers";

export const agentPolicyUpdateAction = defineCrmAgentAction({
  name: "agent.policy.update",
  domain: "agent-settings",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.assistant.autopilot.manage",
  confirmation: "always",
  requiredSlots: ["key", "value"],
  optionalSlots: [],
  description: "Изменить политики агента.",
  plannerHints: ["Use agent.policy.update to upsert account-scoped CRM Agent policy values."],
  preview: previewAgentSettingPayload,
  execute: executeAgentPolicyUpdate,
});
