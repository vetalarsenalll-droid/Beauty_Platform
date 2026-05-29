import { defineCrmAgentAction } from "../define-action";
import { readDeliveryStatus } from "./notification-helpers";

export const deliveryViewStatusAction = defineCrmAgentAction({
  name: "delivery.view_status",
  domain: "notifications",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.notifications.read",
  confirmation: "never",
  requiredSlots: ["outboxItemId"],
  optionalSlots: [],
  description: "Показать статус доставки.",
  plannerHints: ["Use delivery.view_status to inspect delivery attempts for one outbox item."],
  read: async (payload, ctx) => readDeliveryStatus(ctx.accountId, payload),
});
