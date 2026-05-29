import { defineCrmAgentAction } from "../define-action";
import { readWebhookEvents } from "./integration-helpers";

export const webhookViewEventsAction = defineCrmAgentAction({
  name: "webhook.view_events",
  domain: "integrations",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.integrations.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["endpointId", "webhookEndpointId", "eventName", "status", "take"],
  description: "Показать события webhook.",
  plannerHints: ["Use webhook.view_events to inspect webhook events and endpoint deliveries."],
  read: (payload, ctx) => readWebhookEvents(ctx.accountId, payload),
});
