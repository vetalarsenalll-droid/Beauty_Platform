import { defineCrmAgentAction } from "../define-action";
import { executeAdjustBalance, previewLoyaltyPayload } from "./loyalty-helpers";

export const loyaltyAdjustBalanceAction = defineCrmAgentAction({
  name: "loyalty.adjust_balance",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.loyalty.manage",
  confirmation: "always",
  requiredSlots: ["clientId", "amount"],
  optionalSlots: ["type", "reason", "sourceType", "sourceId", "expiresAt"],
  description: "Изменить баланс лояльности.",
  plannerHints: ["Use loyalty.adjust_balance to append a loyalty ledger transaction and update wallet balance."],
  preview: previewLoyaltyPayload,
  execute: executeAdjustBalance,
});
