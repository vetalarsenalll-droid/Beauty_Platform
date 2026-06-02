CREATE TYPE "BookingOnlinePaymentMode" AS ENUM ('DISABLED', 'PREPAYMENT_FIXED', 'PREPAYMENT_PERCENT', 'FULL_PAYMENT');

ALTER TABLE "AccountSetting"
  ADD COLUMN "bookingOnlinePaymentMode" "BookingOnlinePaymentMode" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN "bookingPrepaymentAmount" DECIMAL(12, 2),
  ADD COLUMN "bookingPrepaymentPercent" DECIMAL(5, 2),
  ADD COLUMN "bookingFullPaymentDiscountPercent" DECIMAL(5, 2);

UPDATE "AccountSetting"
SET
  "bookingOnlinePaymentMode" = CASE
    WHEN "requirePaymentToConfirm" = true THEN 'FULL_PAYMENT'::"BookingOnlinePaymentMode"
    WHEN "requireDeposit" = true THEN 'PREPAYMENT_PERCENT'::"BookingOnlinePaymentMode"
    ELSE "bookingOnlinePaymentMode"
  END,
  "bookingPrepaymentPercent" = CASE
    WHEN "requireDeposit" = true AND "bookingPrepaymentPercent" IS NULL THEN 10
    ELSE "bookingPrepaymentPercent"
  END;

ALTER TABLE "PaymentIntent"
  ADD COLUMN "metadata" JSONB;
