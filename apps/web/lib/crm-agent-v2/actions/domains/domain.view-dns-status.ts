import { defineCrmAgentAction } from "../define-action";
import { readDomainAction } from "./domain-helpers";

export const domainViewDnsStatusAction = defineCrmAgentAction({
  name: "domain.view_dns_status",
  domain: "domains",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.settings.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать DNS-статус.",
  plannerHints: ["Use domain.view_dns_status when the user asks to inspect: Показать DNS-статус."],
  read: (payload, ctx) => readDomainAction("domain.view_dns_status", payload, ctx),
});
