import { defineCrmAgentAction } from "../define-action";
import { readAgentPolicies } from "./agent-settings-helpers";

export const agentPolicyViewAction = defineCrmAgentAction({
  name: "agent.policy.view",
  domain: "agent-settings",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.assistant.autopilot.manage",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["key", "take"],
  description: "Показать политики агента.",
  plannerHints: ["Use agent.policy.view to inspect CRM Agent policies and AI access flags."],
  read: (payload, ctx) => readAgentPolicies(ctx.accountId, payload),
});
