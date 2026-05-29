import { defineCrmAgentAction } from "../define-action";
import { executeGiftCardUpdate, previewLoyaltyPayload } from "./loyalty-helpers";

export const giftCardUpdateAction = defineCrmAgentAction({
  name: "gift_card.update",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.gift_cards.manage",
  confirmation: "always",
  requiredSlots: ["giftCardId"],
  optionalSlots: ["code", "amount", "balance", "status", "expiresAt"],
  description: "Изменить подарочную карту.",
  plannerHints: ["Use gift_card.update to change amount, balance, status or expiry."],
  preview: previewLoyaltyPayload,
  execute: executeGiftCardUpdate,
});
