import { defineCrmAgentAction } from "../define-action";
import { executeClientTagRemove, previewClientMutation } from "./client-write-helpers";

export const clientRemoveTagAction = defineCrmAgentAction({
  name: "client.remove_tag",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "low",
  permission: "crm.clients.update",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["tagId", "name"],
  description: "Убрать тег клиента.",
  plannerHints: ["Use client.remove_tag when the client is known and either tagId or tag name is available."],
  preview: previewClientMutation,
  execute: executeClientTagRemove,
});
