import { Prisma } from "@prisma/client";
import { getGlobalAiBooleanSetting } from "@/lib/ai-settings";
import { prisma } from "@/lib/prisma";

export type AiAccessPackageRow = {
  id: number;
  code: string;
  name: string;
  includedCreditRub: Prisma.Decimal;
  displayTokens: number | null;
  priceRub: Prisma.Decimal;
  isActive: boolean;
  archivedAt: Date | null;
  sortOrder: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AiAccountBalanceRow = {
  accountId: number;
  balanceRub: Prisma.Decimal | null;
};

export type AiAccessPurchaseRow = {
  id: number;
  accountId: number;
  packageId: number | null;
  invoiceId: number | null;
  amountRub: Prisma.Decimal;
  creditRub: Prisma.Decimal;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
};

export type AiAccessPurchaseWithInvoiceRow = AiAccessPurchaseRow & {
  invoiceStatus: string | null;
  invoicePaidAt: Date | null;
};

export type AiProviderPoolRow = {
  id: number;
  provider: string;
  model: string;
  packageTokens: number;
  packageCostRub: Prisma.Decimal;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AiAccountAccessRow = {
  accountId: number;
  aiEnabled: boolean;
  siteAssistantEnabled: boolean;
  crmAgentEnabled: boolean;
  dailySpendLimitRub: Prisma.Decimal | null;
  monthlySpendLimitRub: Prisma.Decimal | null;
  minBalanceNotifyRub: Prisma.Decimal | null;
  stopWhenBalanceBelowRub: Prisma.Decimal | null;
};

export function money(value: unknown, digits = 2) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

export function int(value: unknown) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("ru-RU").format(Number.isFinite(n) ? Math.round(n) : 0);
}

export function readPositiveNumber(value: FormDataEntryValue | null, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function readOptionalPositiveInt(value: FormDataEntryValue | null) {
  const n = Number(String(value ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function readOptionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function readText(value: FormDataEntryValue | null, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

export function readCheckbox(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

export async function getAiAccessPackages(activeOnly = false) {
  return prisma.$queryRaw<AiAccessPackageRow[]>`
    SELECT *
    FROM "AiAccessPackage"
    WHERE "archivedAt" IS NULL
      AND (${activeOnly} = false OR "isActive" = true)
    ORDER BY "sortOrder" ASC, "id" ASC
  `;
}

export async function getArchivedAiAccessPackages() {
  return prisma.$queryRaw<AiAccessPackageRow[]>`
    SELECT *
    FROM "AiAccessPackage"
    WHERE "archivedAt" IS NOT NULL
    ORDER BY "archivedAt" DESC, "id" DESC
  `;
}

export async function getAiProviderPools() {
  return prisma.$queryRaw<AiProviderPoolRow[]>`
    SELECT *
    FROM "AiProviderPool"
    ORDER BY "isActive" DESC, "createdAt" DESC
  `;
}

export async function getAiBalanceByAccountIds(accountIds: number[]) {
  if (!accountIds.length) return new Map<number, number>();
  const rows = await prisma.$queryRaw<AiAccountBalanceRow[]>`
    SELECT "accountId", COALESCE(SUM("amountRub"), 0) AS "balanceRub"
    FROM "AiBalanceLedger"
    WHERE "accountId" IN (${Prisma.join(accountIds)})
    GROUP BY "accountId"
  `;
  return new Map(rows.map((row) => [row.accountId, Number(row.balanceRub ?? 0)]));
}

export async function getAiAccountBalance(accountId: number) {
  const rows = await prisma.$queryRaw<Array<{ balanceRub: Prisma.Decimal | null }>>`
    SELECT COALESCE(SUM("amountRub"), 0) AS "balanceRub"
    FROM "AiBalanceLedger"
    WHERE "accountId" = ${accountId}
  `;
  return Number(rows[0]?.balanceRub ?? 0);
}

export async function getAiAccountAccessByAccountIds(accountIds: number[]) {
  if (!accountIds.length) return new Map<number, AiAccountAccessRow>();
  const rows = await prisma.$queryRaw<AiAccountAccessRow[]>`
    SELECT
      "accountId",
      "aiEnabled",
      "siteAssistantEnabled",
      "crmAgentEnabled",
      "dailySpendLimitRub",
      "monthlySpendLimitRub",
      "minBalanceNotifyRub",
      "stopWhenBalanceBelowRub"
    FROM "AiAccountAccess"
    WHERE "accountId" IN (${Prisma.join(accountIds)})
  `;
  return new Map(rows.map((row) => [row.accountId, row]));
}

export async function ensureAiAccountAccess(accountId: number) {
  await prisma.$executeRaw`
    INSERT INTO "AiAccountAccess" ("accountId", "updatedAt")
    VALUES (${accountId}, NOW())
    ON CONFLICT ("accountId") DO NOTHING
  `;
}

export async function updateAiAccountAccess(input: {
  accountId: number;
  aiEnabled: boolean;
  siteAssistantEnabled: boolean;
  crmAgentEnabled: boolean;
  dailySpendLimitRub: number | null;
  monthlySpendLimitRub: number | null;
  minBalanceNotifyRub: number | null;
  stopWhenBalanceBelowRub: number | null;
}) {
  await prisma.$executeRaw`
    INSERT INTO "AiAccountAccess" (
      "accountId",
      "aiEnabled",
      "siteAssistantEnabled",
      "crmAgentEnabled",
      "dailySpendLimitRub",
      "monthlySpendLimitRub",
      "minBalanceNotifyRub",
      "stopWhenBalanceBelowRub",
      "updatedAt"
    )
    VALUES (
      ${input.accountId},
      ${input.aiEnabled},
      ${input.siteAssistantEnabled},
      ${input.crmAgentEnabled},
      ${input.dailySpendLimitRub},
      ${input.monthlySpendLimitRub},
      ${input.minBalanceNotifyRub},
      ${input.stopWhenBalanceBelowRub},
      NOW()
    )
    ON CONFLICT ("accountId") DO UPDATE SET
      "aiEnabled" = EXCLUDED."aiEnabled",
      "siteAssistantEnabled" = EXCLUDED."siteAssistantEnabled",
      "crmAgentEnabled" = EXCLUDED."crmAgentEnabled",
      "dailySpendLimitRub" = EXCLUDED."dailySpendLimitRub",
      "monthlySpendLimitRub" = EXCLUDED."monthlySpendLimitRub",
      "minBalanceNotifyRub" = EXCLUDED."minBalanceNotifyRub",
      "stopWhenBalanceBelowRub" = EXCLUDED."stopWhenBalanceBelowRub",
      "updatedAt" = NOW()
  `;
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(value = new Date()) {
  const date = new Date(value);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function sumAiSpendRub(accountId: number, since: Date) {
  const result = await prisma.aiUsage.aggregate({
    where: { accountId, createdAt: { gte: since } },
    _sum: { chargedRub: true },
  });
  return Number(result._sum.chargedRub ?? 0);
}

async function writeAiGuardLog(input: {
  actionId?: number | null;
  level: "WARN" | "ERROR";
  reason: string;
  accountId: number;
  scope: "public_site" | "crm_agent";
  data?: Record<string, unknown>;
}) {
  try {
    await prisma.aiLog.create({
      data: {
        actionId: input.actionId ?? null,
        level: input.level,
        message: `AI guard ${input.level === "ERROR" ? "blocked" : "warning"}: ${input.reason}`,
        data: {
          accountId: input.accountId,
          scope: input.scope,
          reason: input.reason,
          ...(input.data ?? {}),
        },
      },
    });
  } catch (error) {
    console.error("[ai-guard] failed to write AiLog", error);
  }
}

export async function checkAiAccessAllowed(
  accountId: number,
  scope: "public_site" | "crm_agent",
  options: { actionId?: number | null; log?: boolean } = {},
) {
  const shouldLog = options.log ?? true;
  const block = async (reason: string, data?: Record<string, unknown>) => {
    if (shouldLog) {
      await writeAiGuardLog({
        actionId: options.actionId,
        level: "ERROR",
        reason,
        accountId,
        scope,
        data,
      });
    }
    return { allowed: false, reason, warning: null as string | null };
  };

  const accessRows = await prisma.$queryRaw<
    Array<{
      aiEnabled: boolean;
      siteAssistantEnabled: boolean;
      crmAgentEnabled: boolean;
      dailySpendLimitRub: Prisma.Decimal | null;
      monthlySpendLimitRub: Prisma.Decimal | null;
      minBalanceNotifyRub: Prisma.Decimal | null;
      stopWhenBalanceBelowRub: Prisma.Decimal | null;
    }>
  >`
    SELECT
      "aiEnabled",
      "siteAssistantEnabled",
      "crmAgentEnabled",
      "dailySpendLimitRub",
      "monthlySpendLimitRub",
      "minBalanceNotifyRub",
      "stopWhenBalanceBelowRub"
    FROM "AiAccountAccess"
    WHERE "accountId" = ${accountId}
    LIMIT 1
  `;
  const access = accessRows[0] ?? null;
  if (access && !access.aiEnabled) return block("ai_disabled");
  if (access && scope === "public_site" && !access.siteAssistantEnabled) {
    return block("site_assistant_disabled");
  }
  if (access && scope === "crm_agent" && !access.crmAgentEnabled) {
    return block("crm_agent_disabled");
  }

  const balance = await getAiAccountBalance(accountId);
  const enforceBalance =
    (await getGlobalAiBooleanSetting("ai.balanceEnforcement", process.env.AI_BALANCE_ENFORCEMENT === "true")) ||
    Boolean(access);
  const stopBelow = Number(access?.stopWhenBalanceBelowRub ?? 0);
  if (enforceBalance && balance <= Math.max(0, stopBelow)) {
    return block("ai_balance_empty", { balanceRub: balance, stopWhenBalanceBelowRub: stopBelow });
  }

  if (access?.dailySpendLimitRub != null) {
    const dailyLimit = Number(access.dailySpendLimitRub);
    if (dailyLimit > 0) {
      const spentToday = await sumAiSpendRub(accountId, startOfDay());
      if (spentToday >= dailyLimit) {
        return block("daily_limit_exceeded", { spentRub: spentToday, limitRub: dailyLimit });
      }
    }
  }

  if (access?.monthlySpendLimitRub != null) {
    const monthlyLimit = Number(access.monthlySpendLimitRub);
    if (monthlyLimit > 0) {
      const spentMonth = await sumAiSpendRub(accountId, startOfMonth());
      if (spentMonth >= monthlyLimit) {
        return block("monthly_limit_exceeded", { spentRub: spentMonth, limitRub: monthlyLimit });
      }
    }
  }

  const notifyBelow = Number(access?.minBalanceNotifyRub ?? 0);
  let warning: string | null = null;
  if (notifyBelow > 0 && balance <= notifyBelow) {
    warning = "low_balance";
    if (shouldLog) {
      await writeAiGuardLog({
        actionId: options.actionId,
        level: "WARN",
        reason: warning,
        accountId,
        scope,
        data: { balanceRub: balance, minBalanceNotifyRub: notifyBelow },
      });
    }
  }

  return { allowed: true, reason: null, warning };
}

export async function createAiAccessPackage(input: {
  code: string;
  name: string;
  includedCreditRub: number;
  displayTokens: number | null;
  priceRub: number;
  description: string | null;
}) {
  await prisma.$executeRaw`
    INSERT INTO "AiAccessPackage"
      ("code", "name", "includedCreditRub", "displayTokens", "priceRub", "description", "updatedAt")
    VALUES
      (${input.code}, ${input.name}, ${input.includedCreditRub}, ${input.displayTokens}, ${input.priceRub}, ${input.description}, NOW())
  `;
}

export async function updateAiAccessPackage(input: {
  id: number;
  name: string;
  priceRub: number;
  includedCreditRub: number;
  displayTokens: number | null;
  sortOrder: number;
  isActive: boolean;
  description: string | null;
}) {
  await prisma.$executeRaw`
    UPDATE "AiAccessPackage"
    SET
      "name" = ${input.name},
      "priceRub" = ${input.priceRub},
      "includedCreditRub" = ${input.includedCreditRub},
      "displayTokens" = ${input.displayTokens},
      "sortOrder" = ${input.sortOrder},
      "isActive" = ${input.isActive},
      "description" = ${input.description},
      "updatedAt" = NOW()
    WHERE "id" = ${input.id}
  `;
}

export async function archiveAiAccessPackage(id: number) {
  await prisma.$executeRaw`
    UPDATE "AiAccessPackage"
    SET "isActive" = false, "archivedAt" = NOW(), "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

export async function restoreAiAccessPackage(id: number) {
  await prisma.$executeRaw`
    UPDATE "AiAccessPackage"
    SET "archivedAt" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

export async function createAiProviderPool(input: {
  provider: string;
  model: string;
  packageTokens: number;
  packageCostRub: number;
  notes: string | null;
}) {
  await prisma.$executeRaw`
    INSERT INTO "AiProviderPool"
      ("provider", "model", "packageTokens", "packageCostRub", "notes", "updatedAt")
    VALUES
      (${input.provider}, ${input.model}, ${input.packageTokens}, ${input.packageCostRub}, ${input.notes}, NOW())
  `;
}

export async function creditAiBalance(input: {
  accountId: number;
  packageId: number | null;
  amountRub: number;
  creditRub: number;
  comment: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "AiAccessPurchase"
        ("accountId", "packageId", "amountRub", "creditRub", "status", "paidAt")
      VALUES
        (${input.accountId}, ${input.packageId}, ${input.amountRub}, ${input.creditRub}, 'PAID', NOW())
    `;
    await tx.aiBalanceLedger.create({
      data: {
        accountId: input.accountId,
        type: input.packageId ? "purchase" : "manual_credit",
        amountRub: input.creditRub.toFixed(6),
        comment: input.comment,
      },
    });
  });
}

export async function addAiLedgerAdjustment(input: {
  accountId: number;
  amountRub: number;
  type: "manual_credit" | "manual_debit" | "bonus";
  comment: string | null;
}) {
  await ensureAiAccountAccess(input.accountId);
  await prisma.aiBalanceLedger.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amountRub: input.amountRub.toFixed(6),
      comment: input.comment,
    },
  });
}

export async function requestAiPackageInvoice(accountId: number, packageId: number) {
  const packages = await prisma.$queryRaw<AiAccessPackageRow[]>`
    SELECT *
    FROM "AiAccessPackage"
    WHERE "id" = ${packageId} AND "isActive" = true
    LIMIT 1
  `;
  const pack = packages[0] ?? null;
  if (!pack) return null;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRaw<Array<{ invoiceId: number | null }>>`
      SELECT p."invoiceId"
      FROM "AiAccessPurchase" p
      JOIN "PlatformInvoice" i ON i."id" = p."invoiceId"
      WHERE p."accountId" = ${accountId}
        AND p."packageId" = ${packageId}
        AND p."status" = 'PENDING'
        AND i."status" IN ('DRAFT', 'ISSUED')
      ORDER BY p."createdAt" DESC
      LIMIT 1
    `;
    if (existing[0]?.invoiceId) return existing[0].invoiceId;

    const invoice = await tx.platformInvoice.create({
      data: {
        accountId,
        status: "ISSUED",
        amount: pack.priceRub,
        currency: "RUB",
        issuedAt: new Date(),
      },
      select: { id: true },
    });
    await tx.$executeRaw`
      INSERT INTO "AiAccessPurchase"
        ("accountId", "packageId", "invoiceId", "amountRub", "creditRub", "status")
      VALUES
        (${accountId}, ${packageId}, ${invoice.id}, ${pack.priceRub}, ${pack.includedCreditRub}, 'PENDING')
    `;
    return invoice.id;
  });
}
