import { defineCrmAgentAction } from "../define-action";
import { executeAgentTaskStatus, previewAgentSettingPayload } from "./agent-settings-helpers";

export const agentCancelTaskAction = defineCrmAgentAction({
  name: "agent.cancel_task",
  domain: "agent-settings",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.assistant.tasks.manage",
  confirmation: "always",
  requiredSlots: ["taskId"],
  optionalSlots: [],
  description: "Отменить задачу агента.",
  plannerHints: ["Use agent.cancel_task to set a CRM Agent task status to CANCELLED."],
  preview: previewAgentSettingPayload,
  execute: (payload, ctx) => executeAgentTaskStatus(payload, ctx, "CANCELLED"),
});
