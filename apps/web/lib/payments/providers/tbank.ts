import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getPaymentConfig, assertTbankConfigured } from "../config";
import { rubToKopecks } from "../money";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentMethodCode,
  PaymentProvider,
  ReceiptItemInput,
  WebhookVerifyInput,
  WebhookVerifyResult,
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

export type TbankPaymentStateResponse = {
  Success?: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  TerminalKey?: string;
  PaymentId?: string;
  OrderId?: string;
  Status?: string;
  Amount?: number;
  CardId?: string;
  Pan?: string;
  ExpDate?: string;
};

function isPlainTokenValue(value: unknown) {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

export function buildTbankToken(payload: Record<string, unknown>, password: string) {
  const values = Object.entries({ ...payload, Password: password })
    .filter(([key, value]) => key !== "Token" && isPlainTokenValue(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => (value == null ? "" : String(value)))
    .join("");

  return crypto.createHash("sha256").update(values).digest("hex");
}

function normalizePhone(phone: string | null | undefined) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;
  return digits.startsWith("7") ? `+${digits}` : `+7${digits.slice(-10)}`;
}

function orderId(invoiceId: number) {
  const attempt = Date.now().toString(36);
  return `platform_invoice_${invoiceId}_${attempt}`.slice(0, 36);
}

export function parseInvoiceIdFromTbankOrderId(value: string | null | undefined) {
  const match = String(value ?? "").match(/^platform_invoice_(\d+)(?:_|$)/);
  return match ? Number(match[1]) : null;
}

function buildReceipt(input: {
  email?: string | null;
  phone?: string | null;
  taxation: string;
  items: ReceiptItemInput[];
}) {
  const email = input.email?.trim() || undefined;
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return undefined;

  return {
    ...(email ? { Email: email } : {}),
    ...(phone ? { Phone: phone } : {}),
    Taxation: input.taxation,
    Items: input.items.map((item) => {
      const amount = rubToKopecks(item.amountRub);
      return {
        Name: item.name.slice(0, 128),
        Price: rubToKopecks(item.unitPriceRub),
        Quantity: item.quantity,
        Amount: amount,
        Tax: item.vat,
        PaymentMethod: item.paymentMethod,
        PaymentObject: item.paymentObject,
      };
    }),
  };
}

async function tbankRequest<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const config = getPaymentConfig();
  assertTbankConfigured(config);
  const response = await fetch(`${config.tbank.apiUrl.replace(/\/$/, "")}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !json) {
    throw new Error(`T-Bank ${path} request failed`);
  }
  return json;
}

export async function getTbankPaymentState(paymentId: string): Promise<TbankPaymentStateResponse> {
  const config = getPaymentConfig();
  assertTbankConfigured(config);

  const payload: Record<string, unknown> = {
    TerminalKey: config.tbank.terminalKey,
    PaymentId: paymentId,
  };
  payload.Token = buildTbankToken(payload, config.tbank.password);

  const state = await tbankRequest<TbankPaymentStateResponse>("GetState", payload);
  if (!state.Success) {
    throw new Error(state.Message || state.Details || "T-Bank payment state request failed");
  }
  return state;
}

async function loadInvoiceForPayment(invoiceId: number) {
  const invoice = await prisma.platformInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          users: {
            take: 1,
            include: { user: { select: { email: true } } },
          },
        },
      },
      items: true,
    },
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
  return invoice;
}

function receiptItemsFromInvoice(invoice: Awaited<ReturnType<typeof loadInvoiceForPayment>>, vat: string): ReceiptItemInput[] {
  if (invoice.items.length) {
    return invoice.items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unitPriceRub: Number(item.unitPrice),
      amountRub: Number(item.amount),
      vat: item.vat,
      paymentObject: item.paymentObject,
      paymentMethod: item.paymentMethod,
    }));
  }

  return [
    {
      name: invoice.description || `Счет платформы #${invoice.id}`,
      quantity: 1,
      unitPriceRub: Number(invoice.amount),
      amountRub: Number(invoice.amount),
      vat,
      paymentObject: "service",
      paymentMethod: "full_payment",
    },
  ];
}

async function createTbankPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const config = getPaymentConfig();
  assertTbankConfigured(config);

  const invoice = await loadInvoiceForPayment(input.invoiceId);
  if (invoice.status === "PAID") {
    throw new Error("Invoice is already paid");
  }

  const successUrl = input.returnUrl || `${config.appPublicUrl}/crm/billing/success?invoiceId=${invoice.id}`;
  const failUrl = input.failUrl || `${config.appPublicUrl}/crm/billing/fail?invoiceId=${invoice.id}`;
  const notificationUrl = `${config.appPublicUrl}/api/v1/platform/payments/tbank/webhook`;
  const fallbackEmail = invoice.account.users[0]?.user.email ?? null;
  const receiptItems = receiptItemsFromInvoice(invoice, config.tbank.vat);

  const payload: Record<string, unknown> = {
    TerminalKey: config.tbank.terminalKey,
    Amount: rubToKopecks(invoice.amount),
    OrderId: orderId(invoice.id),
    Description: (invoice.description || `Счет платформы #${invoice.id}`).slice(0, 250),
    CustomerKey: `account_${invoice.accountId}`,
    SuccessURL: successUrl,
    FailURL: failUrl,
    NotificationURL: notificationUrl,
    DATA: {
      invoiceId: String(invoice.id),
      accountId: String(invoice.accountId),
      paymentMethod: input.method,
    },
  };

  if (config.tbank.receiptEnabled) {
    const receipt = buildReceipt({
      email: input.customerEmail ?? fallbackEmail,
      phone: input.customerPhone,
      taxation: config.tbank.taxation,
      items: receiptItems,
    });
    if (receipt) payload.Receipt = receipt;
  }

  payload.Token = buildTbankToken(payload, config.tbank.password);

  const init = await tbankRequest<TbankInitResponse>("Init", payload);
  if (!init.Success || !init.PaymentId) {
    throw new Error(init.Message || init.Details || "T-Bank payment init failed");
  }

  let qrPayload: string | undefined;
  let qrUrl: string | undefined;
  if (input.method === "sbp" && config.tbank.sbpEnabled) {
    const imageQrRequest: Record<string, unknown> = {
      TerminalKey: config.tbank.terminalKey,
      PaymentId: init.PaymentId,
      DataType: "IMAGE",
    };
    imageQrRequest.Token = buildTbankToken(imageQrRequest, config.tbank.password);
    const imageQr = await tbankRequest<TbankQrResponse>("GetQr", imageQrRequest);
    if (imageQr.Success) {
      qrUrl = imageQr.Data || imageQr.QR || imageQr.Payload;
    }

    const payloadQrRequest: Record<string, unknown> = {
      TerminalKey: config.tbank.terminalKey,
      PaymentId: init.PaymentId,
      DataType: "PAYLOAD",
    };
    payloadQrRequest.Token = buildTbankToken(payloadQrRequest, config.tbank.password);
    const payloadQr = await tbankRequest<TbankQrResponse>("GetQr", payloadQrRequest);
    if (payloadQr.Success) {
      qrPayload = payloadQr.Data || payloadQr.Payload || payloadQr.QR;
    }
  }

  await prisma.platformInvoice.update({
    where: { id: invoice.id },
    data: {
      paymentProvider: "tbank",
      paymentMethod: input.method,
      providerPaymentId: init.PaymentId,
      providerStatus: init.Status ?? "NEW",
      paymentUrl: init.PaymentURL ?? null,
    },
  });

  const existingPayment = await prisma.platformPayment.findFirst({
    where: { provider: "tbank", providerRef: init.PaymentId },
    select: { id: true },
  });

  if (existingPayment) {
    await prisma.platformPayment.update({
      where: { id: existingPayment.id },
      data: {
        invoiceId: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        method: input.method,
        providerStatus: init.Status ?? "NEW",
        rawProviderJson: init,
      },
    });
  } else {
    await prisma.platformPayment.create({
      data: {
        invoiceId: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        status: "PENDING",
        provider: "tbank",
        providerRef: init.PaymentId,
        method: input.method,
        providerStatus: init.Status ?? "NEW",
        rawProviderJson: init,
      },
    });
  }

  return {
    provider: "tbank",
    method: input.method,
    providerPaymentId: init.PaymentId,
    paymentUrl: init.PaymentURL,
    qrPayload,
    qrUrl,
    raw: { init, qrPayload, qrUrl },
  };
}

async function verifyTbankWebhook(input: WebhookVerifyInput): Promise<WebhookVerifyResult> {
  const config = getPaymentConfig();
  const token = typeof input.payload.Token === "string" ? input.payload.Token : "";
  const expected = buildTbankToken(input.payload, config.tbank.password);
  return {
    valid: Boolean(token) && token === expected,
    providerPaymentId: input.payload.PaymentId == null ? null : String(input.payload.PaymentId),
    orderId: input.payload.OrderId == null ? null : String(input.payload.OrderId),
    status: input.payload.Status == null ? null : String(input.payload.Status),
    raw: input.payload,
  };
}

export const tbankPaymentProvider: PaymentProvider = {
  code: "tbank",
  createPayment: createTbankPayment,
  verifyWebhook: verifyTbankWebhook,
};

export function isTbankFinalSuccessStatus(status: string | null | undefined) {
  return status === "CONFIRMED";
}

export function paymentMethodFromTbankPayload(payload: Record<string, unknown>): PaymentMethodCode | null {
  const data = payload.DATA;
  if (data && typeof data === "object" && "paymentMethod" in data) {
    const method = String((data as Record<string, unknown>).paymentMethod);
    if (method === "card" || method === "sbp" || method === "tpay" || method === "bank_transfer") return method;
  }
  return null;
}
