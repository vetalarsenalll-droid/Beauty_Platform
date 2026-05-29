import { defineCrmAgentAction } from "../define-action";
import { executeWebhookCreateEndpoint, previewIntegrationPayload } from "./integration-helpers";

export const webhookCreateEndpointAction = defineCrmAgentAction({
  name: "webhook.create_endpoint",
  domain: "integrations",
  kind: "system",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.integrations.manage",
  confirmation: "always",
  requiredSlots: ["url", "secret", "events"],
  optionalSlots: ["status"],
  description: "Создать webhook endpoint.",
  plannerHints: ["Use webhook.create_endpoint to create a local webhook endpoint subscription."],
  preview: previewIntegrationPayload,
  execute: executeWebhookCreateEndpoint,
});
