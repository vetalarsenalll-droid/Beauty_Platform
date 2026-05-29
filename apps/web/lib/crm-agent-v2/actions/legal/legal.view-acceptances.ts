import { defineCrmAgentAction } from "../define-action";
import { readLegalAcceptances } from "./legal-helpers";

export const legalViewAcceptancesAction = defineCrmAgentAction({
  name: "legal.view_acceptances",
  domain: "legal",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.legal.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["clientId", "appointmentId", "documentVersionId", "take"],
  description: "Показать принятия документов.",
  plannerHints: ["Use legal.view_acceptances to inspect document acceptances by client, appointment, or version."],
  read: (payload, ctx) => readLegalAcceptances(ctx.accountId, payload),
});
