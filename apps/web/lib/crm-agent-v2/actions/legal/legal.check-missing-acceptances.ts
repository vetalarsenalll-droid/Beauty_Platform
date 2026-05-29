import { defineCrmAgentAction } from "../define-action";
import { readMissingAcceptances } from "./legal-helpers";

export const legalCheckMissingAcceptancesAction = defineCrmAgentAction({
  name: "legal.check_missing_acceptances",
  domain: "legal",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.legal.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["clientId", "appointmentId"],
  description: "Проверить недостающие согласия.",
  plannerHints: ["Use legal.check_missing_acceptances to find required active documents not accepted by a client or appointment client."],
  read: (payload, ctx) => readMissingAcceptances(ctx.accountId, payload),
});
