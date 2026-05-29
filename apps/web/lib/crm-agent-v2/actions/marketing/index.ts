import type { CrmAgentActionDefinition } from "../types";
import { campaignAnalyzeConversionsAction } from "./campaign.analyze-conversions";
import { campaignCancelAction } from "./campaign.cancel";
import { campaignCreateBirthdayAction } from "./campaign.create-birthday";
import { campaignCreateEmptySlotsAction } from "./campaign.create-empty-slots";
import { campaignCreateReactivationAction } from "./campaign.create-reactivation";
import { campaignCreateRepeatVisitAction } from "./campaign.create-repeat-visit";
import { campaignCreateRetentionAction } from "./campaign.create-retention";
import { campaignCreateSeasonalAction } from "./campaign.create-seasonal";
import { campaignPauseAction } from "./campaign.pause";
import { campaignPreviewAudienceAction } from "./campaign.preview-audience";
import { campaignScheduleAction } from "./campaign.schedule";
import { campaignSendAction } from "./campaign.send";
import { campaignUpdateAudienceAction } from "./campaign.update-audience";
import { campaignUpdateMessageAction } from "./campaign.update-message";
import { campaignUpdateOfferAction } from "./campaign.update-offer";
import { campaignViewResultsAction } from "./campaign.view-results";

export const marketingActions: CrmAgentActionDefinition[] = [
  campaignAnalyzeConversionsAction,
  campaignCancelAction,
  campaignCreateBirthdayAction,
  campaignCreateEmptySlotsAction,
  campaignCreateReactivationAction,
  campaignCreateRepeatVisitAction,
  campaignCreateRetentionAction,
  campaignCreateSeasonalAction,
  campaignPauseAction,
  campaignPreviewAudienceAction,
  campaignScheduleAction,
  campaignSendAction,
  campaignUpdateAudienceAction,
  campaignUpdateMessageAction,
  campaignUpdateOfferAction,
  campaignViewResultsAction,
];
