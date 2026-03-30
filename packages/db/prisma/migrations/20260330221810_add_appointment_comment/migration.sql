-- DropForeignKey
ALTER TABLE "OnlineBookingStep" DROP CONSTRAINT "OnlineBookingStep_sessionId_fkey";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "comment" TEXT;

-- AddForeignKey
ALTER TABLE "OnlineBookingStep" ADD CONSTRAINT "OnlineBookingStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnlineBookingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
