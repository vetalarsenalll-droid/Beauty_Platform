import { defineCrmAgentAction } from "../define-action";
import { executeGiftCardStatus, previewLoyaltyPayload } from "./loyalty-helpers";

export const giftCardActivateAction = defineCrmAgentAction({
  name: "gift_card.activate",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.gift_cards.manage",
  confirmation: "always",
  requiredSlots: ["giftCardId"],
  optionalSlots: [],
  description: "Активировать подарочную карту.",
  plannerHints: ["Use gift_card.activate to set one gift card status to ACTIVE."],
  preview: previewLoyaltyPayload,
  execute: (payload, ctx) => executeGiftCardStatus(payload, ctx, "ACTIVE"),
});
