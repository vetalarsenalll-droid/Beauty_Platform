import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccountPaymentProvider } from "./provider";
import { paymentIntentStatusFromNormalized } from "./status";
import type {
  AccountPaymentCustomerInput,
  AccountPaymentMethodCode,
  AccountReceiptItemInput,
  NormalizedPaymentStatus,
} from "./types";
import { getDefaultAccountPaymentConnection, toConnectionSnapshot } from "./connections";
import { decryptAccountPaymentCredentials } from "./credentials";

export type CreateAccountCheckoutInput = {
  accountId: number;
  amountRub: number;
  description: string;
  scenario: string;
  method?: AccountPaymentMethodCode;
  appointmentId?: number | null;
  clientId?: number | null;
  customer?: AccountPaymentCustomerInput;
  receiptItems?: AccountReceiptItemInput[];
  returnUrl?: string;
  failUrl?: string;
  idempotencyKey?: string;
};

function publicOrigin() {
  return (
    process.env.ACCOUNT_PAYMENTS_PUBLIC_ORIGIN ||
    process.env.APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function accountPaymentWebhookUrl(provider: string) {
  return `${publicOrigin()}/api/v1/account-payments/${provider}/webhook`;
}

function defaultReturnUrl(intentId: number) {
  return `${publicOrigin()}/payment/success?intentId=${intentId}`;
}

function defaultFailUrl(intentId: number) {
  return `${publicOrigin()}/payment/fail?intentId=${intentId}`;
}

export async function createAccountCheckout(input: CreateAccountCheckoutInput) {
  const loaded = await getDefaultAccountPaymentConnection(input.accountId);
  if (!loaded) throw new Error("Account payment connection is not configured");

  const method = input.method ?? "card";
  const intent = await prisma.paymentIntent.create({
    data: {
      accountId: input.accountId,
      connectionId: loaded.connection.id,
      appointmentId: input.appointmentId ?? null,
      clientId: input.clientId ?? null,
      amount: new Prisma.Decimal(input.amountRub),
      currency: loaded.connection.currency,
      scenario: input.scenario,
      status: "CREATED",
      provider: loaded.snapshot.provider,
      idempotencyKey: input.idempotencyKey ?? `account_checkout_${input.accountId}_${Date.now()}`,
      returnUrl: input.returnUrl ?? null,
      failUrl: input.failUrl ?? null,
      receiptRequested: Boolean(input.receiptItems?.length && loaded.connection.receiptEnabled),
      receiptPayload: input.receiptItems ? { items: input.receiptItems } : undefined,
    },
  });

  const provider = getAccountPaymentProvider(loaded.snapshot.provider);
  const returnUrl = input.returnUrl ?? defaultReturnUrl(intent.id);
  const failUrl = input.failUrl ?? defaultFailUrl(intent.id);
  const result = await provider.createPayment({
    connection: loaded.snapshot,
    credentials: loaded.credentials,
    intent: {
      id: intent.id,
      accountId: input.accountId,
      amountRub: input.amountRub,
      currency: loaded.connection.currency,
      description: input.description,
      scenario: input.scenario,
      returnUrl,
      failUrl,
      idempotencyKey: intent.idempotencyKey || `account_checkout_${intent.id}`,
    },
    method,
    customer: input.customer,
    receiptItems: input.receiptItems,
    webhookUrl: accountPaymentWebhookUrl(loaded.snapshot.provider),
  });

  return prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: paymentIntentStatusFromNormalized(result.normalizedStatus),
      providerRef: result.providerRef,
      providerStatus: result.providerStatus,
      providerPayload: result.raw as Prisma.InputJsonValue,
      paymentUrl: result.paymentUrl,
      returnUrl,
      failUrl,
    },
  });
}

export async function refreshAccountPaymentIntent(intentId: number) {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: intentId },
    include: { connection: true },
  });
  if (!intent?.connection || !intent.providerRef) {
    throw new Error("Payment intent is not linked to provider payment");
  }

  const snapshot = toConnectionSnapshot(intent.connection);
  const credentials = decryptAccountPaymentCredentials(intent.connection.credentialsEncrypted);
  const provider = getAccountPaymentProvider(snapshot.provider);
  const state = await provider.getPaymentStatus({
    connection: snapshot,
    credentials,
    providerRef: intent.providerRef,
  });

  return applyAccountPaymentState({
    intentId: intent.id,
    providerStatus: state.providerStatus,
    normalizedStatus: state.normalizedStatus,
    paidAt: state.paidAt ?? null,
    raw: state.raw,
  });
}

export async function applyAccountPaymentState(input: {
  intentId: number;
  providerStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
  paidAt?: Date | null;
  raw?: unknown;
}) {
  const status = paymentIntentStatusFromNormalized(input.normalizedStatus);
  return prisma.$transaction(async (tx) => {
    const intent = await tx.paymentIntent.update({
      where: { id: input.intentId },
      data: {
        status,
        providerStatus: input.providerStatus,
        providerPayload: jsonOrNull(input.raw),
        paidAt: status === "SUCCEEDED" ? input.paidAt ?? new Date() : undefined,
      },
    });

    if (status !== "SUCCEEDED") return intent;

    const existingCharge = await tx.transaction.findFirst({
      where: { intentId: intent.id, type: "CHARGE" },
      orderBy: { id: "asc" },
    });
    if (!existingCharge) {
      await tx.transaction.create({
        data: {
          accountId: intent.accountId,
          intentId: intent.id,
          type: "CHARGE",
          amount: intent.amount,
          currency: intent.currency,
          providerRef: intent.providerRef,
          providerStatus: input.providerStatus,
          providerPayload: jsonOrNull(input.raw),
          paidAt: intent.paidAt ?? new Date(),
        },
      });
    }

    return intent;
  });
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
