import { prisma } from "@/lib/prisma";
import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { money } from "./finance-read-helpers";

export const financeViewClientBalanceAction = defineCrmAgentAction({
  name: "finance.view_client_balance",
  domain: "finance",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: [],
  description: "Показать баланс клиента.",
  plannerHints: ["Use finance.view_client_balance when the user asks to inspect: Показать баланс клиента."],
  read: async (payload: JsonRecord, ctx) => {
    const clientId = requiredNumber(payload.clientId, "clientId");
    const client = await prisma.client.findFirst({
      where: { id: clientId, accountId: ctx.accountId },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    });
    if (!client) throw new Error("Client not found.");
    const [payments, refunds] = await Promise.all([
      prisma.paymentIntent.findMany({
        where: { accountId: ctx.accountId, clientId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, amount: true, currency: true, status: true, createdAt: true },
      }),
      prisma.refund.findMany({
        where: { accountId: ctx.accountId, intent: { clientId } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, amount: true, status: true, createdAt: true },
      }),
    ]);
    const paid = payments.filter((payment) => String(payment.status) === "SUCCEEDED").reduce((sum, payment) => sum + Number(payment.amount), 0);
    const refunded = refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
    return {
      client: { ...client, displayName: [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || null },
      balance: { paid, refunded, net: paid - refunded, currency: payments[0]?.currency ?? "RUB" },
      payments: payments.map((payment) => ({ ...payment, amount: money(payment.amount), createdAt: payment.createdAt.toISOString() })),
      refunds: refunds.map((refund) => ({ ...refund, amount: money(refund.amount), createdAt: refund.createdAt.toISOString() })),
    };
  },
});
