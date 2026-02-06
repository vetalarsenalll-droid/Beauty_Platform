CREATE TABLE "LegalDocument" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalDocumentVersion" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalAcceptance" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "documentVersionId" INTEGER NOT NULL,
    "appointmentId" INTEGER,
    "clientId" INTEGER,
    "source" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalDocument_accountId_key_key" ON "LegalDocument"("accountId", "key");
CREATE INDEX "LegalDocument_accountId_sortOrder_idx" ON "LegalDocument"("accountId", "sortOrder");

CREATE UNIQUE INDEX "LegalDocumentVersion_documentId_version_key" ON "LegalDocumentVersion"("documentId", "version");
CREATE INDEX "LegalDocumentVersion_documentId_isActive_idx" ON "LegalDocumentVersion"("documentId", "isActive");

CREATE INDEX "LegalAcceptance_accountId_acceptedAt_idx" ON "LegalAcceptance"("accountId", "acceptedAt");
CREATE INDEX "LegalAcceptance_appointmentId_idx" ON "LegalAcceptance"("appointmentId");

ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
