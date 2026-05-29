import { defineCrmAgentAction } from "../define-action";
import { executeClientTagAdd, previewClientMutation } from "./client-write-helpers";

export const clientAddTagAction = defineCrmAgentAction({
  name: "client.add_tag",
  domain: "clients",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "low",
  permission: "crm.clients.update",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["tagId", "name"],
  description: "Добавить тег клиенту.",
  plannerHints: ["Use client.add_tag when the client is known and either tagId or tag name is available."],
  preview: previewClientMutation,
  execute: executeClientTagAdd,
});
