import { defineCrmAgentAction } from "../define-action";
import { previewSitePayload } from "./site-helpers";

export const sitePreviewChangesAction = defineCrmAgentAction({
  name: "site.preview_changes",
  domain: "site",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.settings.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["draftJson", "changes"],
  description: "Показать preview изменений сайта.",
  plannerHints: ["Use site.preview_changes to render a deterministic preview payload before applying site changes."],
  read: async (payload) => ({ preview: (await previewSitePayload(payload)).after }),
});
