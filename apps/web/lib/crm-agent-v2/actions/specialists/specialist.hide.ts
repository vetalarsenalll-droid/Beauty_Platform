import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistProfileUpdate, previewSpecialistProfileUpdate } from "./specialist-write-helpers";

export const specialistHideAction = defineCrmAgentAction({
  name: "specialist.hide",
  domain: "specialists",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.specialists.update",
  confirmation: "always",
  requiredSlots: ["specialistId"],
  optionalSlots: [],
  description: "Скрыть специалиста с публичной страницы.",
  plannerHints: ["Use specialist.hide only after required slots are resolved and the user intent matches: Скрыть специалиста с публичной страницы."],
  preview: (payload, ctx) => previewSpecialistProfileUpdate({ ...payload, isPublic: false }, ctx),
  execute: (payload, ctx) => executeSpecialistProfileUpdate({ ...payload, isPublic: false }, ctx),
});
