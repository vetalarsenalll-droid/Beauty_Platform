import { defineCrmAgentAction } from "../define-action";
import { executePaymentIntentCancel, previewFinancePayload } from "./finance-write-helpers";

export const paymentIntentCancelAction = defineCrmAgentAction({
  name: "payment_intent.cancel",
  domain: "finance",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.finance.manage",
  confirmation: "always",
  requiredSlots: ["paymentIntentId"],
  optionalSlots: [],
  description: "Отменить намерение платежа.",
  plannerHints: ["Use payment_intent.cancel to mark a local payment intent as CANCELLED."],
  preview: previewFinancePayload,
  execute: executePaymentIntentCancel,
});
