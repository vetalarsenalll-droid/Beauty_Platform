import { defineCrmAgentAction } from "../define-action";
import { executePromoUpdate, previewPromo } from "./promo-helpers";

export const promoUpdateAction = defineCrmAgentAction({
  name: "promo.update",
  domain: "promos",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.promos.update",
  confirmation: "medium_plus",
  requiredSlots: ["promoId"],
  optionalSlots: ["name", "type", "value", "startsAt", "endsAt", "isActive"],
  description: "Изменить акцию.",
  plannerHints: ["Use promo.update when promoId is known."],
  preview: previewPromo,
  execute: executePromoUpdate,
});
