import { defineCrmAgentAction } from "../define-action";
import { readWallet } from "./loyalty-helpers";

export const loyaltyViewWalletAction = defineCrmAgentAction({
  name: "loyalty.view_wallet",
  domain: "loyalty",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.loyalty.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["take"],
  description: "Показать кошелек лояльности клиента.",
  plannerHints: ["Use loyalty.view_wallet to inspect a client's loyalty wallet and recent transactions."],
  read: async (payload, ctx) => readWallet(ctx.accountId, payload),
});
