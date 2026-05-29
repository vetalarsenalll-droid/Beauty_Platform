import { defineCrmAgentAction } from "../define-action";
import { readPromo } from "./promo-helpers";

export const promoViewAction = defineCrmAgentAction({
  name: "promo.view",
  domain: "promos",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.promos.read",
  confirmation: "never",
  requiredSlots: ["promoId"],
  optionalSlots: [],
  description: "Показать акцию.",
  plannerHints: ["Use promo.view when promoId is known."],
  read: async (payload, ctx) => readPromo(ctx.accountId, payload),
});
