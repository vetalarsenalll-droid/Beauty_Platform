import type { CrmAgentActionDefinition } from "../types";
import { deliveryViewStatusAction } from "./delivery.view-status";
import { notificationCreateTemplateAction } from "./notification.create-template";
import { notificationDeleteTemplateAction } from "./notification.delete-template";
import { notificationPreviewAction } from "./notification.preview";
import { notificationRetryFailedAction } from "./notification.retry-failed";
import { notificationSearchAction } from "./notification.search";
import { notificationSendClientAction } from "./notification.send-client";
import { notificationSendSegmentAction } from "./notification.send-segment";
import { notificationUpdatePreferencesAction } from "./notification.update-preferences";
import { notificationUpdateTemplateAction } from "./notification.update-template";
import { notificationViewAction } from "./notification.view";
import { outboxRetryAction } from "./outbox.retry";
import { outboxSearchAction } from "./outbox.search";

export const notificationsActions: CrmAgentActionDefinition[] = [
  deliveryViewStatusAction,
  notificationCreateTemplateAction,
  notificationDeleteTemplateAction,
  notificationPreviewAction,
  notificationRetryFailedAction,
  notificationSearchAction,
  notificationSendClientAction,
  notificationSendSegmentAction,
  notificationUpdatePreferencesAction,
  notificationUpdateTemplateAction,
  notificationViewAction,
  outboxRetryAction,
  outboxSearchAction,
];
