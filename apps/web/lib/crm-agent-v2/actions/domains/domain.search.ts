import { defineCrmAgentAction } from "../define-action";
import { readDomainAction } from "./domain-helpers";

export const domainSearchAction = defineCrmAgentAction({
  name: "domain.search",
  domain: "domains",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.settings.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Найти домены аккаунта.",
  plannerHints: ["Use domain.search when the user asks to inspect: Найти домены аккаунта."],
  read: (payload, ctx) => readDomainAction("domain.search", payload, ctx),
});
