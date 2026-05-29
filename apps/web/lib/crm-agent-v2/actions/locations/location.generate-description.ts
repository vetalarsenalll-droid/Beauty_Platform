import { defineCrmAgentAction } from "../define-action";
import { previewGeneratedLocationDescription } from "./location-write-helpers";

export const locationGenerateDescriptionAction = defineCrmAgentAction({
  name: "location.generate_description",
  domain: "locations",
  kind: "generate",
  intent: "execute",
  status: "draft_only",
  risk: "medium",
  permission: "crm.locations.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId"],
  optionalSlots: ["tone"],
  description: "Сгенерировать описание филиала.",
  plannerHints: ["Use location.generate_description only after required slots are resolved and the user intent matches: Сгенерировать описание филиала."],
  preview: previewGeneratedLocationDescription,
});
