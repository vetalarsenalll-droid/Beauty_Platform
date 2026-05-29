import { defineCrmAgentAction } from "../define-action";
import { readPromoRedemptions } from "./promo-helpers";

export const promoViewRedemptionsAction = defineCrmAgentAction({
  name: "promo.view_redemptions",
  domain: "promos",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.promos.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["promoId", "promotionId", "promoCodeId", "take"],
  description: "Показать использования промокода.",
  plannerHints: ["Use promo.view_redemptions to inspect promo code usage."],
  read: async (payload, ctx) => readPromoRedemptions(ctx.accountId, payload),
});
