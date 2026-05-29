import type { CrmAgentActionDefinition } from "../types";
import { integrationDeliveryStatusAction } from "./integration.delivery-status";
import { integrationUnsubscribeAction } from "./integration.unsubscribe";
import { webhookCreateEndpointAction } from "./webhook.create-endpoint";
import { webhookDeleteEndpointAction } from "./webhook.delete-endpoint";
import { webhookDisableEndpointAction } from "./webhook.disable-endpoint";
import { webhookRetryDeliveryAction } from "./webhook.retry-delivery";
import { webhookUpdateEndpointAction } from "./webhook.update-endpoint";
import { webhookViewEventsAction } from "./webhook.view-events";

export const integrationsActions: CrmAgentActionDefinition[] = [
  integrationDeliveryStatusAction,
  integrationUnsubscribeAction,
  webhookCreateEndpointAction,
  webhookDeleteEndpointAction,
  webhookDisableEndpointAction,
  webhookRetryDeliveryAction,
  webhookUpdateEndpointAction,
  webhookViewEventsAction,
];
