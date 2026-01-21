import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

function mapInvoice(invoice: {
  id: number;
  accountId: number;
  subscriptionId: number | null;
  status: string;
  amount: Prisma.Decimal;
  currency: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: invoice.id,
    accountId: invoice.accountId,
    subscriptionId: invoice.subscriptionId,
    status: invoice.status,
    amount: invoice.amount.toString(),
    currency: invoice.currency,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const accountIdRaw = searchParams.get("accountId");
  const accountId =
    accountIdRaw && Number.isInteger(Number(accountIdRaw))
      ? Number(accountIdRaw)
      : null;

  const invoices = await prisma.platformInvoice.findMany({
    where: accountId ? { accountId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const response = jsonOk(invoices.map(mapInvoice));
  return applyAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const accountId = Number(body.accountId);
  if (!Number.isInteger(accountId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный аккаунт", {
      fields: [{ path: "accountId", issue: "invalid" }],
    });
  }

  const currency = String(body.currency ?? "RUB").trim();
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(body.amount);
  } catch {
    return jsonError("VALIDATION_FAILED", "Некорректная сумма", {
      fields: [{ path: "amount", issue: "invalid" }],
    });
  }

  const dueAt = body.dueAt ? new Date(String(body.dueAt)) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return jsonError("VALIDATION_FAILED", "Некорректная дата", {
      fields: [{ path: "dueAt", issue: "invalid" }],
    });
  }

  const subscription = await prisma.platformSubscription.findFirst({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });

  const invoice = await prisma.platformInvoice.create({
    data: {
      accountId,
      subscriptionId: subscription?.id ?? null,
      status: "ISSUED",
      amount,
      currency,
      issuedAt: new Date(),
      dueAt: dueAt ?? null,
    },
  });

  await logPlatformAudit({
    adminId: session.adminId,
    action: "Выставлен счет",
    targetType: "platform_invoice",
    targetId: invoice.id,
    diffJson: {
      accountId,
      amount: amount.toString(),
      currency,
      dueAt: dueAt?.toISOString() ?? null,
    },
  });

  const response = jsonOk(mapInvoice(invoice), 201);
  return applyAccessCookie(response, auth);
}
