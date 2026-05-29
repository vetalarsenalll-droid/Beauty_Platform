import { defineCrmAgentAction } from "../define-action";
import { executeAutopilotEnabled, previewAgentSettingPayload } from "./agent-settings-helpers";

export const agentAutopilotDisableAction = defineCrmAgentAction({
  name: "agent.autopilot.disable",
  domain: "agent-settings",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.assistant.autopilot.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Выключить автопилот.",
  plannerHints: ["Use agent.autopilot.disable to disable CRM Agent autopilot for the account."],
  preview: previewAgentSettingPayload,
  execute: (payload, ctx) => executeAutopilotEnabled(payload, ctx, false),
});
