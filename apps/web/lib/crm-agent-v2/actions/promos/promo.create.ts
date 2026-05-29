import { defineCrmAgentAction } from "../define-action";
import { executePromoCreate, previewPromo } from "./promo-helpers";

export const promoCreateAction = defineCrmAgentAction({
  name: "promo.create",
  domain: "promos",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.promos.create",
  confirmation: "medium_plus",
  requiredSlots: ["name", "type", "value"],
  optionalSlots: ["startsAt", "endsAt", "isActive"],
  description: "Создать акцию.",
  plannerHints: ["Use promo.create after name, type and value are known."],
  preview: previewPromo,
  execute: executePromoCreate,
});
