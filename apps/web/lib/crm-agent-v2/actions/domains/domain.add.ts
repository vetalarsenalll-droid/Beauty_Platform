import { defineCrmAgentAction } from "../define-action";
import { executeDomainAction, previewDomainAction } from "./domain-helpers";

export const domainAddAction = defineCrmAgentAction({
  name: "domain.add",
  domain: "domains",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Добавить домен.",
  plannerHints: ["Use domain.add only after required slots are resolved and the user intent matches: Добавить домен."],
  preview: (payload, ctx) => previewDomainAction("domain.add", payload, ctx),
  execute: (payload, ctx) => executeDomainAction("domain.add", payload, ctx),
});
