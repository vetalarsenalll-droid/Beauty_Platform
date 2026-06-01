export type PaymentProviderCode = "manual" | "tbank" | "sber" | "alfa";
export type PaymentMethodCode = "card" | "sbp" | "tpay" | "bank_transfer";

export type ReceiptItemInput = {
  name: string;
  quantity: number;
  unitPriceRub: number;
  amountRub: number;
  vat: string;
  paymentObject: string;
  paymentMethod: string;
};

export type CreatePaymentInput = {
  invoiceId: number;
  method: PaymentMethodCode;
  customerEmail?: string | null;
  customerPhone?: string | null;
  returnUrl?: string;
  failUrl?: string;
};

export type CreatePaymentResult = {
  provider: PaymentProviderCode;
  method: PaymentMethodCode;
  providerPaymentId: string;
  paymentUrl?: string;
  qrPayload?: string;
  qrUrl?: string;
  raw: unknown;
};

export type WebhookVerifyInput = {
  payload: Record<string, unknown>;
};

export type WebhookVerifyResult = {
  valid: boolean;
  providerPaymentId: string | null;
  orderId: string | null;
  status: string | null;
  raw: Record<string, unknown>;
};

export type PaymentProvider = {
  code: PaymentProviderCode;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhook(input: WebhookVerifyInput): Promise<WebhookVerifyResult>;
};
