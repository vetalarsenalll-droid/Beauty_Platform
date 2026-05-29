import type { CrmAgentActionDefinition } from "../types";
import { promoActivateAction } from "./promo.activate";
import { promoArchiveAction } from "./promo.archive";
import { promoCreateAction } from "./promo.create";
import { promoCreateCodeAction } from "./promo.create-code";
import { promoDeactivateAction } from "./promo.deactivate";
import { promoDisableCodeAction } from "./promo.disable-code";
import { promoResolveAction } from "./promo.resolve";
import { promoRestoreAction } from "./promo.restore";
import { promoSearchAction } from "./promo.search";
import { promoSuggestForBirthdayAction } from "./promo.suggest-for-birthday";
import { promoSuggestForEmptySlotsAction } from "./promo.suggest-for-empty-slots";
import { promoSuggestForRetentionAction } from "./promo.suggest-for-retention";
import { promoUpdateAction } from "./promo.update";
import { promoUpdateCodeAction } from "./promo.update-code";
import { promoViewAction } from "./promo.view";
import { promoViewRedemptionsAction } from "./promo.view-redemptions";

export const promosActions: CrmAgentActionDefinition[] = [
  promoActivateAction,
  promoArchiveAction,
  promoCreateAction,
  promoCreateCodeAction,
  promoDeactivateAction,
  promoDisableCodeAction,
  promoResolveAction,
  promoRestoreAction,
  promoSearchAction,
  promoSuggestForBirthdayAction,
  promoSuggestForEmptySlotsAction,
  promoSuggestForRetentionAction,
  promoUpdateAction,
  promoUpdateCodeAction,
  promoViewAction,
  promoViewRedemptionsAction,
];
