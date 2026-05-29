import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalDate, type JsonRecord } from "../action-helpers";

export function financeRange(payload: JsonRecord) {
  const dateFrom = optionalDate(payload, "dateFrom") ?? addDays(new Date(), -30);
  const dateTo = optionalDate(payload, "dateTo") ?? new Date();
  return { dateFrom, dateTo };
}

export function money(value: { toString(): string } | null | undefined) {
  return value == null ? null : value.toString();
}

export function financeTake(value: unknown, fallback = 30, max = 100) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}

export async function revenueSummary(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = financeRange(payload);
  const transactions = await prisma.transaction.findMany({
    where: { accountId, createdAt: { gte: dateFrom, lte: dateTo } },
    select: { type: true, amount: true, currency: true, createdAt: true },
  });
  const gross = transactions.reduce((sum, item) => sum + Number(item.amount), 0);
  const refunds = await prisma.refund.findMany({
    where: { accountId, createdAt: { gte: dateFrom, lte: dateTo } },
    select: { amount: true, status: true },
  });
  const refunded = refunds.reduce((sum, item) => sum + Number(item.amount), 0);
  return {
    range: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    totals: {
      transactions: transactions.length,
      grossRevenue: gross,
      refunds: refunded,
      netRevenue: gross - refunded,
      currency: transactions[0]?.currency ?? "RUB",
    },
    byDay: groupMoneyByDay(transactions),
  };
}

function groupMoneyByDay(rows: Array<{ amount: { toString(): string }; createdAt: Date }>) {
  const result = new Map<string, { count: number; amount: number }>();
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const current = result.get(key) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(row.amount);
    result.set(key, current);
  }
  return Object.fromEntries(result);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
