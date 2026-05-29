import { defineCrmAgentAction } from "../define-action";
import { executeUpdateSeoGlobal, previewSitePayload } from "./site-helpers";

export const siteUpdateSeoGlobalAction = defineCrmAgentAction({
  name: "site.update_seo_global",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["title", "description", "ogImageUrl", "robots", "sitemapEnabled", "schemaJson", "verificationMetaTags"],
  description: "Изменить глобальное SEO.",
  plannerHints: ["Use site.update_seo_global to update account-wide SEO settings."],
  preview: previewSitePayload,
  execute: executeUpdateSeoGlobal,
});
