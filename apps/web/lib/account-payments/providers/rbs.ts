import { rubToKopecks } from "@/lib/payments/money";
import { normalizeRbsStatus } from "../status";
import type {
  AccountPaymentProviderAdapter,
  AccountPaymentProviderCode,
  AccountPaymentConnectionSnapshot,
  AlfaCredentials,
  CreateAccountPaymentInput,
  RefundAccountPaymentInput,
  SberCredentials,
} from "../types";

type RbsCredentials = SberCredentials | AlfaCredentials;

type RbsProviderOptions = {
  code: Extract<AccountPaymentProviderCode, "sber" | "alfa">;
  displayName: string;
  defaultTestUrl: string;
  defaultLiveUrl: string;
};

type RbsRegisterResponse = {
  orderId?: string;
  formUrl?: string;
  errorCode?: string | number;
  errorMessage?: string;
  error?: string;
};

type RbsStatusResponse = {
  orderNumber?: string;
  orderStatus?: number | string;
  actionCode?: number | string;
  actionCodeDescription?: string;
  errorCode?: string | number;
  errorMessage?: string;
  error?: string;
  depositedDate?: number;
  date?: number;
};

type RbsRefundResponse = {
  errorCode?: string | number;
  errorMessage?: string;
  error?: string;
  orderStatus?: number | string;
};

function assertCredentials(
  credentials: CreateAccountPaymentInput["credentials"],
  code: "sber" | "alfa",
): RbsCredentials {
  if (credentials.provider !== code) {
    throw new Error(`Invalid credentials for ${code} provider`);
  }
  return credentials;
}

function apiUrl(credentials: RbsCredentials, connection: AccountPaymentConnectionSnapshot, options: RbsProviderOptions) {
  const configured = credentials.apiUrl?.trim();
  const base = configured || (connection.mode === "LIVE" ? options.defaultLiveUrl : options.defaultTestUrl);
  return base.replace(/\/$/, "");
}

function buildOrderNumber(intentId: number) {
  return `account_intent_${intentId}_${Date.now().toString(36)}`.slice(0, 36);
}

function responseError(json: { errorCode?: string | number; errorMessage?: string; error?: string }, fallback: string) {
  const errorCode = json.errorCode == null ? "" : String(json.errorCode);
  if (errorCode && errorCode !== "0") {
    return json.errorMessage || json.error || `${fallback}: ${errorCode}`;
  }
  return null;
}

async function rbsRequest<T>(
  baseUrl: string,
  method: string,
  params: Record<string, string | number | undefined>,
  displayName: string,
): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") body.set(key, String(value));
  }

  const response = await fetch(`${baseUrl}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !json) {
    throw new Error(`${displayName} ${method} request failed`);
  }

  const error = responseError(json as { errorCode?: string | number; errorMessage?: string; error?: string }, `${displayName} ${method} failed`);
  if (error) throw new Error(error);
  return json;
}

function paidAtFromStatus(payment: RbsStatusResponse) {
  const value = payment.depositedDate ?? payment.date;
  return typeof value === "number" && value > 0 ? new Date(value) : null;
}

function webhookStatus(body: Record<string, unknown>) {
  const value = body.orderStatus ?? body.status ?? body.operation;
  return value == null ? null : String(value);
}

function webhookProviderRef(body: Record<string, unknown>) {
  const value = body.mdOrder ?? body.orderId ?? body.orderID;
  return typeof value === "string" && value ? value : null;
}

function webhookOrderNumber(body: Record<string, unknown>) {
  const value = body.orderNumber ?? body.OrderNumber;
  return typeof value === "string" && value ? value : null;
}

export function createRbsAccountPaymentProvider(options: RbsProviderOptions): AccountPaymentProviderAdapter {
  return {
    code: options.code,

    async createPayment(input) {
      const credentials = assertCredentials(input.credentials, options.code);
      const baseUrl = apiUrl(credentials, input.connection, options);
      const orderNumber = buildOrderNumber(input.intent.id);
      const payment = await rbsRequest<RbsRegisterResponse>(
        baseUrl,
        "register.do",
        {
          userName: credentials.apiLogin,
          password: credentials.apiPassword,
          orderNumber,
          amount: rubToKopecks(input.intent.amountRub),
          currency: "643",
          returnUrl: input.intent.returnUrl,
          failUrl: input.intent.failUrl,
          description: input.intent.description.slice(0, 512),
          language: "ru",
          dynamicCallbackUrl: input.webhookUrl,
          jsonParams: JSON.stringify({
            accountId: String(input.intent.accountId),
            paymentIntentId: String(input.intent.id),
            scenario: input.intent.scenario,
          }),
        },
        options.displayName,
      );

      if (!payment.orderId || !payment.formUrl) {
        throw new Error(payment.errorMessage || `${options.displayName} payment URL is missing`);
      }

      return {
        provider: options.code,
        providerRef: payment.orderId,
        providerStatus: "REGISTERED",
        normalizedStatus: "requires_action",
        paymentUrl: payment.formUrl,
        raw: { ...payment, orderNumber, method: input.method },
      };
    },

    async getPaymentStatus(input) {
      const credentials = assertCredentials(input.credentials, options.code);
      const baseUrl = apiUrl(credentials, input.connection, options);
      const payment = await rbsRequest<RbsStatusResponse>(
        baseUrl,
        "getOrderStatusExtended.do",
        {
          userName: credentials.apiLogin,
          password: credentials.apiPassword,
          orderId: input.providerRef,
        },
        options.displayName,
      );
      const providerStatus = payment.orderStatus == null ? "UNKNOWN" : String(payment.orderStatus);
      const normalizedStatus = normalizeRbsStatus(payment.orderStatus);
      return {
        providerStatus,
        normalizedStatus,
        paidAt: normalizedStatus === "succeeded" ? paidAtFromStatus(payment) : null,
        raw: payment,
      };
    },

    async refundPayment(input: RefundAccountPaymentInput) {
      const credentials = assertCredentials(input.credentials, options.code);
      const baseUrl = apiUrl(credentials, input.connection, options);
      const refund = await rbsRequest<RbsRefundResponse>(
        baseUrl,
        "refund.do",
        {
          userName: credentials.apiLogin,
          password: credentials.apiPassword,
          orderId: input.providerRef,
          amount: rubToKopecks(input.amountRub),
        },
        options.displayName,
      );
      const providerStatus = refund.orderStatus == null ? "REFUND_REQUESTED" : String(refund.orderStatus);
      return {
        providerRef: input.providerRef,
        providerStatus,
        normalizedStatus: refund.orderStatus == null ? "refunded" : normalizeRbsStatus(refund.orderStatus),
        raw: refund,
      };
    },

    async verifyWebhook(input) {
      assertCredentials(input.credentials, options.code);
      const body = input.body && typeof input.body === "object" ? (input.body as Record<string, unknown>) : {};
      const providerStatus = webhookStatus(body);
      return {
        provider: options.code,
        providerRef: webhookProviderRef(body),
        orderId: webhookOrderNumber(body),
        providerStatus,
        normalizedStatus: providerStatus ? normalizeRbsStatus(providerStatus) : null,
        raw: body,
      };
    },
  };
}
