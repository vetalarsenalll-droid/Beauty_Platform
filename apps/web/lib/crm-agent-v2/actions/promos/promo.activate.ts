import { defineCrmAgentAction } from "../define-action";
import { executePromoActive, previewPromo } from "./promo-helpers";

export const promoActivateAction = defineCrmAgentAction({
  name: "promo.activate",
  domain: "promos",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.promos.update",
  confirmation: "medium_plus",
  requiredSlots: ["promoId"],
  optionalSlots: [],
  description: "Активировать акцию.",
  plannerHints: ["Use promo.activate to set a promotion active."],
  preview: previewPromo,
  execute: (payload, ctx) => executePromoActive(payload, ctx, true),
});
