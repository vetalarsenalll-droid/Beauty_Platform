import { defineCrmAgentAction } from "../define-action";
import { executeRefundCreate, previewFinancePayload } from "./finance-write-helpers";

export const refundCreateAction = defineCrmAgentAction({
  name: "refund.create",
  domain: "finance",
  kind: "system",
  intent: "create",
  status: "implemented",
  risk: "critical",
  permission: "crm.finance.refund",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["amount"],
  optionalSlots: ["transactionId", "paymentIntentId", "intentId", "reason"],
  description: "Создать возврат.",
  plannerHints: ["Use refund.create to create a local pending refund record; provider settlement is outside this action."],
  preview: previewFinancePayload,
  execute: executeRefundCreate,
});
