import { defineCrmAgentAction } from "../define-action";
import { executeLegalCreateDocument, previewLegalPayload } from "./legal-helpers";

export const legalCreateDocumentAction = defineCrmAgentAction({
  name: "legal.create_document",
  domain: "legal",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.legal.manage",
  confirmation: "always",
  requiredSlots: ["key", "title"],
  optionalSlots: ["description", "isRequired", "sortOrder", "content", "publishNow"],
  description: "Создать юридический документ.",
  plannerHints: ["Use legal.create_document to create a legal document and optional first draft version."],
  preview: previewLegalPayload,
  execute: executeLegalCreateDocument,
});
