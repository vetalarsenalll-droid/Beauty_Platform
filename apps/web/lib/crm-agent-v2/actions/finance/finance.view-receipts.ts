import { prisma } from "@/lib/prisma";
import { type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { financeRange, financeTake, money } from "./finance-read-helpers";

export const financeViewReceiptsAction = defineCrmAgentAction({
  name: "finance.view_receipts",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Показать чеки.",
  plannerHints: ["Use finance.view_receipts when the user asks to inspect: Показать чеки."],
  read: async (payload: JsonRecord, ctx) => {
    const { dateFrom, dateTo } = financeRange(payload);
    const rows = await prisma.receipt.findMany({
      where: { accountId: ctx.accountId, createdAt: { gte: dateFrom, lte: dateTo } },
      orderBy: { createdAt: "desc" },
      take: financeTake(payload.take),
      select: { id: true, transactionId: true, provider: true, receiptUrl: true, payload: true, createdAt: true, transaction: { select: { amount: true, currency: true, type: true } } },
    });
    return {
      receipts: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        transaction: row.transaction ? { ...row.transaction, amount: money(row.transaction.amount) } : null,
      })),
    };
  },
});
