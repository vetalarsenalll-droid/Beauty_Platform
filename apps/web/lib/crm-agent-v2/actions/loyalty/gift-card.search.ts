import { defineCrmAgentAction } from "../define-action";
import { readGiftCards } from "./loyalty-helpers";

export const giftCardSearchAction = defineCrmAgentAction({
  name: "gift_card.search",
  domain: "loyalty",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.gift_cards.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["query", "status", "take"],
  description: "Найти подарочные карты.",
  plannerHints: ["Use gift_card.search to find gift cards by code or status."],
  read: async (payload, ctx) => readGiftCards(ctx.accountId, payload),
});
