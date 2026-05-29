import type { CrmAgentActionDefinition } from "../types";
import { giftCardActivateAction } from "./gift-card.activate";
import { giftCardCancelAction } from "./gift-card.cancel";
import { giftCardCreateAction } from "./gift-card.create";
import { giftCardSearchAction } from "./gift-card.search";
import { giftCardUpdateAction } from "./gift-card.update";
import { loyaltyAdjustBalanceAction } from "./loyalty.adjust-balance";
import { loyaltyCreateRuleAction } from "./loyalty.create-rule";
import { loyaltyDisableRuleAction } from "./loyalty.disable-rule";
import { loyaltyUpdateRuleAction } from "./loyalty.update-rule";
import { loyaltyViewTransactionsAction } from "./loyalty.view-transactions";
import { loyaltyViewWalletAction } from "./loyalty.view-wallet";
import { membershipActivateAction } from "./membership.activate";
import { membershipCancelAction } from "./membership.cancel";
import { membershipCreateAction } from "./membership.create";
import { membershipRedeemAction } from "./membership.redeem";
import { membershipSearchAction } from "./membership.search";
import { membershipUpdateAction } from "./membership.update";

export const loyaltyActions: CrmAgentActionDefinition[] = [
  giftCardActivateAction,
  giftCardCancelAction,
  giftCardCreateAction,
  giftCardSearchAction,
  giftCardUpdateAction,
  loyaltyAdjustBalanceAction,
  loyaltyCreateRuleAction,
  loyaltyDisableRuleAction,
  loyaltyUpdateRuleAction,
  loyaltyViewTransactionsAction,
  loyaltyViewWalletAction,
  membershipActivateAction,
  membershipCancelAction,
  membershipCreateAction,
  membershipRedeemAction,
  membershipSearchAction,
  membershipUpdateAction,
];
