import { defineCrmAgentAction } from "../define-action";
import { previewMissingDescriptions } from "./site-helpers";

export const siteGenerateMissingDescriptionsAction = defineCrmAgentAction({
  name: "site.generate_missing_descriptions",
  domain: "site",
  kind: "generate",
  intent: "update",
  status: "draft_only",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: ["take"],
  description: "Сгенерировать недостающие описания как drafts.",
  plannerHints: ["Use site.generate_missing_descriptions to draft deterministic service, specialist and location descriptions."],
  preview: previewMissingDescriptions,
});
