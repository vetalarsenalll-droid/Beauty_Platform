import { defineCrmAgentAction } from "../define-action";
import { readAccountAudit } from "./account-helpers";

export const accountViewAuditAction = defineCrmAgentAction({
  name: "account.view_audit",
  domain: "account",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.audit.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать журнал действий аккаунта.",
  plannerHints: ["Use account.view_audit when the user asks to inspect: Показать журнал действий аккаунта."],
  read: readAccountAudit,
});
