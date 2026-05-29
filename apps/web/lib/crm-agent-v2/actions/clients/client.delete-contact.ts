import { defineCrmAgentAction } from "../define-action";
import { executeClientContactDelete, previewClientMutation } from "./client-write-helpers";

export const clientDeleteContactAction = defineCrmAgentAction({
  name: "client.delete_contact",
  domain: "clients",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.clients.update",
  confirmation: "always",
  requiredSlots: ["contactId"],
  optionalSlots: [],
  description: "Удалить контакт клиента.",
  plannerHints: ["Use client.delete_contact only after the contact id is confirmed."],
  preview: previewClientMutation,
  execute: executeClientContactDelete,
});
