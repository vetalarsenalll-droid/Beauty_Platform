CREATE TABLE "IdempotencyKey" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_accountId_key_key" ON "IdempotencyKey"("accountId", "key");
CREATE INDEX "IdempotencyKey_accountId_createdAt_idx" ON "IdempotencyKey"("accountId", "createdAt");

ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
