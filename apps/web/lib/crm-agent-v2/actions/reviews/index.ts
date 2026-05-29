import type { CrmAgentActionDefinition } from "../types";
import { reviewAnalyzeComplaintsAction } from "./review.analyze-complaints";
import { reviewAttachReplyMediaAction } from "./review.attach-reply-media";
import { reviewBulkUpdateStatusAction } from "./review.bulk-update-status";
import { reviewChangeStatusAction } from "./review.change-status";
import { reviewDeleteReplyAction } from "./review.delete-reply";
import { reviewFindNegativeAction } from "./review.find-negative";
import { reviewFindUnansweredAction } from "./review.find-unanswered";
import { reviewGenerateReplyAction } from "./review.generate-reply";
import { reviewRemoveReplyMediaAction } from "./review.remove-reply-media";
import { reviewReplyAction } from "./review.reply";
import { reviewResolveAction } from "./review.resolve";
import { reviewSearchAction } from "./review.search";
import { reviewSuggestProcessFixAction } from "./review.suggest-process-fix";
import { reviewUpdateReplyAction } from "./review.update-reply";
import { reviewViewAction } from "./review.view";

export const reviewsActions: CrmAgentActionDefinition[] = [
  reviewAnalyzeComplaintsAction,
  reviewAttachReplyMediaAction,
  reviewBulkUpdateStatusAction,
  reviewChangeStatusAction,
  reviewDeleteReplyAction,
  reviewFindNegativeAction,
  reviewFindUnansweredAction,
  reviewGenerateReplyAction,
  reviewRemoveReplyMediaAction,
  reviewReplyAction,
  reviewResolveAction,
  reviewSearchAction,
  reviewSuggestProcessFixAction,
  reviewUpdateReplyAction,
  reviewViewAction,
];
