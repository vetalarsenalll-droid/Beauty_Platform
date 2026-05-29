import { defineCrmAgentAction } from "../define-action";
import { executeClientRestore, previewClientMutation } from "./client-write-helpers";

export const clientRestoreAction = defineCrmAgentAction({
  name: "client.restore",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.clients.update",
  confirmation: "medium_plus",
  requiredSlots: ["clientId"],
  optionalSlots: [],
  description: "Восстановить клиента из архива.",
  plannerHints: ["Use client.restore when the archived client is confirmed."],
  preview: previewClientMutation,
  execute: executeClientRestore,
});
