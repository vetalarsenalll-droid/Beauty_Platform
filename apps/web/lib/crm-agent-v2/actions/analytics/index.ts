import type { CrmAgentActionDefinition } from "../types";
import { analyticsAttentionReviewAction } from "./analytics.attention-review";
import { analyticsCampaignConversionAction } from "./analytics.campaign-conversion";
import { analyticsCancellationsAction } from "./analytics.cancellations";
import { analyticsDailyBriefAction } from "./analytics.daily-brief";
import { analyticsDecliningServicesAction } from "./analytics.declining-services";
import { analyticsEmptyWindowsAction } from "./analytics.empty-windows";
import { analyticsFindGrowthOpportunitiesAction } from "./analytics.find-growth-opportunities";
import { analyticsForecastAction } from "./analytics.forecast";
import { analyticsNoShowRateAction } from "./analytics.no-show-rate";
import { analyticsRetentionAction } from "./analytics.retention";
import { analyticsRevenueAction } from "./analytics.revenue";
import { analyticsReviewThemesAction } from "./analytics.review-themes";
import { analyticsTopClientsAction } from "./analytics.top-clients";
import { analyticsTopServicesAction } from "./analytics.top-services";
import { analyticsUnderloadedSpecialistsAction } from "./analytics.underloaded-specialists";
import { analyticsWeeklyBriefAction } from "./analytics.weekly-brief";
import { analyticsWorkloadAction } from "./analytics.workload";

export const analyticsActions: CrmAgentActionDefinition[] = [
  analyticsAttentionReviewAction,
  analyticsCampaignConversionAction,
  analyticsCancellationsAction,
  analyticsDailyBriefAction,
  analyticsDecliningServicesAction,
  analyticsEmptyWindowsAction,
  analyticsFindGrowthOpportunitiesAction,
  analyticsForecastAction,
  analyticsNoShowRateAction,
  analyticsRetentionAction,
  analyticsRevenueAction,
  analyticsReviewThemesAction,
  analyticsTopClientsAction,
  analyticsTopServicesAction,
  analyticsUnderloadedSpecialistsAction,
  analyticsWeeklyBriefAction,
  analyticsWorkloadAction,
];
