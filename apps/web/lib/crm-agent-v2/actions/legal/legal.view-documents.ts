import { defineCrmAgentAction } from "../define-action";
import { readLegalDocuments } from "./legal-helpers";

export const legalViewDocumentsAction = defineCrmAgentAction({
  name: "legal.view_documents",
  domain: "legal",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.legal.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["documentId", "key"],
  description: "Показать юридические документы.",
  plannerHints: ["Use legal.view_documents to inspect account legal documents and versions."],
  read: (payload, ctx) => readLegalDocuments(ctx.accountId, payload),
});
