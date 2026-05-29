import { defineCrmAgentAction } from "../define-action";
import { executeWebhookDisableEndpoint, previewIntegrationPayload } from "./integration-helpers";

export const webhookDisableEndpointAction = defineCrmAgentAction({
  name: "webhook.disable_endpoint",
  domain: "integrations",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.integrations.manage",
  confirmation: "always",
  requiredSlots: ["endpointId"],
  optionalSlots: ["webhookEndpointId"],
  description: "Отключить webhook endpoint.",
  plannerHints: ["Use webhook.disable_endpoint to set an endpoint status to DISABLED."],
  preview: previewIntegrationPayload,
  execute: executeWebhookDisableEndpoint,
});
