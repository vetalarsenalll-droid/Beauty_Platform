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
  metadata?: Prisma.InputJsonValue;
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
  const receiptItems =
    input.receiptItems ??
    (loaded.connection.receiptEnabled
      ? [
          {
            name: input.description,
            quantity: 1,
            unitPriceRub: input.amountRub,
            amountRub: input.amountRub,
            vat: loaded.connection.receiptVat,
            paymentSubject: loaded.connection.paymentSubject,
            paymentMethod: loaded.connection.paymentMethod,
          },
        ]
      : undefined);
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
      metadata: input.metadata ?? undefined,
      idempotencyKey: input.idempotencyKey ?? `account_checkout_${input.accountId}_${Date.now()}`,
      returnUrl: input.returnUrl ?? null,
      failUrl: input.failUrl ?? null,
      receiptRequested: Boolean(receiptItems?.length && loaded.connection.receiptEnabled),
      receiptPayload: receiptItems ? { items: receiptItems } : undefined,
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
    receiptItems,
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

    if (intent.appointmentId && intent.scenario.startsWith("appointment_")) {
      const appointmentIds = metadataAppointmentIds(intent.metadata);
      const includePendingPaymentAppointments = metadataAppointmentPendingPayment(intent.metadata);
      const appointmentsToConfirm = await tx.appointment.findMany({
        where: {
          id: { in: appointmentIds.length ? appointmentIds : [intent.appointmentId] },
          accountId: intent.accountId,
          status: { in: includePendingPaymentAppointments ? ["NEW", "CANCELLED"] : ["NEW"] },
        },
        select: { id: true, status: true },
      });

      if (appointmentsToConfirm.length > 0) {
        await tx.appointment.updateMany({
          where: {
            id: { in: appointmentsToConfirm.map((appointment) => appointment.id) },
            accountId: intent.accountId,
          },
          data: { status: "CONFIRMED" },
        });

        await tx.appointmentStatusHistory.createMany({
          data: appointmentsToConfirm.map((appointment) => ({
            appointmentId: appointment.id,
            actorType: "system",
            actorId: null,
            fromStatus: appointment.status,
            toStatus: "CONFIRMED",
            comment: "Оплата подтверждена",
          })),
        });
      }
    }

    return intent;
  });
}

function metadataAppointmentIds(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const ids = (value as { appointmentIds?: unknown }).appointmentIds;
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
}

function metadataAppointmentPendingPayment(value: unknown) {
  return Boolean(value && typeof value === "object" && (value as { appointmentPendingPayment?: unknown }).appointmentPendingPayment === true);
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
