import { prisma } from "@/lib/prisma";
import { optionalString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { financeRange, financeTake, money } from "./finance-read-helpers";

export const financeViewRefundsAction = defineCrmAgentAction({
  name: "finance.view_refunds",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["status", "dateFrom", "dateTo", "take"],
  description: "Показать возвраты.",
  plannerHints: ["Use finance.view_refunds when the user asks to inspect: Показать возвраты."],
  read: async (payload: JsonRecord, ctx) => {
    const { dateFrom, dateTo } = financeRange(payload);
    const rows = await prisma.refund.findMany({
      where: {
        accountId: ctx.accountId,
        createdAt: { gte: dateFrom, lte: dateTo },
        ...(optionalString(payload, "status") ? { status: optionalString(payload, "status") as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: financeTake(payload.take),
      select: { id: true, transactionId: true, intentId: true, amount: true, status: true, reason: true, createdAt: true },
    });
    return { refunds: rows.map((row) => ({ ...row, amount: money(row.amount), createdAt: row.createdAt.toISOString() })) };
  },
});
