import { defineCrmAgentAction } from "../define-action";
import { executeClientContactUpdate, previewClientMutation } from "./client-write-helpers";

export const clientUpdateContactAction = defineCrmAgentAction({
  name: "client.update_contact",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.clients.update",
  confirmation: "medium_plus",
  requiredSlots: ["contactId"],
  optionalSlots: ["type", "value", "verifiedAt"],
  description: "Изменить контакт клиента.",
  plannerHints: ["Use client.update_contact when a client contact id is known."],
  preview: previewClientMutation,
  execute: executeClientContactUpdate,
});
