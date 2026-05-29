import { defineCrmAgentAction } from "../define-action";
import { previewClientMerge } from "./client-write-helpers";

export const clientMergeDuplicatesAction = defineCrmAgentAction({
  name: "client.merge_duplicates",
  domain: "clients",
  kind: "system",
  intent: "update",
  status: "draft_only",
  risk: "high",
  permission: "crm.clients.merge",
  confirmation: "always",
  requiredSlots: ["targetClientId", "sourceClientId"],
  optionalSlots: [],
  description: "Объединить дубли клиентов.",
  plannerHints: ["Use client.merge_duplicates to preview a merge plan before destructive consolidation."],
  preview: previewClientMerge,
});
