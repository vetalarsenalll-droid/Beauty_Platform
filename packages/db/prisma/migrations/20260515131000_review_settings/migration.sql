ALTER TABLE "AccountSetting"
  ADD COLUMN "reviewAutoPublish" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reviewAllowReplies" BOOLEAN NOT NULL DEFAULT true;
