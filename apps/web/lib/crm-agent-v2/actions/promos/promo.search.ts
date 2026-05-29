import { defineCrmAgentAction } from "../define-action";
import { readPromos } from "./promo-helpers";

export const promoSearchAction = defineCrmAgentAction({
  name: "promo.search",
  domain: "promos",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.promos.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "isActive", "take"],
  description: "Найти акции.",
  plannerHints: ["Use promo.search to inspect promotions and promo codes."],
  read: async (payload, ctx) => readPromos(ctx.accountId, payload),
});
