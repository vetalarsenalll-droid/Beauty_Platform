import { defineCrmAgentAction } from "../define-action";
import { executeClientContactAdd, previewClientMutation } from "./client-write-helpers";

export const clientAddContactAction = defineCrmAgentAction({
  name: "client.add_contact",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.clients.update",
  confirmation: "medium_plus",
  requiredSlots: ["clientId", "type", "value"],
  optionalSlots: ["verifiedAt"],
  description: "Добавить контакт клиента.",
  plannerHints: ["Use client.add_contact after clientId, contact type and value are known."],
  preview: previewClientMutation,
  execute: executeClientContactAdd,
});
