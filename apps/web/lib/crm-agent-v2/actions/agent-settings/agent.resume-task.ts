import { defineCrmAgentAction } from "../define-action";
import { executeAgentTaskStatus, previewAgentSettingPayload } from "./agent-settings-helpers";

export const agentResumeTaskAction = defineCrmAgentAction({
  name: "agent.resume_task",
  domain: "agent-settings",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.assistant.tasks.manage",
  confirmation: "medium_plus",
  requiredSlots: ["taskId"],
  optionalSlots: [],
  description: "Продолжить задачу агента.",
  plannerHints: ["Use agent.resume_task to set a CRM Agent task status back to OPEN."],
  preview: previewAgentSettingPayload,
  execute: (payload, ctx) => executeAgentTaskStatus(payload, ctx, "OPEN"),
});
