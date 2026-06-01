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

export type AiAccountTokenBalanceRow = {
  accountId: number;
  balanceTokens: number | null;
  purchasedTokens: number | null;
  usedTokens: number | null;
};

export type AiAccessPurchaseRow = {
  id: number;
  accountId: number;
  packageId: number | null;
  invoiceId: number | null;
  amountRub: Prisma.Decimal;
  creditRub: Prisma.Decimal;
  creditTokens: number;
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
  dailyTokenLimit: number | null;
  monthlyTokenLimit: number | null;
  minTokensNotify: number | null;
  stopWhenTokensBelow: number | null;
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

export function readOptionalNonNegativeInt(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
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

export async function getAiTokenBalancesByAccountIds(accountIds: number[]) {
  if (!accountIds.length) return new Map<number, { purchasedTokens: number; usedTokens: number; availableTokens: number }>();

  const rows = await prisma.$queryRaw<AiAccountTokenBalanceRow[]>`
    WITH first_credit AS (
      SELECT "accountId", MIN("createdAt") AS "startsAt"
      FROM "AiBalanceLedger"
      WHERE "accountId" IN (${Prisma.join(accountIds)})
        AND "amountTokens" > 0
      GROUP BY "accountId"
    ),
    ledger AS (
      SELECT
        l."accountId",
        COALESCE(SUM(
          CASE
            WHEN l."amountTokens" > 0 THEN l."amountTokens"
            WHEN l."amountTokens" < 0 AND fc."startsAt" IS NOT NULL AND l."createdAt" >= fc."startsAt" THEN l."amountTokens"
            ELSE 0
          END
        ), 0) AS "balanceTokens",
        COALESCE(SUM(CASE WHEN l."amountTokens" > 0 THEN l."amountTokens" ELSE 0 END), 0) AS "purchasedTokens",
        ABS(COALESCE(SUM(
          CASE
            WHEN l."amountTokens" < 0 AND fc."startsAt" IS NOT NULL AND l."createdAt" >= fc."startsAt" THEN l."amountTokens"
            ELSE 0
          END
        ), 0)) AS "usedTokens"
      FROM "AiBalanceLedger" l
      LEFT JOIN first_credit fc ON fc."accountId" = l."accountId"
      WHERE l."accountId" IN (${Prisma.join(accountIds)})
      GROUP BY l."accountId"
    ),
    paid_purchases AS (
      SELECT p."accountId", COALESCE(SUM(p."creditTokens"), 0) AS "purchasedTokens"
      FROM "AiAccessPurchase" p
      WHERE p."accountId" IN (${Prisma.join(accountIds)})
        AND p."status" = 'PAID'
      GROUP BY p."accountId"
    ),
    usage AS (
      SELECT u."accountId", COALESCE(SUM(COALESCE(u."totalTokens", 0)), 0) AS "usedTokens"
      FROM "AiUsage" u
      WHERE u."accountId" IN (${Prisma.join(accountIds)})
      GROUP BY u."accountId"
    )
    SELECT
      account_ids."accountId",
      COALESCE(ledger."balanceTokens", COALESCE(paid_purchases."purchasedTokens", 0) - COALESCE(usage."usedTokens", 0)) AS "balanceTokens",
      COALESCE(ledger."purchasedTokens", paid_purchases."purchasedTokens", 0) AS "purchasedTokens",
      COALESCE(ledger."usedTokens", usage."usedTokens", 0) AS "usedTokens"
    FROM (
      SELECT unnest(ARRAY[${Prisma.join(accountIds)}]::int[]) AS "accountId"
    ) account_ids
    LEFT JOIN ledger ON ledger."accountId" = account_ids."accountId"
    LEFT JOIN paid_purchases ON paid_purchases."accountId" = account_ids."accountId"
    LEFT JOIN usage ON usage."accountId" = account_ids."accountId"
  `;

  return new Map(
    rows.map((row) => {
      const purchasedTokens = Number(row.purchasedTokens ?? 0);
      const usedTokens = Number(row.usedTokens ?? 0);
      const balanceTokens = Number(row.balanceTokens ?? purchasedTokens - usedTokens);
      return [
        row.accountId,
        {
          purchasedTokens,
          usedTokens,
          availableTokens: Math.max(0, balanceTokens),
        },
      ];
    }),
  );
}

export async function getAiTokenBalance(accountId: number) {
  return (await getAiTokenBalancesByAccountIds([accountId])).get(accountId)?.availableTokens ?? 0;
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
      "stopWhenBalanceBelowRub",
      "dailyTokenLimit",
      "monthlyTokenLimit",
      "minTokensNotify",
      "stopWhenTokensBelow"
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
  dailyTokenLimit: number | null;
  monthlyTokenLimit: number | null;
  minTokensNotify: number | null;
  stopWhenTokensBelow: number | null;
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
      "dailyTokenLimit",
      "monthlyTokenLimit",
      "minTokensNotify",
      "stopWhenTokensBelow",
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
      ${input.dailyTokenLimit},
      ${input.monthlyTokenLimit},
      ${input.minTokensNotify},
      ${input.stopWhenTokensBelow},
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
      "dailyTokenLimit" = EXCLUDED."dailyTokenLimit",
      "monthlyTokenLimit" = EXCLUDED."monthlyTokenLimit",
      "minTokensNotify" = EXCLUDED."minTokensNotify",
      "stopWhenTokensBelow" = EXCLUDED."stopWhenTokensBelow",
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

async function sumAiUsageTokens(accountId: number, since: Date) {
  const result = await prisma.aiUsage.aggregate({
    where: { accountId, createdAt: { gte: since } },
    _sum: { totalTokens: true },
  });
  return Number(result._sum.totalTokens ?? 0);
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
      dailyTokenLimit: number | null;
      monthlyTokenLimit: number | null;
      minTokensNotify: number | null;
      stopWhenTokensBelow: number | null;
    }>
  >`
    SELECT
      "aiEnabled",
      "siteAssistantEnabled",
      "crmAgentEnabled",
      "dailySpendLimitRub",
      "monthlySpendLimitRub",
      "minBalanceNotifyRub",
      "stopWhenBalanceBelowRub",
      "dailyTokenLimit",
      "monthlyTokenLimit",
      "minTokensNotify",
      "stopWhenTokensBelow"
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

  const tokenBalance = await getAiTokenBalance(accountId);
  const enforceBalance =
    (await getGlobalAiBooleanSetting("ai.balanceEnforcement", process.env.AI_BALANCE_ENFORCEMENT === "true")) ||
    Boolean(access);
  const stopBelow = Number(access?.stopWhenTokensBelow ?? 0);
  if (enforceBalance && tokenBalance <= Math.max(0, stopBelow)) {
    return block("ai_tokens_empty", { balanceTokens: tokenBalance, stopWhenTokensBelow: stopBelow });
  }

  if (access?.dailyTokenLimit != null) {
    const dailyLimit = Number(access.dailyTokenLimit);
    if (dailyLimit > 0) {
      const spentToday = await sumAiUsageTokens(accountId, startOfDay());
      if (spentToday >= dailyLimit) {
        return block("daily_token_limit_exceeded", { spentTokens: spentToday, limitTokens: dailyLimit });
      }
    }
  }

  if (access?.monthlyTokenLimit != null) {
    const monthlyLimit = Number(access.monthlyTokenLimit);
    if (monthlyLimit > 0) {
      const spentMonth = await sumAiUsageTokens(accountId, startOfMonth());
      if (spentMonth >= monthlyLimit) {
        return block("monthly_token_limit_exceeded", { spentTokens: spentMonth, limitTokens: monthlyLimit });
      }
    }
  }

  const notifyBelow = Number(access?.minTokensNotify ?? 0);
  let warning: string | null = null;
  if (notifyBelow > 0 && tokenBalance <= notifyBelow) {
    warning = "low_tokens";
    if (shouldLog) {
      await writeAiGuardLog({
        actionId: options.actionId,
        level: "WARN",
        reason: warning,
        accountId,
        scope,
        data: { balanceTokens: tokenBalance, minTokensNotify: notifyBelow },
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

export async function deleteUnusedAiAccessPackage(id: number) {
  const deleted = await prisma.$executeRaw`
    DELETE FROM "AiAccessPackage" pkg
    WHERE pkg."id" = ${id}
      AND NOT EXISTS (
        SELECT 1
        FROM "AiAccessPurchase" purchase
        WHERE purchase."packageId" = pkg."id"
      )
  `;
  return deleted > 0;
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
  creditTokens: number;
  comment: string;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "AiAccessPurchase"
        ("accountId", "packageId", "amountRub", "creditRub", "creditTokens", "status", "paidAt")
      VALUES
        (${input.accountId}, ${input.packageId}, ${input.amountRub}, ${input.creditRub}, ${input.creditTokens}, 'PAID', NOW())
    `;
    await tx.aiBalanceLedger.create({
      data: {
        accountId: input.accountId,
        type: input.packageId ? "purchase" : "manual_credit",
        amountRub: input.creditRub.toFixed(6),
        amountTokens: input.creditTokens,
        comment: input.comment,
      },
    });
  });
}

export async function addAiLedgerAdjustment(input: {
  accountId: number;
  amountRub: number;
  amountTokens: number;
  type: "manual_credit" | "manual_debit" | "bonus";
  comment: string | null;
}) {
  await ensureAiAccountAccess(input.accountId);
  await prisma.aiBalanceLedger.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amountRub: input.amountRub.toFixed(6),
      amountTokens: input.amountTokens,
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
  const tokensPart = pack.displayTokens ? `, ${int(pack.displayTokens)} токенов` : "";
  const packageSaleText = (pack.description?.trim() || `${pack.name}${tokensPart}`).slice(0, 128);

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
        purpose: "AI_TOKENS",
        amount: pack.priceRub,
        currency: "RUB",
        description: packageSaleText,
        issuedAt: new Date(),
        items: {
          create: {
            name: packageSaleText,
            quantity: 1,
            unitPrice: pack.priceRub,
            amount: pack.priceRub,
            vat: "none",
            paymentObject: "service",
            paymentMethod: "full_payment",
            metadataJson: {
              packageId: pack.id,
              displayTokens: pack.displayTokens,
            },
          },
        },
      },
      select: { id: true },
    });
    await tx.$executeRaw`
      INSERT INTO "AiAccessPurchase"
        ("accountId", "packageId", "invoiceId", "amountRub", "creditRub", "creditTokens", "status")
      VALUES
        (${accountId}, ${packageId}, ${invoice.id}, ${pack.priceRub}, ${pack.includedCreditRub}, ${pack.displayTokens ?? 0}, 'PENDING')
    `;
    return invoice.id;
  });
}
