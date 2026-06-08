import type {
  AccountPaymentProvider,
  PaymentConnectionMode,
  ReceiptTaxationSystem,
  ReceiptVatCode,
} from "@prisma/client";

export type AccountPaymentProviderCode = "yookassa" | "tbank" | "sber" | "alfa";
export type AccountPaymentMethodCode = "card" | "sbp" | "tpay" | "sberpay";

export type NormalizedPaymentStatus =
  | "created"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "partially_refunded";

export type YooKassaCredentials = {
  provider: "yookassa";
  shopId: string;
  secretKey: string;
};

export type TbankCredentials = {
  provider: "tbank";
  terminalKey: string;
  password: string;
  apiUrl?: string;
};

export type SberCredentials = {
  provider: "sber";
  apiLogin: string;
  apiPassword: string;
  apiUrl?: string;
  gatewayVersion?: "legacy" | "v1";
};

export type AlfaCredentials = {
  provider: "alfa";
  apiLogin: string;
  apiPassword: string;
  apiUrl?: string;
};

export type AccountPaymentCredentials =
  | YooKassaCredentials
  | TbankCredentials
  | SberCredentials
  | AlfaCredentials;

export type AccountPaymentConnectionSnapshot = {
  id: number;
  accountId: number;
  provider: AccountPaymentProviderCode;
  mode: PaymentConnectionMode;
  title: string | null;
  currency: string;
  receiptEnabled: boolean;
  receiptVat: ReceiptVatCode;
  receiptTaxationSystem: ReceiptTaxationSystem;
  receiptFfdVersion: string | null;
  paymentSubject: string | null;
  paymentMethod: string | null;
  publicConfig: unknown;
};

export type AccountReceiptItemInput = {
  name: string;
  quantity: number;
  unitPriceRub: number;
  amountRub: number;
  vat: ReceiptVatCode;
  paymentSubject?: string | null;
  paymentMethod?: string | null;
};

export type AccountPaymentCustomerInput = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
};

export type CreateAccountPaymentInput = {
  connection: AccountPaymentConnectionSnapshot;
  credentials: AccountPaymentCredentials;
  intent: {
    id: number;
    accountId: number;
    amountRub: number;
    currency: string;
    description: string;
    scenario: string;
    returnUrl: string;
    failUrl: string;
    idempotencyKey: string;
  };
  method: AccountPaymentMethodCode;
  customer?: AccountPaymentCustomerInput;
  receiptItems?: AccountReceiptItemInput[];
  webhookUrl: string;
};

export type CreateAccountPaymentResult = {
  provider: AccountPaymentProviderCode;
  providerRef: string;
  providerStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
  paymentUrl: string;
  paymentMethods?: {
    cardUrl?: string | null;
    sbpQrSvg?: string | null;
    sbpPayload?: string | null;
  };
  raw: unknown;
};

export type GetAccountPaymentStatusInput = {
  connection: AccountPaymentConnectionSnapshot;
  credentials: AccountPaymentCredentials;
  providerRef: string;
};

export type AccountPaymentStatusResult = {
  providerStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
  paidAt?: Date | null;
  raw: unknown;
};

export type RefundAccountPaymentInput = {
  connection: AccountPaymentConnectionSnapshot;
  credentials: AccountPaymentCredentials;
  providerRef: string;
  amountRub: number;
  idempotencyKey: string;
  reason?: string | null;
};

export type RefundAccountPaymentResult = {
  providerRef: string;
  providerStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
  raw: unknown;
};

export type VerifiedAccountPaymentWebhook = {
  provider: AccountPaymentProviderCode;
  providerRef: string | null;
  orderId?: string | null;
  providerStatus: string | null;
  normalizedStatus: NormalizedPaymentStatus | null;
  raw: unknown;
};

export type AccountPaymentProviderAdapter = {
  code: AccountPaymentProviderCode;
  createPayment(input: CreateAccountPaymentInput): Promise<CreateAccountPaymentResult>;
  getPaymentStatus(input: GetAccountPaymentStatusInput): Promise<AccountPaymentStatusResult>;
  refundPayment(input: RefundAccountPaymentInput): Promise<RefundAccountPaymentResult>;
  verifyWebhook(input: {
    connection: AccountPaymentConnectionSnapshot;
    credentials: AccountPaymentCredentials;
    body: unknown;
    headers: Headers;
  }): Promise<VerifiedAccountPaymentWebhook>;
};

const dbProviderByCode: Record<AccountPaymentProviderCode, AccountPaymentProvider> = {
  yookassa: "YOOKASSA",
  tbank: "TBANK",
  sber: "SBER",
  alfa: "ALFA",
};

const providerCodeByDb: Record<AccountPaymentProvider, AccountPaymentProviderCode> = {
  YOOKASSA: "yookassa",
  TBANK: "tbank",
  SBER: "sber",
  ALFA: "alfa",
};

export function providerToDb(code: AccountPaymentProviderCode): AccountPaymentProvider {
  return dbProviderByCode[code];
}

export function providerFromDb(provider: AccountPaymentProvider): AccountPaymentProviderCode {
  return providerCodeByDb[provider];
}

export function normalizeProviderCode(value: string): AccountPaymentProviderCode {
  const code = value.trim().toLowerCase();
  if (code === "yookassa" || code === "tbank" || code === "sber" || code === "alfa") {
    return code;
  }
  throw new Error(`Unsupported account payment provider: ${value}`);
}
