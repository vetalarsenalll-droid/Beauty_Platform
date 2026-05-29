import { defineCrmAgentAction } from "../define-action";
import { executePromoCodeUpdate, previewPromo } from "./promo-helpers";

export const promoUpdateCodeAction = defineCrmAgentAction({
  name: "promo.update_code",
  domain: "promos",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.promos.update",
  confirmation: "medium_plus",
  requiredSlots: ["promoCodeId"],
  optionalSlots: ["code", "startsAt", "endsAt", "maxUses", "maxUsesPerClient"],
  description: "Изменить промокод.",
  plannerHints: ["Use promo.update_code when promoCodeId is known."],
  preview: previewPromo,
  execute: executePromoCodeUpdate,
});
