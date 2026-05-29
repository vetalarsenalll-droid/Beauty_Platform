import { defineCrmAgentAction } from "../define-action";
import { executePromoCodeDisable, previewPromo } from "./promo-helpers";

export const promoDisableCodeAction = defineCrmAgentAction({
  name: "promo.disable_code",
  domain: "promos",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.promos.update",
  confirmation: "medium_plus",
  requiredSlots: ["promoCodeId"],
  optionalSlots: [],
  description: "Отключить промокод.",
  plannerHints: ["Use promo.disable_code to expire a promo code now."],
  preview: previewPromo,
  execute: executePromoCodeDisable,
});
