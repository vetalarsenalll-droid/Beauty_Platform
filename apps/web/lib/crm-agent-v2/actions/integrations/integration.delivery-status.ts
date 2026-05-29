import { defineCrmAgentAction } from "../define-action";
import { readIntegrationDeliveryStatus } from "./integration-helpers";

export const integrationDeliveryStatusAction = defineCrmAgentAction({
  name: "integration.delivery_status",
  domain: "integrations",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.integrations.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["endpointId", "webhookEndpointId", "status", "take"],
  description: "Показать статус доставки интеграции.",
  plannerHints: ["Use integration.delivery_status to inspect webhook and outbox delivery status."],
  read: (payload, ctx) => readIntegrationDeliveryStatus(ctx.accountId, payload),
});
