import { defineCrmAgentAction } from "../define-action";
import { executePaymentIntentCreate, previewFinancePayload } from "./finance-write-helpers";

export const paymentIntentCreateAction = defineCrmAgentAction({
  name: "payment_intent.create",
  domain: "finance",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.finance.manage",
  confirmation: "always",
  requiredSlots: ["amount"],
  optionalSlots: ["appointmentId", "clientId", "currency", "scenario", "provider", "providerRef", "status"],
  description: "Создать намерение платежа.",
  plannerHints: ["Use payment_intent.create to create a local payment intent record without charging a provider."],
  preview: previewFinancePayload,
  execute: executePaymentIntentCreate,
});
