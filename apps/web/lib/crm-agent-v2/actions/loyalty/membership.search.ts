import { defineCrmAgentAction } from "../define-action";
import { readMemberships } from "./loyalty-helpers";

export const membershipSearchAction = defineCrmAgentAction({
  name: "membership.search",
  domain: "loyalty",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.memberships.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "take"],
  description: "Найти абонементы.",
  plannerHints: ["Use membership.search to find memberships by name and inspect redemptions."],
  read: async (payload, ctx) => readMemberships(ctx.accountId, payload),
});
