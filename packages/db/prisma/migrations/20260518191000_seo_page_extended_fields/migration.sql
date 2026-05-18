ALTER TABLE "SeoPageSetting"
  ADD COLUMN "keywords" TEXT,
  ADD COLUMN "canonicalUrl" TEXT,
  ADD COLUMN "noFollow" BOOLEAN NOT NULL DEFAULT false;
