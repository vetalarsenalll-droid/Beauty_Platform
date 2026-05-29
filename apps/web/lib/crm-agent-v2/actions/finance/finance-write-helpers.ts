import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { inputJson, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";
import { financeRange, financeTake, money } from "./finance-read-helpers";

type PaymentIntentStatusValue = "CREATED" | "REQUIRES_ACTION" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";

export async function previewFinancePayload(payload: JsonRecord) {
  return buildActionPreview({ after: payload });
}

export async function readPaymentIntents(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = financeRange(payload);
  const rows = await prisma.paymentIntent.findMany({
    where: {
      accountId,
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(numberOrNull(payload.clientId) ? { clientId: numberOrNull(payload.clientId) } : {}),
      ...(numberOrNull(payload.appointmentId) ? { appointmentId: numberOrNull(payload.appointmentId) } : {}),
      ...(optionalString(payload, "status") ? { status: optionalString(payload, "status") as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: financeTake(payload.take),
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 5 }, refunds: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return { paymentIntents: rows.map(serializePaymentIntent) };
}

export async function readReceipt(accountId: number, payload: JsonRecord) {
  const receiptId = requiredNumber(payload.receiptId, "receiptId");
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, accountId },
    include: { transaction: true },
  });
  if (!receipt) throw new Error("Receipt not found.");
  return { receipt: serializeReceipt(receipt) };
}

export async function readRevenueByService(accountId: number, payload: JsonRecord) {
  return revenueByAppointmentDimension(accountId, payload, "service");
}

export async function readRevenueBySpecialist(accountId: number, payload: JsonRecord) {
  return revenueByAppointmentDimension(accountId, payload, "specialist");
}

export async function readRevenueByLocation(accountId: number, payload: JsonRecord) {
  return revenueByAppointmentDimension(accountId, payload, "location");
}

export async function readFindUnpaid(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = financeRange(payload);
  const appointments = await prisma.appointment.findMany({
    where: { accountId, startAt: { gte: dateFrom, lte: dateTo } },
    orderBy: { startAt: "desc" },
    take: financeTake(payload.take),
    include: { paymentIntents: true, client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  });
  return {
    unpaidAppointments: appointments
      .map((appointment) => {
        const paid = appointment.paymentIntents
          .filter((intent) => intent.status === "SUCCEEDED")
          .reduce((sum, intent) => sum + Number(intent.amount), 0);
        const total = Number(appointment.priceTotal);
        return {
          appointmentId: appointment.id,
          client: appointment.client,
          startAt: appointment.startAt.toISOString(),
          status: appointment.status,
          total,
          paid,
          due: Math.max(total - paid, 0),
          currency: appointment.paymentIntents[0]?.currency ?? "RUB",
        };
      })
      .filter((row) => row.due > 0),
  };
}

export async function executePaymentIntentCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = numberOrNull(payload.appointmentId);
  const clientId = numberOrNull(payload.clientId);
  if (appointmentId) await assertAppointment(ctx.accountId, appointmentId);
  if (clientId) await assertClient(ctx.accountId, clientId);
  const amount = decimalString(payload.amount, "amount");
  const intent = await prisma.paymentIntent.create({
    data: {
      accountId: ctx.accountId,
      appointmentId,
      clientId,
      amount,
      currency: optionalString(payload, "currency") ?? "RUB",
      scenario: optionalString(payload, "scenario") ?? "crm_manual",
      provider: optionalString(payload, "provider"),
      providerRef: optionalString(payload, "providerRef"),
      status: paymentIntentStatus(payload.status ?? "CREATED"),
    },
  });
  return { status: "DONE" as const, data: { paymentIntentId: intent.id } };
}

export async function executePaymentIntentCancel(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const paymentIntentId = requiredNumber(payload.paymentIntentId, "paymentIntentId");
  const updated = await prisma.paymentIntent.updateMany({
    where: { id: paymentIntentId, accountId: ctx.accountId, status: { in: ["CREATED", "REQUIRES_ACTION", "PROCESSING"] } },
    data: { status: "CANCELLED" },
  });
  if (!updated.count) throw new Error("Cancelable payment intent not found.");
  return { status: "DONE" as const, data: { paymentIntentId, status: "CANCELLED" } };
}

export async function executeReconcileAppointment(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, accountId: ctx.accountId }, include: { paymentIntents: true } });
  if (!appointment) throw new Error("Appointment not found.");
  const amount = decimalString(payload.amount ?? appointment.priceTotal.toString(), "amount");
  const intentId = numberOrNull(payload.paymentIntentId);
  const intent = intentId
    ? await updateIntentSucceeded(ctx.accountId, intentId)
    : await prisma.paymentIntent.create({
      data: {
        accountId: ctx.accountId,
        appointmentId,
        clientId: appointment.clientId,
        amount,
        currency: optionalString(payload, "currency") ?? "RUB",
        scenario: optionalString(payload, "scenario") ?? "crm_reconcile",
        provider: optionalString(payload, "provider") ?? "manual",
        providerRef: optionalString(payload, "providerRef"),
        status: "SUCCEEDED",
      },
    });
  const transaction = await prisma.transaction.create({
    data: {
      accountId: ctx.accountId,
      intentId: intent.id,
      type: "OFFLINE_PAYMENT",
      amount,
      currency: optionalString(payload, "currency") ?? intent.currency,
      providerRef: optionalString(payload, "providerRef"),
    },
  });
  return { status: "DONE" as const, data: { appointmentId, paymentIntentId: intent.id, transactionId: transaction.id } };
}

export async function executeRefundCreate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const transactionId = numberOrNull(payload.transactionId);
  const intentId = numberOrNull(payload.paymentIntentId ?? payload.intentId);
  if (!transactionId && !intentId) throw new Error("Action payload transactionId or paymentIntentId is required.");
  if (transactionId) await assertTransaction(ctx.accountId, transactionId);
  if (intentId) await assertPaymentIntent(ctx.accountId, intentId);
  const refund = await prisma.refund.create({
    data: {
      accountId: ctx.accountId,
      transactionId,
      intentId,
      amount: decimalString(payload.amount, "amount"),
      reason: optionalString(payload, "reason"),
      status: "PENDING",
    },
  });
  return { status: "DONE" as const, data: { refundId: refund.id, status: refund.status } };
}

export async function executeReceiptResend(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const receiptId = requiredNumber(payload.receiptId, "receiptId");
  const receipt = await prisma.receipt.findFirst({ where: { id: receiptId, accountId: ctx.accountId } });
  if (!receipt) throw new Error("Receipt not found.");
  const outbox = await prisma.outboxItem.create({
    data: {
      scope: "ACCOUNT",
      accountId: ctx.accountId,
      userId: null,
      eventName: "receipt.resend",
      payload: inputJson({ receiptId, provider: receipt.provider, receiptUrl: receipt.receiptUrl, email: optionalString(payload, "email") }),
      status: "PENDING",
      dedupeKey: `crm-agent-v2:${ctx.accountId}:receipt.resend:${receiptId}:${Date.now()}`,
      availableAt: ctx.now,
    },
  });
  return { status: "DONE" as const, data: { receiptId, outboxItemId: outbox.id } };
}

async function revenueByAppointmentDimension(accountId: number, payload: JsonRecord, dimension: "service" | "specialist" | "location") {
  const { dateFrom, dateTo } = financeRange(payload);
  const transactions = await prisma.transaction.findMany({
    where: { accountId, createdAt: { gte: dateFrom, lte: dateTo }, intent: { appointmentId: { not: null } } },
    include: {
      intent: {
        include: {
          appointment: {
            include: {
              location: { select: { id: true, name: true } },
              specialist: { select: { id: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
              services: { include: { service: { select: { id: true, name: true } } } },
            },
          },
        },
      },
    },
  });
  const grouped = new Map<string, { id: number; name: string; amount: number; count: number }>();
  for (const transaction of transactions) {
    const appointment = transaction.intent?.appointment;
    if (!appointment) continue;
    const amount = Number(transaction.amount);
    const targets =
      dimension === "service"
        ? appointment.services.map((item) => ({ id: item.service.id, name: item.service.name, share: appointment.services.length ? amount / appointment.services.length : amount }))
        : dimension === "location"
          ? [{ id: appointment.location.id, name: appointment.location.name, share: amount }]
          : [{ id: appointment.specialist.id, name: specialistName(appointment.specialist), share: amount }];
    for (const target of targets) {
      const key = String(target.id);
      const current = grouped.get(key) ?? { id: target.id, name: target.name, amount: 0, count: 0 };
      current.amount += target.share;
      current.count += 1;
      grouped.set(key, current);
    }
  }
  return {
    range: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    dimension,
    rows: [...grouped.values()].sort((a, b) => b.amount - a.amount),
  };
}

async function updateIntentSucceeded(accountId: number, intentId: number) {
  const intent = await prisma.paymentIntent.findFirst({ where: { id: intentId, accountId } });
  if (!intent) throw new Error("Payment intent not found.");
  return prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "SUCCEEDED" } });
}

async function assertAppointment(accountId: number, appointmentId: number) {
  const row = await prisma.appointment.findFirst({ where: { id: appointmentId, accountId }, select: { id: true } });
  if (!row) throw new Error("Appointment not found.");
}

async function assertClient(accountId: number, clientId: number) {
  const row = await prisma.client.findFirst({ where: { id: clientId, accountId }, select: { id: true } });
  if (!row) throw new Error("Client not found.");
}

async function assertPaymentIntent(accountId: number, paymentIntentId: number) {
  const row = await prisma.paymentIntent.findFirst({ where: { id: paymentIntentId, accountId }, select: { id: true } });
  if (!row) throw new Error("Payment intent not found.");
}

async function assertTransaction(accountId: number, transactionId: number) {
  const row = await prisma.transaction.findFirst({ where: { id: transactionId, accountId }, select: { id: true } });
  if (!row) throw new Error("Transaction not found.");
}

function serializePaymentIntent(intent: {
  id: number;
  appointmentId: number | null;
  clientId: number | null;
  amount: { toString(): string };
  currency: string;
  status: unknown;
  scenario: string;
  provider: string | null;
  providerRef: string | null;
  createdAt: Date;
  updatedAt: Date;
  transactions: Array<{ id: number; type: unknown; amount: { toString(): string }; currency: string; providerRef: string | null; createdAt: Date }>;
  refunds: Array<{ id: number; amount: { toString(): string }; status: unknown; reason: string | null; createdAt: Date }>;
}) {
  return {
    ...intent,
    amount: money(intent.amount),
    createdAt: intent.createdAt.toISOString(),
    updatedAt: intent.updatedAt.toISOString(),
    transactions: intent.transactions.map((transaction) => ({ ...transaction, amount: money(transaction.amount), createdAt: transaction.createdAt.toISOString() })),
    refunds: intent.refunds.map((refund) => ({ ...refund, amount: money(refund.amount), createdAt: refund.createdAt.toISOString() })),
  };
}

function serializeReceipt(receipt: {
  id: number;
  transactionId: number | null;
  provider: string;
  receiptUrl: string | null;
  payload: unknown;
  createdAt: Date;
  transaction: { id: number; type: unknown; amount: { toString(): string }; currency: string; providerRef: string | null; createdAt: Date } | null;
}) {
  return {
    ...receipt,
    createdAt: receipt.createdAt.toISOString(),
    transaction: receipt.transaction ? { ...receipt.transaction, amount: money(receipt.transaction.amount), createdAt: receipt.transaction.createdAt.toISOString() } : null,
  };
}

function paymentIntentStatus(value: unknown): PaymentIntentStatusValue {
  if (value === "CREATED" || value === "REQUIRES_ACTION" || value === "PROCESSING" || value === "SUCCEEDED" || value === "FAILED" || value === "CANCELLED" || value === "EXPIRED") return value;
  throw new Error("Action payload status is invalid.");
}

function decimalString(value: unknown, key: string) {
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Prisma.Decimal(value);
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return new Prisma.Decimal(value.trim());
  throw new Error(`Action payload ${key} is required.`);
}

function specialistName(specialist: { user: { profile: { firstName: string | null; lastName: string | null } | null } }) {
  return [specialist.user.profile?.firstName, specialist.user.profile?.lastName].filter(Boolean).join(" ") || "Specialist";
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}
