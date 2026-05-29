import { defineCrmAgentAction } from "../define-action";
import { executeClientConsentUpdate, previewClientMutation } from "./client-write-helpers";

export const clientUpdateConsentAction = defineCrmAgentAction({
  name: "client.update_consent",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.clients.update",
  confirmation: "always",
  requiredSlots: ["clientId", "type"],
  optionalSlots: ["granted"],
  description: "Изменить согласия на уведомления/персональные данные.",
  plannerHints: ["Use client.update_consent only when the client, consent type and desired state are explicit."],
  preview: previewClientMutation,
  execute: executeClientConsentUpdate,
});
