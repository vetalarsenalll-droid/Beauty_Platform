ALTER TABLE "PlatformPlan"
ADD COLUMN "billingPeriodMonths" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "gracePeriodDays" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "PlatformSubscription"
ADD COLUMN "graceEndsAt" TIMESTAMP(3),
ADD COLUMN "lastPaidAt" TIMESTAMP(3),
ADD COLUMN "remindedAt" TIMESTAMP(3);

ALTER TABLE "Account"
ADD COLUMN "suspendedByBillingAt" TIMESTAMP(3);

UPDATE "PlatformSubscription"
SET
  "endsAt" = COALESCE("endsAt", "nextBillingAt"),
  "graceEndsAt" = CASE
    WHEN COALESCE("endsAt", "nextBillingAt") IS NOT NULL
      THEN COALESCE("endsAt", "nextBillingAt") + INTERVAL '5 days'
    ELSE NULL
  END,
  "lastPaidAt" = COALESCE("lastPaidAt", "startedAt");
