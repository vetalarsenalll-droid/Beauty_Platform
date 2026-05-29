import { defineCrmAgentAction } from "../define-action";
import { executeWebhookDeleteEndpoint, previewIntegrationPayload } from "./integration-helpers";

export const webhookDeleteEndpointAction = defineCrmAgentAction({
  name: "webhook.delete_endpoint",
  domain: "integrations",
  kind: "system",
  intent: "delete",
  status: "implemented",
  risk: "critical",
  permission: "crm.integrations.manage",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["endpointId"],
  optionalSlots: ["webhookEndpointId"],
  description: "Удалить webhook endpoint.",
  plannerHints: ["Use webhook.delete_endpoint to delete an endpoint and its local webhook delivery rows."],
  preview: previewIntegrationPayload,
  execute: executeWebhookDeleteEndpoint,
});
