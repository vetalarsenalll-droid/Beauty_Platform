import { defineCrmAgentAction } from "../define-action";
import { executePromoActive, previewPromo } from "./promo-helpers";

export const promoDeactivateAction = defineCrmAgentAction({
  name: "promo.deactivate",
  domain: "promos",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.promos.update",
  confirmation: "medium_plus",
  requiredSlots: ["promoId"],
  optionalSlots: [],
  description: "Деактивировать акцию.",
  plannerHints: ["Use promo.deactivate to set a promotion inactive."],
  preview: previewPromo,
  execute: (payload, ctx) => executePromoActive(payload, ctx, false),
});
