import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptAccountPaymentCredentials } from "./credentials";
import { getAccountPaymentProvider } from "./provider";
import { refundStatusFromNormalized } from "./status";
import type { NormalizedPaymentStatus } from "./types";
import { toConnectionSnapshot } from "./connections";

type RefundAccountPaymentCommand = {
  accountId: number;
  intentId: number;
  amountRub: number;
  reason?: string | null;
};

function jsonOrNull(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function refundedAmountFromProviderState(input: {
  normalizedStatus: NormalizedPaymentStatus;
  raw: unknown;
  totalRub: number;
  localRefundedRub: number;
}) {
  if (input.normalizedStatus === "refunded") {
    return roundMoney(input.totalRub - input.localRefundedRub);
  }

  if (input.normalizedStatus !== "partially_refunded") return 0;
  if (!input.raw || typeof input.raw !== "object") return 0;

  const rawAmount = (input.raw as { Amount?: unknown }).Amount;
  if (typeof rawAmount !== "number" || !Number.isFinite(rawAmount)) return 0;

  const providerRemainingRub = roundMoney(rawAmount / 100);
  const providerRefundedRub = roundMoney(input.totalRub - providerRemainingRub);
  return roundMoney(providerRefundedRub - input.localRefundedRub);
}

async function createLocalRefund(input: {
  accountId: number;
  intentId: number;
  transactionId?: number | null;
  amountRub: number;
  currency: string;
  reason?: string | null;
  providerRef: string | null;
  providerStatus: string;
  providerPayload: unknown;
  completedAt?: Date | null;
}) {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        accountId: input.accountId,
        intentId: input.intentId,
        transactionId: input.transactionId ?? null,
        amount: new Prisma.Decimal(input.amountRub),
        status: "SUCCEEDED",
        reason: input.reason?.trim() || null,
        providerRef: input.providerRef,
        providerStatus: input.providerStatus,
        providerPayload: jsonOrNull(input.providerPayload),
        completedAt: input.completedAt ?? new Date(),
      },
    });

    await tx.transaction.create({
      data: {
        accountId: input.accountId,
        intentId: input.intentId,
        type: "REFUND",
        amount: new Prisma.Decimal(input.amountRub),
        currency: input.currency,
        providerRef: input.providerRef,
        providerStatus: input.providerStatus,
        providerPayload: jsonOrNull(input.providerPayload),
        paidAt: input.completedAt ?? new Date(),
      },
    });

    await tx.paymentIntent.update({
      where: { id: input.intentId },
      data: {
        providerStatus: input.providerStatus,
        providerPayload: jsonOrNull(input.providerPayload),
      },
    });

    return refund;
  });
}

export async function refundAccountPayment(input: RefundAccountPaymentCommand) {
  const amountRub = roundMoney(input.amountRub);
  if (!Number.isFinite(amountRub) || amountRub <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: { id: input.intentId, accountId: input.accountId },
    include: {
      connection: true,
      transactions: {
        where: { type: "CHARGE" },
        orderBy: { id: "asc" },
        take: 1,
      },
      refunds: {
        where: { status: { in: ["PENDING", "SUCCEEDED"] } },
        select: { id: true, amount: true, status: true },
      },
    },
  });

  if (!intent) throw new Error("Payment intent not found");
  if (!intent.connection) throw new Error("Payment connection is not linked to this payment");
  if (!intent.providerRef) throw new Error("Provider payment id is missing");
  if (intent.status !== "SUCCEEDED") throw new Error("Only succeeded payments can be refunded");

  const refundedRub = intent.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  const remainingRub = roundMoney(Number(intent.amount) - refundedRub);
  if (amountRub > remainingRub) {
    throw new Error(`Refund amount cannot exceed remaining amount ${remainingRub}`);
  }

  const snapshot = toConnectionSnapshot(intent.connection);
  const credentials = decryptAccountPaymentCredentials(intent.connection.credentialsEncrypted);
  const provider = getAccountPaymentProvider(snapshot.provider);
  const idempotencyKey = `account_refund_${intent.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const result = await provider.refundPayment({
    connection: snapshot,
    credentials,
    providerRef: intent.providerRef,
    amountRub,
    idempotencyKey,
    reason: input.reason,
  });

  const refundStatus = refundStatusFromNormalized(result.normalizedStatus);
  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        accountId: intent.accountId,
        intentId: intent.id,
        transactionId: intent.transactions[0]?.id ?? null,
        amount: new Prisma.Decimal(amountRub),
        status: refundStatus,
        reason: input.reason?.trim() || null,
        providerRef: result.providerRef,
        providerStatus: result.providerStatus,
        providerPayload: jsonOrNull(result.raw),
        completedAt: refundStatus === "SUCCEEDED" ? new Date() : null,
      },
    });

    if (refundStatus === "SUCCEEDED") {
      await tx.transaction.create({
        data: {
          accountId: intent.accountId,
          intentId: intent.id,
          type: "REFUND",
          amount: new Prisma.Decimal(amountRub),
          currency: intent.currency,
          providerRef: result.providerRef,
          providerStatus: result.providerStatus,
          providerPayload: jsonOrNull(result.raw),
          paidAt: new Date(),
        },
      });
    }

    await tx.paymentIntent.update({
      where: { id: intent.id },
      data: {
        providerStatus: result.providerStatus,
        providerPayload: jsonOrNull(result.raw),
      },
    });

    return refund;
  });
}

export async function syncAccountPaymentRefundState(accountId: number, intentId: number) {
  const intent = await prisma.paymentIntent.findFirst({
    where: { id: intentId, accountId },
    include: {
      connection: true,
      transactions: {
        where: { type: "CHARGE" },
        orderBy: { id: "asc" },
        take: 1,
      },
      refunds: {
        where: { status: { in: ["PENDING", "SUCCEEDED"] } },
        select: { id: true, amount: true, status: true },
      },
    },
  });

  if (!intent) throw new Error("Платеж не найден");
  if (!intent.connection) throw new Error("У платежа нет платежного подключения");
  if (!intent.providerRef) throw new Error("У платежа нет банковского идентификатора");

  const snapshot = toConnectionSnapshot(intent.connection);
  const credentials = decryptAccountPaymentCredentials(intent.connection.credentialsEncrypted);
  const provider = getAccountPaymentProvider(snapshot.provider);
  const state = await provider.getPaymentStatus({
    connection: snapshot,
    credentials,
    providerRef: intent.providerRef,
  });

  const localSucceededRefundedRub = intent.refunds
    .filter((refund) => refund.status === "SUCCEEDED")
    .reduce((sum, refund) => sum + Number(refund.amount), 0);
  const amountRub = refundedAmountFromProviderState({
    normalizedStatus: state.normalizedStatus,
    raw: state.raw,
    totalRub: Number(intent.amount),
    localRefundedRub: localSucceededRefundedRub,
  });

  if (amountRub <= 0) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        providerStatus: state.providerStatus,
        providerPayload: jsonOrNull(state.raw),
      },
    });
    return {
      refund: null,
      providerStatus: state.providerStatus,
      normalizedStatus: state.normalizedStatus,
    };
  }

  const pendingRefunds = intent.refunds.filter((refund) => refund.status === "PENDING");
  if (pendingRefunds.length) {
    let remainingProviderRefundRub = amountRub;
    const completedAt = new Date();
    const updatedRefunds = [];

    for (const pendingRefund of pendingRefunds) {
      const pendingAmountRub = roundMoney(Number(pendingRefund.amount));
      if (pendingAmountRub > remainingProviderRefundRub) continue;

      const updatedRefund = await prisma.$transaction(async (tx) => {
        const refund = await tx.refund.update({
          where: { id: pendingRefund.id },
          data: {
            status: "SUCCEEDED",
            providerStatus: state.providerStatus,
            providerPayload: jsonOrNull(state.raw),
            completedAt,
          },
        });

        await tx.transaction.create({
          data: {
            accountId: intent.accountId,
            intentId: intent.id,
            type: "REFUND",
            amount: new Prisma.Decimal(pendingAmountRub),
            currency: intent.currency,
            providerRef: intent.providerRef,
            providerStatus: state.providerStatus,
            providerPayload: jsonOrNull(state.raw),
            paidAt: completedAt,
          },
        });

        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: {
            providerStatus: state.providerStatus,
            providerPayload: jsonOrNull(state.raw),
          },
        });

        return refund;
      });

      updatedRefunds.push(updatedRefund);
      remainingProviderRefundRub = roundMoney(remainingProviderRefundRub - pendingAmountRub);
    }

    if (updatedRefunds.length) {
      return {
        refund: updatedRefunds[0],
        providerStatus: state.providerStatus,
        normalizedStatus: state.normalizedStatus,
      };
    }
  }

  const refund = await createLocalRefund({
    accountId: intent.accountId,
    intentId: intent.id,
    transactionId: intent.transactions[0]?.id ?? null,
    amountRub,
    currency: intent.currency,
    reason: "Сверено с банком",
    providerRef: intent.providerRef,
    providerStatus: state.providerStatus,
    providerPayload: state.raw,
  });

  return {
    refund,
    providerStatus: state.providerStatus,
    normalizedStatus: state.normalizedStatus,
  };
}
