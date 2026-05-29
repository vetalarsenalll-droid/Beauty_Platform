import { defineCrmAgentAction } from "../define-action";
import { executeIntegrationUnsubscribe, previewIntegrationPayload } from "./integration-helpers";

export const integrationUnsubscribeAction = defineCrmAgentAction({
  name: "integration.unsubscribe",
  domain: "integrations",
  kind: "system",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.integrations.manage",
  confirmation: "always",
  requiredSlots: ["endpointId"],
  optionalSlots: ["webhookEndpointId"],
  description: "Отписать интеграцию/endpoint.",
  plannerHints: ["Use integration.unsubscribe to disable a webhook endpoint without deleting history."],
  preview: previewIntegrationPayload,
  execute: executeIntegrationUnsubscribe,
});
