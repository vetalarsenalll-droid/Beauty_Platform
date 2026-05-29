import { defineCrmAgentAction } from "../define-action";
import { executeClientNoteAdd, previewClientMutation } from "./client-write-helpers";

export const clientAddNoteAction = defineCrmAgentAction({
  name: "client.add_note",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.clients.update",
  confirmation: "medium_plus",
  requiredSlots: ["clientId", "note"],
  optionalSlots: [],
  description: "Добавить заметку.",
  plannerHints: ["Use client.add_note after the client and note text are known."],
  preview: previewClientMutation,
  execute: executeClientNoteAdd,
});
