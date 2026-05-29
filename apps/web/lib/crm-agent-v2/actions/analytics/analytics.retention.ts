import { defineCrmAgentAction } from "../define-action";
import { retentionAnalytics } from "./analytics-read-helpers";

export const analyticsRetentionAction = defineCrmAgentAction({
  name: "analytics.retention",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["days", "take"],
  description: "Анализ удержания.",
  plannerHints: ["Use analytics.retention when the user asks to inspect: Анализ удержания."],
  read: async (payload, ctx) => ({ retention: await retentionAnalytics(ctx.accountId, payload) }),
});
