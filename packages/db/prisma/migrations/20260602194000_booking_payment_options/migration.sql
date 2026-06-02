ALTER TABLE "AccountSetting"
  ADD COLUMN "bookingAllowPayLater" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "bookingAllowPrepaymentFixed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bookingAllowPrepaymentPercent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bookingAllowFullPayment" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AccountSetting"
SET
  "bookingAllowPrepaymentFixed" = CASE
    WHEN "bookingOnlinePaymentMode" = 'PREPAYMENT_FIXED' THEN true
    ELSE "bookingAllowPrepaymentFixed"
  END,
  "bookingAllowPrepaymentPercent" = CASE
    WHEN "bookingOnlinePaymentMode" = 'PREPAYMENT_PERCENT' THEN true
    ELSE "bookingAllowPrepaymentPercent"
  END,
  "bookingAllowFullPayment" = CASE
    WHEN "bookingOnlinePaymentMode" = 'FULL_PAYMENT' THEN true
    ELSE "bookingAllowFullPayment"
  END,
  "bookingAllowPayLater" = true;
