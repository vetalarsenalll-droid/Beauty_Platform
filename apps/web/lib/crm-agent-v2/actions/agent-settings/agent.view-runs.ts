import { defineCrmAgentAction } from "../define-action";
import { readAgentRuns } from "./agent-settings-helpers";

export const agentViewRunsAction = defineCrmAgentAction({
  name: "agent.view_runs",
  domain: "agent-settings",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.assistant.runs.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["status", "taskStatus", "take"],
  description: "Показать запуски агента.",
  plannerHints: ["Use agent.view_runs to inspect CRM Agent sessions, plans, and tasks."],
  read: (payload, ctx) => readAgentRuns(ctx.accountId, payload),
});
