import type { CrmAgentActionDefinition } from "../types";
import { clientAddContactAction } from "./client.add-contact";
import { clientAddNoteAction } from "./client.add-note";
import { clientAddTagAction } from "./client.add-tag";
import { clientArchiveAction } from "./client.archive";
import { clientCreateAction } from "./client.create";
import { clientCreateSegmentAction } from "./client.create-segment";
import { clientCreateTagAction } from "./client.create-tag";
import { clientDeleteContactAction } from "./client.delete-contact";
import { clientDeleteNoteAction } from "./client.delete-note";
import { clientExportSegmentAction } from "./client.export-segment";
import { clientMergeDuplicatesAction } from "./client.merge-duplicates";
import { clientNotifyAction } from "./client.notify";
import { clientRemoveTagAction } from "./client.remove-tag";
import { clientResolveAction } from "./client.resolve";
import { clientRestoreAction } from "./client.restore";
import { clientSearchAction } from "./client.search";
import { clientUpdateAction } from "./client.update";
import { clientUpdateConsentAction } from "./client.update-consent";
import { clientUpdateContactAction } from "./client.update-contact";
import { clientUpdateNoteAction } from "./client.update-note";
import { clientViewAction } from "./client.view";
import { clientViewHistoryAction } from "./client.view-history";
import { clientViewLoyaltyAction } from "./client.view-loyalty";
import { clientViewPaymentsAction } from "./client.view-payments";
import { clientViewReviewsAction } from "./client.view-reviews";
import { clientViewVisitsAction } from "./client.view-visits";

export const clientsActions: CrmAgentActionDefinition[] = [
  clientAddContactAction,
  clientAddNoteAction,
  clientAddTagAction,
  clientArchiveAction,
  clientCreateAction,
  clientCreateSegmentAction,
  clientCreateTagAction,
  clientDeleteContactAction,
  clientDeleteNoteAction,
  clientExportSegmentAction,
  clientMergeDuplicatesAction,
  clientNotifyAction,
  clientRemoveTagAction,
  clientResolveAction,
  clientRestoreAction,
  clientSearchAction,
  clientUpdateAction,
  clientUpdateConsentAction,
  clientUpdateContactAction,
  clientUpdateNoteAction,
  clientViewAction,
  clientViewHistoryAction,
  clientViewLoyaltyAction,
  clientViewPaymentsAction,
  clientViewReviewsAction,
  clientViewVisitsAction,
];
