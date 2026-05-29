import { defineCrmAgentAction } from "../define-action";
import { readAgentMemory } from "./agent-settings-helpers";

export const agentMemoryViewAction = defineCrmAgentAction({
  name: "agent.memory.view",
  domain: "agent-settings",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.assistant.memory.manage",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["key", "take"],
  description: "Показать память агента.",
  plannerHints: ["Use agent.memory.view to inspect account-scoped CRM Agent memory."],
  read: (payload, ctx) => readAgentMemory(ctx.accountId, payload),
});
