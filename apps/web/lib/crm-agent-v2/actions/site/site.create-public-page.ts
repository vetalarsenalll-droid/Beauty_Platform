import { defineCrmAgentAction } from "../define-action";
import { executeCreatePublicPage, previewSitePayload } from "./site-helpers";

export const siteCreatePublicPageAction = defineCrmAgentAction({
  name: "site.create_public_page",
  domain: "site",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["status", "draftJson"],
  description: "Создать публичную страницу.",
  plannerHints: ["Use site.create_public_page to initialize the account public page draft."],
  preview: previewSitePayload,
  execute: executeCreatePublicPage,
});
