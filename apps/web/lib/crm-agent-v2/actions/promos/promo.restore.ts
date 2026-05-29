import { defineCrmAgentAction } from "../define-action";
import { executePromoActive, previewPromo } from "./promo-helpers";

export const promoRestoreAction = defineCrmAgentAction({
  name: "promo.restore",
  domain: "promos",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.promos.update",
  confirmation: "medium_plus",
  requiredSlots: ["promoId"],
  optionalSlots: [],
  description: "Восстановить акцию.",
  plannerHints: ["Use promo.restore to reactivate a promotion."],
  preview: previewPromo,
  execute: (payload, ctx) => executePromoActive(payload, ctx, true),
});
