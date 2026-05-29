import { defineCrmAgentAction } from "../define-action";
import { executeReceiptResend, previewFinancePayload } from "./finance-write-helpers";

export const receiptResendAction = defineCrmAgentAction({
  name: "receipt.resend",
  domain: "finance",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "medium",
  permission: "crm.finance.manage",
  confirmation: "medium_plus",
  requiredSlots: ["receiptId"],
  optionalSlots: ["email"],
  description: "Переотправить чек.",
  plannerHints: ["Use receipt.resend to enqueue a receipt resend job in outbox."],
  preview: previewFinancePayload,
  execute: executeReceiptResend,
});
