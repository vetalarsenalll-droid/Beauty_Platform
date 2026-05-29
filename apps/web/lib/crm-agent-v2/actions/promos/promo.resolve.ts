import { defineCrmAgentAction } from "../define-action";
import { resolvePromo } from "./promo-helpers";

export const promoResolveAction = defineCrmAgentAction({
  name: "promo.resolve",
  domain: "promos",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.promos.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "take"],
  description: "Разрешить неоднозначную акцию.",
  plannerHints: ["Use promo.resolve to choose one promotion from candidates."],
  read: async (payload, ctx) => resolvePromo(ctx.accountId, payload),
});
