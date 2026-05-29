import { defineCrmAgentAction } from "../define-action";
import { readOutbox } from "./notification-helpers";

export const outboxSearchAction = defineCrmAgentAction({
  name: "outbox.search",
  domain: "notifications",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.notifications.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["status", "take"],
  description: "Найти outbox items.",
  plannerHints: ["Use outbox.search to inspect queued notification jobs."],
  read: async (payload, ctx) => readOutbox(ctx.accountId, payload),
});
