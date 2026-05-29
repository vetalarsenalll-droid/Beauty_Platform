import { defineCrmAgentAction } from "../define-action";
import { executeClientTagCreate, previewClientMutation } from "./client-write-helpers";

export const clientCreateTagAction = defineCrmAgentAction({
  name: "client.create_tag",
  domain: "clients",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "low",
  permission: "crm.clients.update",
  confirmation: "never",
  requiredSlots: ["name"],
  optionalSlots: [],
  description: "Создать тег.",
  plannerHints: ["Use client.create_tag when the user wants a reusable client tag."],
  preview: previewClientMutation,
  execute: executeClientTagCreate,
});
