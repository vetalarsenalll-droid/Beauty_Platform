import { defineCrmAgentAction } from "../define-action";
import { executePromoActive, previewPromo } from "./promo-helpers";

export const promoArchiveAction = defineCrmAgentAction({
  name: "promo.archive",
  domain: "promos",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.promos.update",
  confirmation: "always",
  requiredSlots: ["promoId"],
  optionalSlots: [],
  description: "Архивировать акцию.",
  plannerHints: ["Use promo.archive to deactivate a promotion while preserving history."],
  preview: previewPromo,
  execute: (payload, ctx) => executePromoActive(payload, ctx, false),
});
