import { defineCrmAgentAction } from "../define-action";
import { readPublicPage } from "./site-helpers";

export const siteViewPublicPageAction = defineCrmAgentAction({
  name: "site.view_public_page",
  domain: "site",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.settings.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать публичную страницу.",
  plannerHints: ["Use site.view_public_page to inspect public page draft, sections and blocks."],
  read: async (_payload, ctx) => readPublicPage(ctx.accountId),
});
