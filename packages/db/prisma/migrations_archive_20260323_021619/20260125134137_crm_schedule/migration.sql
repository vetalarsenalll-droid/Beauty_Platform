-- CreateEnum
CREATE TYPE "ScheduleEntryType" AS ENUM ('WORKING', 'SICK', 'VACATION', 'UNPAID_OFF', 'NO_SHOW', 'PAID_OFF', 'CUSTOM');

-- CreateTable
CREATE TABLE "ScheduleNonWorkingType" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleNonWorkingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "locationId" INTEGER,
    "specialistId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ScheduleEntryType" NOT NULL,
    "customTypeId" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEntryBreak" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "ScheduleEntryBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleNonWorkingType_accountId_isArchived_idx" ON "ScheduleNonWorkingType"("accountId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleNonWorkingType_accountId_name_key" ON "ScheduleNonWorkingType"("accountId", "name");

-- CreateIndex
CREATE INDEX "ScheduleEntry_accountId_date_idx" ON "ScheduleEntry"("accountId", "date");

-- CreateIndex
CREATE INDEX "ScheduleEntry_locationId_date_idx" ON "ScheduleEntry"("locationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_specialistId_date_key" ON "ScheduleEntry"("specialistId", "date");

-- CreateIndex
CREATE INDEX "ScheduleEntryBreak_entryId_idx" ON "ScheduleEntryBreak"("entryId");

-- AddForeignKey
ALTER TABLE "ScheduleNonWorkingType" ADD CONSTRAINT "ScheduleNonWorkingType_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "SpecialistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_customTypeId_fkey" FOREIGN KEY ("customTypeId") REFERENCES "ScheduleNonWorkingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntryBreak" ADD CONSTRAINT "ScheduleEntryBreak_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ScheduleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
