import { defineCrmAgentAction } from "../define-action";
import { previewClientNotify } from "./client-write-helpers";

export const clientNotifyAction = defineCrmAgentAction({
  name: "client.notify",
  domain: "clients",
  kind: "write",
  intent: "notify",
  status: "draft_only",
  risk: "high",
  permission: "crm.notifications.send",
  confirmation: "always",
  requiredSlots: ["clientId", "bodyText"],
  optionalSlots: ["channel", "subject"],
  description: "Отправить уведомление одному клиенту.",
  plannerHints: ["Use client.notify to draft a single-recipient message with consent-aware preview."],
  preview: previewClientNotify,
});
