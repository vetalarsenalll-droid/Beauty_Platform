CREATE TABLE "PlatformLegalDocument" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformLegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformLegalDocumentVersion" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformLegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformLegalDocument_key_key" ON "PlatformLegalDocument"("key");
CREATE INDEX "PlatformLegalDocument_sortOrder_idx" ON "PlatformLegalDocument"("sortOrder");

CREATE UNIQUE INDEX "PlatformLegalDocumentVersion_documentId_version_key" ON "PlatformLegalDocumentVersion"("documentId", "version");
CREATE INDEX "PlatformLegalDocumentVersion_documentId_isActive_idx" ON "PlatformLegalDocumentVersion"("documentId", "isActive");

ALTER TABLE "PlatformLegalDocumentVersion" ADD CONSTRAINT "PlatformLegalDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PlatformLegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
