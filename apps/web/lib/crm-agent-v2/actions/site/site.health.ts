import { defineCrmAgentAction } from "../define-action";
import { readSiteHealth } from "./site-helpers";

export const siteHealthAction = defineCrmAgentAction({
  name: "site.health",
  domain: "site",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.settings.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Проверить полноту сайта/SEO/страниц.",
  plannerHints: ["Use site.health to inspect public page, SEO and publishing readiness."],
  read: async (_payload, ctx) => readSiteHealth(ctx.accountId),
});
