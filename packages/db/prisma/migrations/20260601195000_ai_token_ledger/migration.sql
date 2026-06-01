ALTER TABLE "AiBalanceLedger"
ADD COLUMN "amountTokens" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AiAccessPurchase"
ADD COLUMN "creditTokens" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AiAccountAccess"
ADD COLUMN "dailyTokenLimit" INTEGER,
ADD COLUMN "monthlyTokenLimit" INTEGER,
ADD COLUMN "minTokensNotify" INTEGER,
ADD COLUMN "stopWhenTokensBelow" INTEGER;

UPDATE "AiAccessPurchase" p
SET "creditTokens" = COALESCE(pkg."displayTokens", 0)
FROM "AiAccessPackage" pkg
WHERE p."packageId" = pkg."id"
  AND p."creditTokens" = 0;

UPDATE "AiBalanceLedger" l
SET "amountTokens" = -COALESCE(u."totalTokens", 0)
FROM "AiUsage" u
WHERE l."usageId" = u."id"
  AND l."type" = 'usage'
  AND l."amountTokens" = 0;

WITH ranked_purchases AS (
  SELECT
    p."id",
    p."accountId",
    p."creditTokens",
    p."paidAt",
    p."createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY p."accountId"
      ORDER BY COALESCE(p."paidAt", p."createdAt") ASC, p."id" ASC
    ) AS rn
  FROM "AiAccessPurchase" p
  WHERE p."status" = 'PAID'
    AND p."creditTokens" > 0
),
ranked_ledgers AS (
  SELECT
    l."id",
    l."accountId",
    ROW_NUMBER() OVER (
      PARTITION BY l."accountId"
      ORDER BY l."createdAt" ASC, l."id" ASC
    ) AS rn
  FROM "AiBalanceLedger" l
  WHERE l."type" = 'purchase'
    AND l."amountTokens" = 0
)
UPDATE "AiBalanceLedger" l
SET "amountTokens" = rp."creditTokens"
FROM ranked_ledgers rl
JOIN ranked_purchases rp
  ON rp."accountId" = rl."accountId"
 AND rp.rn = rl.rn
WHERE l."id" = rl."id";
