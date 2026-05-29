import { defineCrmAgentAction } from "../define-action";
import { executeLegalPublishVersion, previewLegalPayload } from "./legal-helpers";

export const legalPublishVersionAction = defineCrmAgentAction({
  name: "legal.publish_version",
  domain: "legal",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "critical",
  permission: "crm.legal.manage",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["versionId"],
  optionalSlots: ["documentVersionId"],
  description: "Опубликовать версию документа.",
  plannerHints: ["Use legal.publish_version to make one document version active and deactivate previous active versions."],
  preview: previewLegalPayload,
  execute: executeLegalPublishVersion,
});
