-- CreateEnum
CREATE TYPE "ServiceBookingType" AS ENUM ('SINGLE', 'GROUP');
CREATE TYPE "GroupSessionStatus" AS ENUM ('NEW', 'CONFIRMED', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "bookingType" "ServiceBookingType" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN     "groupCapacityDefault" INTEGER;

-- CreateTable
CREATE TABLE "GroupSession" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "specialistId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "GroupSessionStatus" NOT NULL DEFAULT 'NEW',
    "capacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "pricePerClient" DECIMAL(12,2),
    "source" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSessionParticipant" (
    "id" SERIAL NOT NULL,
    "groupSessionId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'NEW',
    "price" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupSession_accountId_startAt_idx" ON "GroupSession"("accountId", "startAt");
CREATE INDEX "GroupSession_specialistId_startAt_idx" ON "GroupSession"("specialistId", "startAt");
CREATE INDEX "GroupSession_locationId_startAt_idx" ON "GroupSession"("locationId", "startAt");
CREATE INDEX "GroupSession_status_idx" ON "GroupSession"("status");
CREATE UNIQUE INDEX "GroupSessionParticipant_groupSessionId_clientId_key" ON "GroupSessionParticipant"("groupSessionId", "clientId");
CREATE INDEX "GroupSessionParticipant_clientId_createdAt_idx" ON "GroupSessionParticipant"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "SpecialistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GroupSessionParticipant" ADD CONSTRAINT "GroupSessionParticipant_groupSessionId_fkey" FOREIGN KEY ("groupSessionId") REFERENCES "GroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupSessionParticipant" ADD CONSTRAINT "GroupSessionParticipant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
