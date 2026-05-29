import { defineCrmAgentAction } from "../define-action";
import { executeWebhookUpdateEndpoint, previewIntegrationPayload } from "./integration-helpers";

export const webhookUpdateEndpointAction = defineCrmAgentAction({
  name: "webhook.update_endpoint",
  domain: "integrations",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.integrations.manage",
  confirmation: "always",
  requiredSlots: ["endpointId"],
  optionalSlots: ["webhookEndpointId", "url", "secret", "events", "status"],
  description: "Изменить webhook endpoint.",
  plannerHints: ["Use webhook.update_endpoint to change URL, secret, events, or status."],
  preview: previewIntegrationPayload,
  execute: executeWebhookUpdateEndpoint,
});
