import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceDeleteIfEmpty } from "./service-write-helpers";

export const serviceDeleteIfEmptyAction = defineCrmAgentAction({
  name: "service.delete_if_empty",
  domain: "services",
  kind: "system",
  intent: "delete",
  status: "implemented",
  risk: "critical",
  permission: "crm.services.delete",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["serviceId"],
  optionalSlots: [],
  description: "Удалить услугу, только если нет зависимостей.",
  plannerHints: ["Use service.delete_if_empty only after required slots are resolved and the user intent matches: Удалить услугу, только если нет зависимостей."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, deleted: true } }),
  execute: executeServiceDeleteIfEmpty,
});
