import type { CrmAgentActionDefinition } from "../types";
import { siteApplyChangesAction } from "./site.apply-changes";
import { siteArchivePublicPageAction } from "./site.archive-public-page";
import { siteCreateBlockAction } from "./site.create-block";
import { siteCreatePublicPageAction } from "./site.create-public-page";
import { siteCreateSectionAction } from "./site.create-section";
import { siteDeleteBlockAction } from "./site.delete-block";
import { siteDeleteSectionAction } from "./site.delete-section";
import { siteGenerateMissingDescriptionsAction } from "./site.generate-missing-descriptions";
import { siteHealthAction } from "./site.health";
import { sitePreviewChangesAction } from "./site.preview-changes";
import { siteUpdateBlockAction } from "./site.update-block";
import { siteUpdateBookingSettingsAction } from "./site.update-booking-settings";
import { siteUpdateContactsAction } from "./site.update-contacts";
import { siteUpdateHomeCopyAction } from "./site.update-home-copy";
import { siteUpdateLocationCopyAction } from "./site.update-location-copy";
import { siteUpdatePublicPageAction } from "./site.update-public-page";
import { siteUpdateSectionAction } from "./site.update-section";
import { siteUpdateSeoGlobalAction } from "./site.update-seo-global";
import { siteUpdateSeoPageAction } from "./site.update-seo-page";
import { siteUpdateServiceCopyAction } from "./site.update-service-copy";
import { siteUpdateSpecialistCopyAction } from "./site.update-specialist-copy";
import { siteViewPublicPageAction } from "./site.view-public-page";

export const siteActions: CrmAgentActionDefinition[] = [
  siteApplyChangesAction,
  siteArchivePublicPageAction,
  siteCreateBlockAction,
  siteCreatePublicPageAction,
  siteCreateSectionAction,
  siteDeleteBlockAction,
  siteDeleteSectionAction,
  siteGenerateMissingDescriptionsAction,
  siteHealthAction,
  sitePreviewChangesAction,
  siteUpdateBlockAction,
  siteUpdateBookingSettingsAction,
  siteUpdateContactsAction,
  siteUpdateHomeCopyAction,
  siteUpdateLocationCopyAction,
  siteUpdatePublicPageAction,
  siteUpdateSectionAction,
  siteUpdateSeoGlobalAction,
  siteUpdateSeoPageAction,
  siteUpdateServiceCopyAction,
  siteUpdateSpecialistCopyAction,
  siteViewPublicPageAction,
];
