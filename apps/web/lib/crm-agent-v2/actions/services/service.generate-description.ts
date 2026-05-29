import { defineCrmAgentAction } from "../define-action";
import { previewGeneratedServiceDescription } from "./service-write-helpers";

export const serviceGenerateDescriptionAction = defineCrmAgentAction({
  name: "service.generate_description",
  domain: "services",
  kind: "generate",
  intent: "execute",
  status: "draft_only",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId"],
  optionalSlots: ["tone"],
  description: "Сгенерировать описание услуги как черновик.",
  plannerHints: ["Use service.generate_description only after required slots are resolved and the user intent matches: Сгенерировать описание услуги как черновик."],
  preview: previewGeneratedServiceDescription,
});
