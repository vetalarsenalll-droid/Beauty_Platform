import { defineCrmAgentAction } from "../define-action";
import { previewSpecialistGeneratedBio } from "./specialist-write-helpers";

export const specialistGenerateBioAction = defineCrmAgentAction({
  name: "specialist.generate_bio",
  domain: "specialists",
  kind: "generate",
  intent: "execute",
  status: "draft_only",
  risk: "medium",
  permission: "crm.specialists.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId"],
  optionalSlots: ["tone"],
  description: "Сгенерировать био как черновик.",
  plannerHints: ["Use specialist.generate_bio only after required slots are resolved and the user intent matches: Сгенерировать био как черновик."],
  preview: previewSpecialistGeneratedBio,
});
