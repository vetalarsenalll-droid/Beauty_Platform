import { defineCrmAgentAction } from "../define-action";
import { executeDomainAction, previewDomainAction } from "./domain-helpers";

export const domainSetPrimaryAction = defineCrmAgentAction({
  name: "domain.set_primary",
  domain: "domains",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Сделать домен основным.",
  plannerHints: ["Use domain.set_primary only after required slots are resolved and the user intent matches: Сделать домен основным."],
  preview: (payload, ctx) => previewDomainAction("domain.set_primary", payload, ctx),
  execute: (payload, ctx) => executeDomainAction("domain.set_primary", payload, ctx),
});
