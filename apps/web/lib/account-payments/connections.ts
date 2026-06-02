import type {
  AccountPaymentConnection,
  AccountPaymentProvider,
  PaymentConnectionMode,
  ReceiptTaxationSystem,
  ReceiptVatCode,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  decryptAccountPaymentCredentials,
  encryptAccountPaymentCredentials,
  maskAccountPaymentCredentials,
  normalizeAccountPaymentCredentials,
} from "./credentials";
import type { AccountPaymentConnectionSnapshot, AccountPaymentProviderCode } from "./types";
import { providerFromDb, providerToDb } from "./types";

export type AccountPaymentConnectionInput = {
  accountId: number;
  provider: AccountPaymentProviderCode;
  mode?: PaymentConnectionMode;
  title?: string | null;
  isEnabled?: boolean;
  isDefault?: boolean;
  credentials: unknown;
  publicConfig?: unknown;
  receiptEnabled?: boolean;
  receiptVat?: ReceiptVatCode;
  receiptTaxationSystem?: ReceiptTaxationSystem;
  receiptFfdVersion?: string | null;
  paymentSubject?: string | null;
  paymentMethod?: string | null;
  currency?: string;
};

export function toConnectionSnapshot(
  connection: Pick<
    AccountPaymentConnection,
    | "id"
    | "accountId"
    | "provider"
    | "mode"
    | "title"
    | "currency"
    | "receiptEnabled"
    | "receiptVat"
    | "receiptTaxationSystem"
    | "receiptFfdVersion"
    | "paymentSubject"
    | "paymentMethod"
    | "publicConfig"
  >,
): AccountPaymentConnectionSnapshot {
  return {
    id: connection.id,
    accountId: connection.accountId,
    provider: providerFromDb(connection.provider),
    mode: connection.mode,
    title: connection.title,
    currency: connection.currency,
    receiptEnabled: connection.receiptEnabled,
    receiptVat: connection.receiptVat,
    receiptTaxationSystem: connection.receiptTaxationSystem,
    receiptFfdVersion: connection.receiptFfdVersion,
    paymentSubject: connection.paymentSubject,
    paymentMethod: connection.paymentMethod,
    publicConfig: connection.publicConfig,
  };
}

export async function saveAccountPaymentConnection(input: AccountPaymentConnectionInput) {
  const credentials = normalizeAccountPaymentCredentials(input.provider, input.credentials);
  const provider = providerToDb(input.provider);

  return prisma.$transaction(async (tx) => {
    if (input.isDefault || input.isEnabled) {
      await tx.accountPaymentConnection.updateMany({
        where: { accountId: input.accountId },
        data: { isDefault: false },
      });
    }

    const existing = await tx.accountPaymentConnection.findFirst({
      where: { accountId: input.accountId, provider },
      orderBy: { id: "asc" },
    });

    return existing
      ? tx.accountPaymentConnection.update({
          where: { id: existing.id },
          data: {
            mode: input.mode ?? existing.mode,
            title: input.title ?? existing.title,
            isEnabled: input.isEnabled ?? existing.isEnabled,
            isDefault: input.isDefault ?? existing.isDefault,
            credentialsEncrypted: encryptAccountPaymentCredentials(credentials),
            credentialsMasked: maskAccountPaymentCredentials(credentials) as Prisma.InputJsonValue,
            publicConfig: jsonOrNull(input.publicConfig ?? existing.publicConfig),
            receiptEnabled: input.receiptEnabled ?? existing.receiptEnabled,
            receiptVat: input.receiptVat ?? existing.receiptVat,
            receiptTaxationSystem: input.receiptTaxationSystem ?? existing.receiptTaxationSystem,
            receiptFfdVersion: input.receiptFfdVersion ?? existing.receiptFfdVersion,
            paymentSubject: input.paymentSubject ?? existing.paymentSubject,
            paymentMethod: input.paymentMethod ?? existing.paymentMethod,
            currency: input.currency ?? existing.currency,
          },
        })
      : tx.accountPaymentConnection.create({
          data: {
            accountId: input.accountId,
            provider,
            mode: input.mode ?? "TEST",
            title: input.title ?? null,
            isEnabled: input.isEnabled ?? false,
            isDefault: input.isDefault ?? true,
            credentialsEncrypted: encryptAccountPaymentCredentials(credentials),
            credentialsMasked: maskAccountPaymentCredentials(credentials) as Prisma.InputJsonValue,
            publicConfig: jsonOrUndefined(input.publicConfig),
            receiptEnabled: input.receiptEnabled ?? false,
            receiptVat: input.receiptVat ?? "NONE",
            receiptTaxationSystem: input.receiptTaxationSystem ?? "DEFAULT",
            receiptFfdVersion: input.receiptFfdVersion ?? null,
            paymentSubject: input.paymentSubject ?? "service",
            paymentMethod: input.paymentMethod ?? "full_payment",
            currency: input.currency ?? "RUB",
          },
        });
  });
}

export async function getDefaultAccountPaymentConnection(accountId: number) {
  const connection =
    (await prisma.accountPaymentConnection.findFirst({
      where: { accountId, isEnabled: true, isDefault: true },
      orderBy: { id: "asc" },
    })) ??
    (await prisma.accountPaymentConnection.findFirst({
      where: { accountId, isEnabled: true },
      orderBy: { id: "asc" },
    }));

  if (!connection) return null;
  return {
    connection,
    snapshot: toConnectionSnapshot(connection),
    credentials: decryptAccountPaymentCredentials(connection.credentialsEncrypted),
  };
}

export function providerDbToCode(provider: AccountPaymentProvider) {
  return providerFromDb(provider);
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function jsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}
