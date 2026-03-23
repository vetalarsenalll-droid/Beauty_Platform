CREATE TABLE "OnlineBookingSession" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" INTEGER,
    "appointmentId" INTEGER,

    CONSTRAINT "OnlineBookingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineBookingStep" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "stepKey" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepTitle" TEXT,
    "scenario" TEXT,
    "locationId" INTEGER,
    "serviceId" INTEGER,
    "specialistId" INTEGER,
    "date" TEXT,
    "time" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlineBookingStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnlineBookingSession_accountId_sessionKey_key" ON "OnlineBookingSession"("accountId", "sessionKey");
CREATE INDEX "OnlineBookingSession_accountId_startedAt_idx" ON "OnlineBookingSession"("accountId", "startedAt");
CREATE INDEX "OnlineBookingSession_accountId_lastSeenAt_idx" ON "OnlineBookingSession"("accountId", "lastSeenAt");
CREATE INDEX "OnlineBookingSession_appointmentId_idx" ON "OnlineBookingSession"("appointmentId");

CREATE INDEX "OnlineBookingStep_accountId_createdAt_idx" ON "OnlineBookingStep"("accountId", "createdAt");
CREATE INDEX "OnlineBookingStep_sessionId_createdAt_idx" ON "OnlineBookingStep"("sessionId", "createdAt");
CREATE INDEX "OnlineBookingStep_accountId_stepKey_idx" ON "OnlineBookingStep"("accountId", "stepKey");

ALTER TABLE "OnlineBookingSession" ADD CONSTRAINT "OnlineBookingSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlineBookingSession" ADD CONSTRAINT "OnlineBookingSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnlineBookingSession" ADD CONSTRAINT "OnlineBookingSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnlineBookingStep" ADD CONSTRAINT "OnlineBookingStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnlineBookingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineBookingStep" ADD CONSTRAINT "OnlineBookingStep_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
