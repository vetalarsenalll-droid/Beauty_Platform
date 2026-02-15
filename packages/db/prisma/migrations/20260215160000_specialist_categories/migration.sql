CREATE TABLE "SpecialistCategory" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpecialistCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialistCategoryLink" (
  "id" SERIAL NOT NULL,
  "specialistId" INTEGER NOT NULL,
  "categoryId" INTEGER NOT NULL,
  CONSTRAINT "SpecialistCategoryLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpecialistCategoryLink_specialistId_categoryId_key"
ON "SpecialistCategoryLink"("specialistId", "categoryId");

ALTER TABLE "SpecialistCategory"
ADD CONSTRAINT "SpecialistCategory_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "Account"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SpecialistCategoryLink"
ADD CONSTRAINT "SpecialistCategoryLink_specialistId_fkey"
FOREIGN KEY ("specialistId") REFERENCES "SpecialistProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SpecialistCategoryLink"
ADD CONSTRAINT "SpecialistCategoryLink_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "SpecialistCategory"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
