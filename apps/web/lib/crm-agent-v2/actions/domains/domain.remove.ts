import { defineCrmAgentAction } from "../define-action";
import { executeDomainAction, previewDomainAction } from "./domain-helpers";

export const domainRemoveAction = defineCrmAgentAction({
  name: "domain.remove",
  domain: "domains",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Удалить домен.",
  plannerHints: ["Use domain.remove only after required slots are resolved and the user intent matches: Удалить домен."],
  preview: (payload, ctx) => previewDomainAction("domain.remove", payload, ctx),
  execute: (payload, ctx) => executeDomainAction("domain.remove", payload, ctx),
});
