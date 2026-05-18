CREATE TABLE "SeoPageSetting" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "pageKey" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "ogImageUrl" TEXT,
  "noIndex" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeoPageSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoPageSetting_accountId_pageKey_key"
  ON "SeoPageSetting"("accountId", "pageKey");

CREATE INDEX "SeoPageSetting_accountId_idx"
  ON "SeoPageSetting"("accountId");

ALTER TABLE "SeoPageSetting"
  ADD CONSTRAINT "SeoPageSetting_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
