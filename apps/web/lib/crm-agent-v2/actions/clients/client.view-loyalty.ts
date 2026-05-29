import { defineCrmAgentAction } from "../define-action";
import { readClientLoyalty } from "./client-write-helpers";

export const clientViewLoyaltyAction = defineCrmAgentAction({
  name: "client.view_loyalty",
  domain: "clients",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.loyalty.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["take"],
  description: "Показать лояльность клиента.",
  plannerHints: ["Use client.view_loyalty when the user asks for loyalty balance or transactions for one client."],
  read: async (payload, ctx) => readClientLoyalty(ctx.accountId, payload),
});
