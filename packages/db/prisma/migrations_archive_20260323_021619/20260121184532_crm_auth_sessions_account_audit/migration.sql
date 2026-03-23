-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('PLATFORM', 'CRM');

-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "accountId" INTEGER,
ADD COLUMN     "sessionType" "SessionType" NOT NULL DEFAULT 'PLATFORM';

-- CreateTable
CREATE TABLE "AccountAuditLog" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "diffJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountAuditLog_accountId_createdAt_idx" ON "AccountAuditLog"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountAuditLog_userId_createdAt_idx" ON "AccountAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSession_accountId_idx" ON "UserSession"("accountId");

-- AddForeignKey
ALTER TABLE "AccountAuditLog" ADD CONSTRAINT "AccountAuditLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAuditLog" ADD CONSTRAINT "AccountAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
