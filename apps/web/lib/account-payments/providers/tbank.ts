import crypto from "crypto";
import { rubToKopecks } from "@/lib/payments/money";
import { normalizePhoneForReceipt, sanitizeReceiptItemName, tbankTaxation, tbankVat } from "../receipts";
import { normalizeTbankStatus } from "../status";
import type {
  AccountPaymentProviderAdapter,
  AccountReceiptItemInput,
  CreateAccountPaymentInput,
  TbankCredentials,
} from "../types";

type TbankInitResponse = {
  Success?: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  PaymentId?: string;
  PaymentURL?: string;
  OrderId?: string;
  Status?: string;
};

type TbankQrResponse = {
  Success?: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  Data?: string;
  Payload?: string;
  QR?: string;
};

type TbankStateResponse = {
  Success?: boolean;
  Message?: string;
  Details?: string;
  PaymentId?: string;
  OrderId?: string;
  Status?: string;
  Amount?: number;
};

type TbankRefundResponse = {
  Success?: boolean;
  Message?: string;
  Details?: string;
  PaymentId?: string;
  Status?: string;
};

const DEFAULT_TBANK_API_URL = "https://securepay.tinkoff.ru/v2";

function isPlainTokenValue(value: unknown) {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

export function buildAccountTbankToken(payload: Record<string, unknown>, password: string) {
  const values = Object.entries({ ...payload, Password: password })
    .filter(([key, value]) => key !== "Token" && isPlainTokenValue(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => (value == null ? "" : String(value)))
    .join("");

  return crypto.createHash("sha256").update(values).digest("hex");
}

function assertCredentials(credentials: CreateAccountPaymentInput["credentials"]): TbankCredentials {
  if (credentials.provider !== "tbank") {
    throw new Error("Invalid credentials for T-Bank provider");
  }
  return credentials;
}

function apiUrl(credentials: TbankCredentials) {
  return (credentials.apiUrl || DEFAULT_TBANK_API_URL).replace(/\/$/, "");
}

function accountOrderId(intentId: number) {
  return `account_intent_${intentId}_${Date.now().toString(36)}`.slice(0, 36);
}

function buildReceipt(input: CreateAccountPaymentInput, items: AccountReceiptItemInput[]) {
  if (!input.connection.receiptEnabled || !items.length) return undefined;

  const email = input.customer?.email?.trim();
  const phone = normalizePhoneForReceipt(input.customer?.phone);
  if (!email && !phone) return undefined;
  const totalKopecks = rubToKopecks(input.intent.amountRub);

  return {
    ...(email ? { Email: email } : {}),
    ...(phone ? { Phone: phone } : {}),
    Taxation: tbankTaxation(input.connection.receiptTaxationSystem),
    ...(input.connection.receiptFfdVersion ? { FfdVersion: input.connection.receiptFfdVersion } : {}),
    Payments: {
      Electronic: totalKopecks,
    },
    Items: items.map((item) => ({
      Name: sanitizeReceiptItemName(item.name),
      Price: rubToKopecks(item.unitPriceRub),
      Quantity: item.quantity,
      Amount: rubToKopecks(item.amountRub),
      Tax: tbankVat(item.vat),
      PaymentMethod: item.paymentMethod || input.connection.paymentMethod || "full_payment",
      PaymentObject: item.paymentSubject || input.connection.paymentSubject || "service",
    })),
  };
}

async function tbankRequest<T>(credentials: TbankCredentials, path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiUrl(credentials)}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !json) throw new Error(`T-Bank ${path} request failed`);
  return json;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTbankQr(input: {
  credentials: TbankCredentials;
  paymentId: string;
  dataType: "IMAGE" | "PAYLOAD";
}) {
  const payload: Record<string, unknown> = {
    TerminalKey: input.credentials.terminalKey,
    PaymentId: input.paymentId,
    DataType: input.dataType,
  };
  payload.Token = buildAccountTbankToken(payload, input.credentials.password);
  return tbankRequest<TbankQrResponse>(input.credentials, "GetQr", payload);
}

export const tbankAccountPaymentProvider: AccountPaymentProviderAdapter = {
  code: "tbank",

  async createPayment(input) {
    const credentials = assertCredentials(input.credentials);
    const receiptItems = input.receiptItems ?? [
      {
        name: input.intent.description,
        quantity: 1,
        unitPriceRub: input.intent.amountRub,
        amountRub: input.intent.amountRub,
        vat: input.connection.receiptVat,
      },
    ];

    const payload: Record<string, unknown> = {
      TerminalKey: credentials.terminalKey,
      Amount: rubToKopecks(input.intent.amountRub),
      OrderId: accountOrderId(input.intent.id),
      Description: input.intent.description.slice(0, 250),
      CustomerKey: `account_${input.intent.accountId}`,
      SuccessURL: input.intent.returnUrl,
      FailURL: input.intent.failUrl,
      NotificationURL: input.webhookUrl,
      DATA: {
        accountId: String(input.intent.accountId),
        paymentIntentId: String(input.intent.id),
        scenario: input.intent.scenario,
        connection_type_pf: "true",
      },
    };

    const receipt = buildReceipt(input, receiptItems);
    if (receipt) payload.Receipt = receipt;
    payload.Token = buildAccountTbankToken(payload, credentials.password);

    const init = await tbankRequest<TbankInitResponse>(credentials, "Init", payload);
    if (!init.Success || !init.PaymentId || !init.PaymentURL) {
      throw new Error(init.Message || init.Details || "T-Bank payment init failed");
    }

    let sbpQrSvg: string | null = null;
    let sbpPayload: string | null = null;
    let sbpQrError: string | null = null;
    try {
      const imageQr = await getTbankQr({ credentials, paymentId: init.PaymentId, dataType: "IMAGE" });
      if (imageQr.Success) {
        sbpQrSvg = imageQr.Data || imageQr.QR || imageQr.Payload || null;
      } else {
        sbpQrError = imageQr.Message || imageQr.Details || "T-Bank SBP QR request failed";
      }
    } catch (error) {
      sbpQrError = error instanceof Error ? error.message : "T-Bank SBP QR request failed";
    }
    try {
      const payloadQr = await getTbankQr({ credentials, paymentId: init.PaymentId, dataType: "PAYLOAD" });
      if (payloadQr.Success) {
        sbpPayload = payloadQr.Data || payloadQr.Payload || payloadQr.QR || null;
      }
    } catch {}

    return {
      provider: "tbank",
      providerRef: init.PaymentId,
      providerStatus: init.Status || "NEW",
      normalizedStatus: normalizeTbankStatus(init.Status || "NEW"),
      paymentUrl: init.PaymentURL,
      paymentMethods: {
        cardUrl: init.PaymentURL,
        sbpQrSvg,
        sbpPayload,
      },
      raw: {
        init,
        method: input.method,
        paymentMethods: {
          cardUrl: init.PaymentURL,
          sbpQrSvg,
          sbpPayload,
          sbpQrError,
        },
      },
    };
  },

  async getPaymentStatus(input) {
    if (input.credentials.provider !== "tbank") {
      throw new Error("Invalid credentials for T-Bank provider");
    }
    const payload: Record<string, unknown> = {
      TerminalKey: input.credentials.terminalKey,
      PaymentId: input.providerRef,
    };
    payload.Token = buildAccountTbankToken(payload, input.credentials.password);
    const state = await tbankRequest<TbankStateResponse>(input.credentials, "GetState", payload);
    if (!state.Success) {
      throw new Error(state.Message || state.Details || "T-Bank payment state request failed");
    }
    return {
      providerStatus: state.Status || "UNKNOWN",
      normalizedStatus: normalizeTbankStatus(state.Status),
      paidAt: normalizeTbankStatus(state.Status) === "succeeded" ? new Date() : null,
      raw: state,
    };
  },

  async refundPayment(input) {
    if (input.credentials.provider !== "tbank") {
      throw new Error("Invalid credentials for T-Bank provider");
    }
    const payload: Record<string, unknown> = {
      TerminalKey: input.credentials.terminalKey,
      PaymentId: input.providerRef,
      Amount: rubToKopecks(input.amountRub),
    };
    payload.Token = buildAccountTbankToken(payload, input.credentials.password);
    const refund = await tbankRequest<TbankRefundResponse>(input.credentials, "Cancel", payload);
    if (!refund.Success) {
      const refundStatus = normalizeTbankStatus(refund.Status);
      if (refundStatus === "refunded" || refundStatus === "partially_refunded") {
        return {
          providerRef: refund.PaymentId || input.providerRef,
          providerStatus: refund.Status || "REFUNDED",
          normalizedStatus: refundStatus,
          raw: { refund, reconciledFromCancelResponse: true },
        };
      }
      const statePayload: Record<string, unknown> = {
        TerminalKey: input.credentials.terminalKey,
        PaymentId: input.providerRef,
      };
      statePayload.Token = buildAccountTbankToken(statePayload, input.credentials.password);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) await wait(700);
        const state = await tbankRequest<TbankStateResponse>(input.credentials, "GetState", statePayload);
        const stateStatus = normalizeTbankStatus(state.Status);
        if (state.Success && (stateStatus === "refunded" || stateStatus === "partially_refunded")) {
          return {
            providerRef: state.PaymentId || input.providerRef,
            providerStatus: state.Status || "REFUNDED",
            normalizedStatus: stateStatus,
            raw: { refund, state, reconciledAfterCancelError: true },
          };
        }
      }
      throw new Error(refund.Message || refund.Details || "T-Bank refund request failed");
    }
    return {
      providerRef: refund.PaymentId || input.providerRef,
      providerStatus: refund.Status || "REFUNDED",
      normalizedStatus: normalizeTbankStatus(refund.Status || "REFUNDED"),
      raw: refund,
    };
  },

  async verifyWebhook(input) {
    if (input.credentials.provider !== "tbank") {
      throw new Error("Invalid credentials for T-Bank provider");
    }
    const body = input.body as Record<string, unknown>;
    const token = typeof body.Token === "string" ? body.Token : "";
    const expected = buildAccountTbankToken(body, input.credentials.password);
    if (!token || token !== expected) {
      throw new Error("Invalid T-Bank webhook token");
    }

    const providerStatus = typeof body.Status === "string" ? body.Status : null;
    return {
      provider: "tbank",
      providerRef: typeof body.PaymentId === "string" ? body.PaymentId : null,
      orderId: typeof body.OrderId === "string" ? body.OrderId : null,
      providerStatus,
      normalizedStatus: providerStatus ? normalizeTbankStatus(providerStatus) : null,
      raw: body,
    };
  },
};
