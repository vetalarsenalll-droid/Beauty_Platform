import { NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { prisma } from "@/lib/prisma";
import { normalizeProviderCode } from "@/lib/account-payments/types";
import { saveAccountPaymentConnection } from "@/lib/account-payments/connections";
import { logAccountAudit } from "@/lib/crm-audit";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireCrmApiPermission("crm.settings.read");
  if ("response" in auth) return auth.response;

  const connections = await prisma.accountPaymentConnection.findMany({
    where: { accountId: auth.session.accountId },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    select: {
      id: true,
      provider: true,
      mode: true,
      title: true,
      isEnabled: true,
      isDefault: true,
      credentialsMasked: true,
      publicConfig: true,
      receiptEnabled: true,
      receiptVat: true,
      receiptTaxationSystem: true,
      receiptFfdVersion: true,
      paymentSubject: true,
      paymentMethod: true,
      currency: true,
      lastTestedAt: true,
      lastTestStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return applyCrmAccessCookie(jsonOk({ connections }), auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.settings.update");
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return jsonError("VALIDATION_FAILED", "JSON body is required", null, 400);
  }

  try {
    const provider = normalizeProviderCode(String(body.provider ?? ""));
    const before = await prisma.accountPaymentConnection.findFirst({
      where: { accountId: auth.session.accountId, provider: providerToDbValue(provider) },
      orderBy: { id: "asc" },
      select: accountPaymentConnectionAuditSelect,
    });

    const connection = await saveAccountPaymentConnection({
      accountId: auth.session.accountId,
      provider,
      mode: body.mode === "LIVE" ? "LIVE" : "TEST",
      title: typeof body.title === "string" ? body.title : null,
      isEnabled: Boolean(body.isEnabled),
      isDefault: body.isDefault === undefined ? true : Boolean(body.isDefault),
      credentials: body.credentials,
      publicConfig: body.publicConfig,
      receiptEnabled: Boolean(body.receiptEnabled),
      receiptVat: parseReceiptVat(body.receiptVat),
      receiptTaxationSystem: parseTaxation(body.receiptTaxationSystem),
      receiptFfdVersion: typeof body.receiptFfdVersion === "string" ? body.receiptFfdVersion : null,
      paymentSubject: typeof body.paymentSubject === "string" ? body.paymentSubject : "service",
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : "full_payment",
      currency: typeof body.currency === "string" ? body.currency : "RUB",
    });

    const savedConnection = await prisma.accountPaymentConnection.update({
      where: { id: connection.id },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: "CONFIG_SAVED",
      },
    });

    const after = await prisma.accountPaymentConnection.findUnique({
      where: { id: connection.id },
      select: accountPaymentConnectionAuditSelect,
    });
    const diff = paymentConnectionAuditDiff(before, after);
    if (diff) {
      await logAccountAudit({
        accountId: auth.session.accountId,
        userId: auth.session.userId,
        action: before ? "Обновил платежное подключение" : "Создал платежное подключение",
        targetType: "account-payment-connection",
        targetId: connection.id,
        diffJson: diff,
      });
    }

    return applyCrmAccessCookie(
      jsonOk({
        connection: {
          id: savedConnection.id,
          provider: savedConnection.provider,
          mode: savedConnection.mode,
          title: savedConnection.title,
          isEnabled: savedConnection.isEnabled,
          isDefault: savedConnection.isDefault,
          credentialsMasked: savedConnection.credentialsMasked,
          receiptEnabled: savedConnection.receiptEnabled,
          receiptVat: savedConnection.receiptVat,
          receiptTaxationSystem: savedConnection.receiptTaxationSystem,
          receiptFfdVersion: savedConnection.receiptFfdVersion,
          currency: savedConnection.currency,
          lastTestedAt: savedConnection.lastTestedAt?.toISOString() ?? null,
          lastTestStatus: savedConnection.lastTestStatus,
        },
      }),
      auth,
    );
  } catch (error) {
    return jsonError(
      "ACCOUNT_PAYMENT_CONNECTION_FAILED",
      error instanceof Error ? error.message : "Failed to save payment connection",
      null,
      400,
    );
  }
}

const accountPaymentConnectionAuditSelect = {
  id: true,
  provider: true,
  mode: true,
  title: true,
  isEnabled: true,
  isDefault: true,
  credentialsMasked: true,
  publicConfig: true,
  receiptEnabled: true,
  receiptVat: true,
  receiptTaxationSystem: true,
  receiptFfdVersion: true,
  paymentSubject: true,
  paymentMethod: true,
  currency: true,
} as const;

type AccountPaymentConnectionAuditSnapshot = {
  id: number;
  provider: string;
  mode: string;
  title: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  credentialsMasked: unknown;
  publicConfig: unknown;
  receiptEnabled: boolean;
  receiptVat: string;
  receiptTaxationSystem: string;
  receiptFfdVersion: string | null;
  paymentSubject: string | null;
  paymentMethod: string | null;
  currency: string;
} | null;

function providerToDbValue(provider: ReturnType<typeof normalizeProviderCode>) {
  if (provider === "yookassa") return "YOOKASSA";
  if (provider === "tbank") return "TBANK";
  if (provider === "sber") return "SBER";
  return "ALFA";
}

function paymentConnectionAuditDiff(
  before: AccountPaymentConnectionAuditSnapshot,
  after: AccountPaymentConnectionAuditSnapshot,
) {
  if (!after) return null;
  const afterSnapshot = paymentConnectionAuditSnapshot(after);
  if (!before) return { created: afterSnapshot };

  const beforeSnapshot = paymentConnectionAuditSnapshot(before);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(afterSnapshot) as Array<keyof typeof afterSnapshot>) {
    const from = beforeSnapshot[key];
    const to = afterSnapshot[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[key] = { from, to };
    }
  }
  return Object.keys(changes).length > 0 ? { changes } : null;
}

function paymentConnectionAuditSnapshot(connection: NonNullable<AccountPaymentConnectionAuditSnapshot>) {
  return {
    provider: connection.provider,
    mode: connection.mode,
    title: connection.title,
    isEnabled: connection.isEnabled,
    isDefault: connection.isDefault,
    credentialsMasked: connection.credentialsMasked,
    publicConfig: connection.publicConfig,
    receiptEnabled: connection.receiptEnabled,
    receiptVat: connection.receiptVat,
    receiptTaxationSystem: connection.receiptTaxationSystem,
    receiptFfdVersion: connection.receiptFfdVersion,
    paymentSubject: connection.paymentSubject,
    paymentMethod: connection.paymentMethod,
    currency: connection.currency,
  };
}

function parseReceiptVat(value: unknown) {
  const raw = String(value ?? "NONE").toUpperCase();
  if (["NONE", "VAT_0", "VAT_5", "VAT_7", "VAT_10", "VAT_18", "VAT_20"].includes(raw)) {
    return raw as "NONE" | "VAT_0" | "VAT_5" | "VAT_7" | "VAT_10" | "VAT_18" | "VAT_20";
  }
  return "NONE";
}

function parseTaxation(value: unknown) {
  const raw = String(value ?? "DEFAULT").toUpperCase();
  if (["DEFAULT", "OSN", "USN_INCOME", "USN_INCOME_OUTCOME", "ENVD", "ESN", "PATENT"].includes(raw)) {
    return raw as "DEFAULT" | "OSN" | "USN_INCOME" | "USN_INCOME_OUTCOME" | "ENVD" | "ESN" | "PATENT";
  }
  return "DEFAULT";
}
