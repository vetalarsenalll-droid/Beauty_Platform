import { defineCrmAgentAction } from "../define-action";
import { readRoles } from "./users-helpers";

export const roleSearchAction = defineCrmAgentAction({
  name: "role.search",
  domain: "users",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.roles.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Найти роли аккаунта.",
  plannerHints: ["Use role.search to inspect account roles and their permissions."],
  read: async (_payload, ctx) => readRoles(ctx.accountId),
});
