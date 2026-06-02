import { rubToKopecks } from "@/lib/payments/money";
import {
  normalizePhoneForReceipt,
  sanitizeReceiptItemName,
  yookassaTaxation,
  yookassaVat,
} from "../receipts";
import { normalizeYooKassaStatus } from "../status";
import type {
  AccountPaymentProviderAdapter,
  AccountReceiptItemInput,
  CreateAccountPaymentInput,
  RefundAccountPaymentInput,
  YooKassaCredentials,
} from "../types";

type YooKassaPaymentResponse = {
  id: string;
  status: string;
  paid?: boolean;
  created_at?: string;
  captured_at?: string;
  confirmation?: {
    confirmation_url?: string;
  };
};

type YooKassaRefundResponse = {
  id: string;
  status: string;
  created_at?: string;
};

const YOOKASSA_API_URL = "https://api.yookassa.ru/v3";

function assertCredentials(credentials: CreateAccountPaymentInput["credentials"]): YooKassaCredentials {
  if (credentials.provider !== "yookassa") {
    throw new Error("Invalid credentials for YooKassa provider");
  }
  return credentials;
}

function authHeader(credentials: YooKassaCredentials) {
  return `Basic ${Buffer.from(`${credentials.shopId}:${credentials.secretKey}`).toString("base64")}`;
}

function amount(value: number, currency = "RUB") {
  return { value: value.toFixed(2), currency };
}

function buildReceipt(input: CreateAccountPaymentInput, items: AccountReceiptItemInput[]) {
  if (!input.connection.receiptEnabled || !items.length) return undefined;

  const customer: Record<string, string> = {};
  const email = input.customer?.email?.trim();
  const phone = normalizePhoneForReceipt(input.customer?.phone);
  if (email) customer.email = email;
  if (phone) customer.phone = phone;
  if (!customer.email && !customer.phone) return undefined;

  const taxSystemCode = yookassaTaxation(input.connection.receiptTaxationSystem);
  return {
    customer,
    ...(taxSystemCode ? { tax_system_code: taxSystemCode } : {}),
    items: items.map((item) => ({
      description: sanitizeReceiptItemName(item.name),
      quantity: String(item.quantity),
      amount: amount(item.amountRub, input.intent.currency),
      vat_code: yookassaVat(item.vat),
      payment_subject: item.paymentSubject || input.connection.paymentSubject || "service",
      payment_mode: item.paymentMethod || input.connection.paymentMethod || "full_payment",
    })),
  };
}

async function yookassaRequest<T>(
  credentials: YooKassaCredentials,
  path: string,
  payload: Record<string, unknown> | null,
  idempotencyKey?: string,
): Promise<T> {
  const response = await fetch(`${YOOKASSA_API_URL}${path}`, {
    method: payload ? "POST" : "GET",
    headers: {
      Authorization: authHeader(credentials),
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotence-Key": idempotencyKey } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as T | { description?: string } | null;
  if (!response.ok || !json) {
    const message =
      json && typeof json === "object" && "description" in json ? String(json.description || "") : null;
    throw new Error(message || `YooKassa ${path} request failed`);
  }
  return json as T;
}

export const yookassaAccountPaymentProvider: AccountPaymentProviderAdapter = {
  code: "yookassa",

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
      amount: amount(input.intent.amountRub, input.intent.currency),
      capture: true,
      description: input.intent.description.slice(0, 128),
      confirmation: {
        type: "redirect",
        return_url: input.intent.returnUrl,
      },
      metadata: {
        accountId: String(input.intent.accountId),
        paymentIntentId: String(input.intent.id),
        scenario: input.intent.scenario,
      },
      ...(buildReceipt(input, receiptItems) ? { receipt: buildReceipt(input, receiptItems) } : {}),
    };

    const payment = await yookassaRequest<YooKassaPaymentResponse>(
      credentials,
      "/payments",
      payload,
      input.intent.idempotencyKey,
    );
    const paymentUrl = payment.confirmation?.confirmation_url;
    if (!paymentUrl) throw new Error("YooKassa payment confirmation URL is missing");

    return {
      provider: "yookassa",
      providerRef: payment.id,
      providerStatus: payment.status,
      normalizedStatus: normalizeYooKassaStatus(payment.status, payment.paid),
      paymentUrl,
      raw: payment,
    };
  },

  async getPaymentStatus(input) {
    const credentials = assertCredentials(input.credentials);
    const payment = await yookassaRequest<YooKassaPaymentResponse>(
      credentials,
      `/payments/${encodeURIComponent(input.providerRef)}`,
      null,
    );
    return {
      providerStatus: payment.status,
      normalizedStatus: normalizeYooKassaStatus(payment.status, payment.paid),
      paidAt: payment.captured_at ? new Date(payment.captured_at) : null,
      raw: payment,
    };
  },

  async refundPayment(input: RefundAccountPaymentInput) {
    if (input.credentials.provider !== "yookassa") {
      throw new Error("Invalid credentials for YooKassa provider");
    }
    const refund = await yookassaRequest<YooKassaRefundResponse>(
      input.credentials,
      "/refunds",
      {
        payment_id: input.providerRef,
        amount: amount(input.amountRub, input.connection.currency),
        description: input.reason || undefined,
      },
      input.idempotencyKey,
    );
    return {
      providerRef: refund.id,
      providerStatus: refund.status,
      normalizedStatus: normalizeYooKassaStatus(refund.status),
      raw: refund,
    };
  },

  async verifyWebhook(input) {
    const body = input.body as {
      event?: string;
      object?: { id?: string; status?: string; paid?: boolean; metadata?: Record<string, unknown> };
    };
    const providerRef = body.object?.id ?? null;
    const providerStatus = body.object?.status ?? body.event ?? null;
    return {
      provider: "yookassa",
      providerRef,
      orderId: typeof body.object?.metadata?.paymentIntentId === "string" ? body.object.metadata.paymentIntentId : null,
      providerStatus,
      normalizedStatus: providerStatus ? normalizeYooKassaStatus(providerStatus, body.object?.paid) : null,
      raw: body,
    };
  },
};
