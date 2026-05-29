import { defineCrmAgentAction } from "../define-action";
import { readDomainAction } from "./domain-helpers";

export const domainCheckAction = defineCrmAgentAction({
  name: "domain.check",
  domain: "domains",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.settings.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Проверить DNS домена.",
  plannerHints: ["Use domain.check when the user asks to inspect: Проверить DNS домена."],
  read: (payload, ctx) => readDomainAction("domain.check", payload, ctx),
});
