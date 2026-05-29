import { defineCrmAgentAction } from "../define-action";
import { executeAutopilotEnabled, previewAgentSettingPayload } from "./agent-settings-helpers";

export const agentAutopilotEnableAction = defineCrmAgentAction({
  name: "agent.autopilot.enable",
  domain: "agent-settings",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.assistant.autopilot.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Включить автопилот.",
  plannerHints: ["Use agent.autopilot.enable to enable CRM Agent autopilot for the account."],
  preview: previewAgentSettingPayload,
  execute: (payload, ctx) => executeAutopilotEnabled(payload, ctx, true),
});
