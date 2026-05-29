import { defineCrmAgentAction } from "../define-action";
import { previewOutboxRetry, retryOutbox } from "./notification-helpers";

export const outboxRetryAction = defineCrmAgentAction({
  name: "outbox.retry",
  domain: "notifications",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.notifications.send",
  confirmation: "medium_plus",
  requiredSlots: ["outboxItemId"],
  optionalSlots: [],
  description: "Повторить outbox item.",
  plannerHints: ["Use outbox.retry to put one account outbox item back into PENDING."],
  preview: previewOutboxRetry,
  execute: retryOutbox,
});
