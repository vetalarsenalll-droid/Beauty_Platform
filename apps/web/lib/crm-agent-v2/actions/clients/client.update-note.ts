import { defineCrmAgentAction } from "../define-action";
import { executeClientNoteUpdate, previewClientMutation } from "./client-write-helpers";

export const clientUpdateNoteAction = defineCrmAgentAction({
  name: "client.update_note",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.clients.update",
  confirmation: "medium_plus",
  requiredSlots: ["noteId", "note"],
  optionalSlots: [],
  description: "Изменить заметку.",
  plannerHints: ["Use client.update_note after the note id and replacement text are known."],
  preview: previewClientMutation,
  execute: executeClientNoteUpdate,
});
