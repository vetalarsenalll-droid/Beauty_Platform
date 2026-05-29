import { defineCrmAgentAction } from "../define-action";
import { executeAutopilotSetLevel, previewAgentSettingPayload } from "./agent-settings-helpers";

export const agentAutopilotSetLevelAction = defineCrmAgentAction({
  name: "agent.autopilot.set_level",
  domain: "agent-settings",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.assistant.autopilot.manage",
  confirmation: "always",
  requiredSlots: ["level"],
  optionalSlots: [],
  description: "Изменить уровень автопилота.",
  plannerHints: ["Use agent.autopilot.set_level to set the account policy autopilot.level."],
  preview: previewAgentSettingPayload,
  execute: executeAutopilotSetLevel,
});
