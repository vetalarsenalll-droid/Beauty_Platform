import { defineCrmAgentAction } from "../define-action";
import { executeArchivePublicPage, previewSitePayload } from "./site-helpers";

export const siteArchivePublicPageAction = defineCrmAgentAction({
  name: "site.archive_public_page",
  domain: "site",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Архивировать публичную страницу.",
  plannerHints: ["Use site.archive_public_page to unpublish by returning the page to DRAFT."],
  preview: previewSitePayload,
  execute: executeArchivePublicPage,
});
