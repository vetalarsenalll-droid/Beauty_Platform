import { defineCrmAgentAction } from "../define-action";
import { executeGiftCardCreate, previewLoyaltyPayload } from "./loyalty-helpers";

export const giftCardCreateAction = defineCrmAgentAction({
  name: "gift_card.create",
  domain: "loyalty",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.gift_cards.manage",
  confirmation: "always",
  requiredSlots: ["code", "amount"],
  optionalSlots: ["balance", "status", "expiresAt"],
  description: "Создать подарочную карту.",
  plannerHints: ["Use gift_card.create to issue a local gift card balance."],
  preview: previewLoyaltyPayload,
  execute: executeGiftCardCreate,
});
