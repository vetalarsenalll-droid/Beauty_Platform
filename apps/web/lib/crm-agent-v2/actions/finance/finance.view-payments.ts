import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { financeRange, financeTake, money } from "./finance-read-helpers";

export const financeViewPaymentsAction = defineCrmAgentAction({
  name: "finance.view_payments",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["clientId", "appointmentId", "status", "dateFrom", "dateTo", "take"],
  description: "Показать платежи.",
  plannerHints: ["Use finance.view_payments when the user asks to inspect: Показать платежи."],
  read: async (payload: JsonRecord, ctx) => {
    const { dateFrom, dateTo } = financeRange(payload);
    const rows = await prisma.paymentIntent.findMany({
      where: {
        accountId: ctx.accountId,
        createdAt: { gte: dateFrom, lte: dateTo },
        ...(numberOrNull(payload.clientId) ? { clientId: numberOrNull(payload.clientId) } : {}),
        ...(numberOrNull(payload.appointmentId) ? { appointmentId: numberOrNull(payload.appointmentId) } : {}),
        ...(optionalString(payload, "status") ? { status: optionalString(payload, "status") as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: financeTake(payload.take),
      select: { id: true, appointmentId: true, clientId: true, amount: true, currency: true, status: true, scenario: true, provider: true, createdAt: true, updatedAt: true },
    });
    return {
      payments: rows.map((row) => ({
        ...row,
        amount: money(row.amount),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  },
});
