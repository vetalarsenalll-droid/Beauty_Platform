import { defineCrmAgentAction } from "../define-action";
import { executeClientArchive, previewClientMutation } from "./client-write-helpers";

export const clientArchiveAction = defineCrmAgentAction({
  name: "client.archive",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.clients.delete",
  confirmation: "always",
  requiredSlots: ["clientId"],
  optionalSlots: [],
  description: "Архивировать клиента без удаления истории.",
  plannerHints: ["Use client.archive only after the client identity is confirmed."],
  preview: previewClientMutation,
  execute: executeClientArchive,
});
