import type { CrmAgentActionDefinition } from "../types";
import { accountExportDataAction } from "./account.export-data";
import { accountUpdateAddressAction } from "./account.update-address";
import { accountUpdateBookingRulesAction } from "./account.update-booking-rules";
import { accountUpdateBrandingAction } from "./account.update-branding";
import { accountUpdateBusinessTypeAction } from "./account.update-business-type";
import { accountUpdateCancellationRulesAction } from "./account.update-cancellation-rules";
import { accountUpdateColorsAction } from "./account.update-colors";
import { accountUpdateContactsAction } from "./account.update-contacts";
import { accountUpdateDepositRulesAction } from "./account.update-deposit-rules";
import { accountUpdateLogoAction } from "./account.update-logo";
import { accountUpdateNameAction } from "./account.update-name";
import { accountUpdateProfileAction } from "./account.update-profile";
import { accountUpdatePublicDescriptionAction } from "./account.update-public-description";
import { accountUpdateRescheduleRulesAction } from "./account.update-reschedule-rules";
import { accountUpdateReviewRulesAction } from "./account.update-review-rules";
import { accountUpdateSlugAction } from "./account.update-slug";
import { accountUpdateStatusAction } from "./account.update-status";
import { accountViewAction } from "./account.view";
import { accountViewAuditAction } from "./account.view-audit";

export const accountActions: CrmAgentActionDefinition[] = [
  accountExportDataAction,
  accountUpdateAddressAction,
  accountUpdateBookingRulesAction,
  accountUpdateBrandingAction,
  accountUpdateBusinessTypeAction,
  accountUpdateCancellationRulesAction,
  accountUpdateColorsAction,
  accountUpdateContactsAction,
  accountUpdateDepositRulesAction,
  accountUpdateLogoAction,
  accountUpdateNameAction,
  accountUpdateProfileAction,
  accountUpdatePublicDescriptionAction,
  accountUpdateRescheduleRulesAction,
  accountUpdateReviewRulesAction,
  accountUpdateSlugAction,
  accountUpdateStatusAction,
  accountViewAction,
  accountViewAuditAction,
];
