ALTER TABLE "UserIdentity"
ADD COLUMN "passwordAlgo" TEXT,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "passwordSalt" TEXT,
ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "UserIdentity_provider_email_key"
ON "UserIdentity"("provider", "email");
