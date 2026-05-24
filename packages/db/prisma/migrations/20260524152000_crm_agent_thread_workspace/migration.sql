-- AlterTable
ALTER TABLE "AiThread"
ADD COLUMN "groupId" INTEGER,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "pinnedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AiThreadGroup" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "userId" INTEGER,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiThreadGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiThreadState" (
  "threadId" INTEGER NOT NULL,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiThreadState_pkey" PRIMARY KEY ("threadId")
);

-- CreateIndex
CREATE INDEX "AiThread_accountId_userId_deletedAt_updatedAt_idx" ON "AiThread"("accountId", "userId", "deletedAt", "updatedAt");
CREATE INDEX "AiThread_accountId_groupId_updatedAt_idx" ON "AiThread"("accountId", "groupId", "updatedAt");
CREATE INDEX "AiThread_accountId_pinnedAt_idx" ON "AiThread"("accountId", "pinnedAt");
CREATE INDEX "AiThreadGroup_accountId_userId_sortOrder_idx" ON "AiThreadGroup"("accountId", "userId", "sortOrder");

-- AddForeignKey
ALTER TABLE "AiThread" ADD CONSTRAINT "AiThread_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiThread" ADD CONSTRAINT "AiThread_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AiThreadGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiThreadGroup" ADD CONSTRAINT "AiThreadGroup_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiThreadGroup" ADD CONSTRAINT "AiThreadGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiThreadState" ADD CONSTRAINT "AiThreadState_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AiThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
