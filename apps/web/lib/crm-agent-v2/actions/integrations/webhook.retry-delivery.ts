import { defineCrmAgentAction } from "../define-action";
import { executeWebhookRetryDelivery, previewIntegrationPayload } from "./integration-helpers";

export const webhookRetryDeliveryAction = defineCrmAgentAction({
  name: "webhook.retry_delivery",
  domain: "integrations",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.integrations.manage",
  confirmation: "medium_plus",
  requiredSlots: ["deliveryId"],
  optionalSlots: ["webhookDeliveryId"],
  description: "Повторить доставку webhook.",
  plannerHints: ["Use webhook.retry_delivery to requeue a local webhook delivery."],
  preview: previewIntegrationPayload,
  execute: executeWebhookRetryDelivery,
});
