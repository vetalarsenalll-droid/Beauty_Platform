-- Public booking lookup indexes.
CREATE INDEX IF NOT EXISTS "SpecialistService_serviceId_specialistId_idx" ON "SpecialistService"("serviceId", "specialistId");
CREATE INDEX IF NOT EXISTS "ServiceLocation_locationId_serviceId_idx" ON "ServiceLocation"("locationId", "serviceId");
CREATE INDEX IF NOT EXISTS "SpecialistLocation_locationId_specialistId_idx" ON "SpecialistLocation"("locationId", "specialistId");
CREATE INDEX IF NOT EXISTS "AppointmentHold_accountId_specialistId_startAt_idx" ON "AppointmentHold"("accountId", "specialistId", "startAt");
CREATE INDEX IF NOT EXISTS "AppointmentHold_accountId_expiresAt_startAt_idx" ON "AppointmentHold"("accountId", "expiresAt", "startAt");
CREATE INDEX IF NOT EXISTS "ScheduleEntry_accountId_locationId_date_idx" ON "ScheduleEntry"("accountId", "locationId", "date");
CREATE INDEX IF NOT EXISTS "ScheduleEntry_accountId_specialistId_date_idx" ON "ScheduleEntry"("accountId", "specialistId", "date");
CREATE INDEX IF NOT EXISTS "BlockedSlot_accountId_locationId_startAt_idx" ON "BlockedSlot"("accountId", "locationId", "startAt");
CREATE INDEX IF NOT EXISTS "BlockedSlot_accountId_specialistId_startAt_idx" ON "BlockedSlot"("accountId", "specialistId", "startAt");
