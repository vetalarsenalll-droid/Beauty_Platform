import { defineCrmAgentAction } from "../define-action";
import { executeGiftCardStatus, previewLoyaltyPayload } from "./loyalty-helpers";

export const giftCardCancelAction = defineCrmAgentAction({
  name: "gift_card.cancel",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.gift_cards.manage",
  confirmation: "always",
  requiredSlots: ["giftCardId"],
  optionalSlots: [],
  description: "Отменить подарочную карту.",
  plannerHints: ["Use gift_card.cancel to set one gift card status to CANCELLED."],
  preview: previewLoyaltyPayload,
  execute: (payload, ctx) => executeGiftCardStatus(payload, ctx, "CANCELLED"),
});
