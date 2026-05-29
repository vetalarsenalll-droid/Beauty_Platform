import { defineCrmAgentAction } from "../define-action";
import { executeLegalUpdateDocument, previewLegalPayload } from "./legal-helpers";

export const legalUpdateDocumentAction = defineCrmAgentAction({
  name: "legal.update_document",
  domain: "legal",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.legal.manage",
  confirmation: "always",
  requiredSlots: ["documentId"],
  optionalSlots: ["key", "title", "description", "isRequired", "sortOrder", "content"],
  description: "Изменить документ.",
  plannerHints: ["Use legal.update_document for metadata changes; content changes create an inactive draft version."],
  preview: previewLegalPayload,
  execute: executeLegalUpdateDocument,
});
