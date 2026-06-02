import { NextResponse } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { prisma } from "@/lib/prisma";
import { normalizeProviderCode } from "@/lib/account-payments/types";
import { saveAccountPaymentConnection } from "@/lib/account-payments/connections";

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

    return applyCrmAccessCookie(
      jsonOk({
        connection: {
          id: connection.id,
          provider: connection.provider,
          mode: connection.mode,
          title: connection.title,
          isEnabled: connection.isEnabled,
          isDefault: connection.isDefault,
          credentialsMasked: connection.credentialsMasked,
          receiptEnabled: connection.receiptEnabled,
          receiptVat: connection.receiptVat,
          receiptTaxationSystem: connection.receiptTaxationSystem,
          currency: connection.currency,
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

