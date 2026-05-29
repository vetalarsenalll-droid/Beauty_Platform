import { defineCrmAgentAction } from "../define-action";
import { executeLegalArchiveDocument, previewLegalPayload } from "./legal-helpers";

export const legalArchiveDocumentAction = defineCrmAgentAction({
  name: "legal.archive_document",
  domain: "legal",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.legal.manage",
  confirmation: "always",
  requiredSlots: ["documentId"],
  optionalSlots: ["sortOrder"],
  description: "Архивировать документ.",
  plannerHints: ["Use legal.archive_document to make a document non-required and deactivate its active versions without deleting history."],
  preview: previewLegalPayload,
  execute: executeLegalArchiveDocument,
});
