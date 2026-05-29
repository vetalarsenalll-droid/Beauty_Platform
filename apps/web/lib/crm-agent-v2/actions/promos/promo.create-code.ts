import { defineCrmAgentAction } from "../define-action";
import { executePromoCodeCreate, previewPromo } from "./promo-helpers";

export const promoCreateCodeAction = defineCrmAgentAction({
  name: "promo.create_code",
  domain: "promos",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.promos.update",
  confirmation: "medium_plus",
  requiredSlots: ["promoId", "code"],
  optionalSlots: ["startsAt", "endsAt", "maxUses", "maxUsesPerClient"],
  description: "Создать промокод.",
  plannerHints: ["Use promo.create_code to add a code to an existing promotion."],
  preview: previewPromo,
  execute: executePromoCodeCreate,
});
