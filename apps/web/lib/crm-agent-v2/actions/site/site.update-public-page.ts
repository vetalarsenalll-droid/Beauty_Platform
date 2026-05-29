import { defineCrmAgentAction } from "../define-action";
import { executeUpdatePublicPage, previewSitePayload } from "./site-helpers";

export const siteUpdatePublicPageAction = defineCrmAgentAction({
  name: "site.update_public_page",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["status", "draftJson"],
  description: "Изменить публичную страницу.",
  plannerHints: ["Use site.update_public_page to replace draftJson or change page status."],
  preview: previewSitePayload,
  execute: executeUpdatePublicPage,
});
