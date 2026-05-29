import { defineCrmAgentAction } from "../define-action";
import { executeClientNoteDelete, previewClientMutation } from "./client-write-helpers";

export const clientDeleteNoteAction = defineCrmAgentAction({
  name: "client.delete_note",
  domain: "clients",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.clients.update",
  confirmation: "always",
  requiredSlots: ["noteId"],
  optionalSlots: [],
  description: "Удалить заметку.",
  plannerHints: ["Use client.delete_note only after the note id is confirmed."],
  preview: previewClientMutation,
  execute: executeClientNoteDelete,
});
