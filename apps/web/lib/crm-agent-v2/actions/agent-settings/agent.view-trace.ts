import { defineCrmAgentAction } from "../define-action";
import { readAgentTrace } from "./agent-settings-helpers";

export const agentViewTraceAction = defineCrmAgentAction({
  name: "agent.view_trace",
  domain: "agent-settings",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.assistant.runs.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["sessionId", "planId", "take"],
  description: "Показать trace запуска.",
  plannerHints: ["Use agent.view_trace with sessionId or planId to inspect messages, states, plan steps, tool calls, actions, and artifacts."],
  read: (payload, ctx) => readAgentTrace(ctx.accountId, payload),
});
