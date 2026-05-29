import { defineCrmAgentAction } from "../define-action";
import { executeUpdateSeoPage, previewSitePayload } from "./site-helpers";

export const siteUpdateSeoPageAction = defineCrmAgentAction({
  name: "site.update_seo_page",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: ["pageKey"],
  optionalSlots: ["title", "description", "ogImageUrl", "keywords", "canonicalUrl", "noIndex", "noFollow"],
  description: "Изменить SEO страницы.",
  plannerHints: ["Use site.update_seo_page to update SEO for one pageKey."],
  preview: previewSitePayload,
  execute: executeUpdateSeoPage,
});
