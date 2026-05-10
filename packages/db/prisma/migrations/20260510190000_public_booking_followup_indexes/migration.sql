-- Follow-up indexes for public booking bootstrap and availability lookups.
CREATE INDEX IF NOT EXISTS "LocationException_locationId_date_idx" ON "LocationException"("locationId", "date");
CREATE INDEX IF NOT EXISTS "SpecialistProfile_accountId_createdAt_idx" ON "SpecialistProfile"("accountId", "createdAt");
CREATE INDEX IF NOT EXISTS "Service_accountId_isActive_name_idx" ON "Service"("accountId", "isActive", "name");
CREATE INDEX IF NOT EXISTS "Appointment_accountId_locationId_specialistId_startAt_idx" ON "Appointment"("accountId", "locationId", "specialistId", "startAt");
CREATE INDEX IF NOT EXISTS "GroupSession_accountId_locationId_serviceId_startAt_idx" ON "GroupSession"("accountId", "locationId", "serviceId", "startAt");
CREATE INDEX IF NOT EXISTS "GroupSession_accountId_locationId_specialistId_startAt_idx" ON "GroupSession"("accountId", "locationId", "specialistId", "startAt");
