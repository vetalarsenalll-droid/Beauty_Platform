-- CreateTable
CREATE TABLE "LocationManager" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationManager_accountId_idx" ON "LocationManager"("accountId");

-- CreateIndex
CREATE INDEX "LocationManager_userId_idx" ON "LocationManager"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationManager_locationId_userId_key" ON "LocationManager"("locationId", "userId");

-- AddForeignKey
ALTER TABLE "LocationManager" ADD CONSTRAINT "LocationManager_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationManager" ADD CONSTRAINT "LocationManager_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationManager" ADD CONSTRAINT "LocationManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
