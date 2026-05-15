ALTER TABLE "AccountSetting"
  ADD COLUMN "reviewModerationWords" JSONB,
  ADD COLUMN "reviewModerationMode" TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN "reviewModerationMinRating" INTEGER;

ALTER TABLE "Review"
  ADD COLUMN "moderationReason" TEXT,
  ADD COLUMN "moderationMatchedWords" JSONB,
  ADD COLUMN "moderatedAt" TIMESTAMP(3),
  ADD COLUMN "moderatedByUserId" INTEGER;
