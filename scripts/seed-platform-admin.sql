BEGIN;

SET client_encoding = 'UTF8';

INSERT INTO "PlatformPermission" ("key", "description", "createdAt")
VALUES
  ('platform.all', 'Полный доступ ко всем разделам платформы', NOW()),
  ('platform.accounts', 'Управление аккаунтами и лимитами', NOW()),
  ('platform.plans', 'Тарифы и подписки', NOW()),
  ('platform.moderation', 'Модерация публичного контента', NOW()),
  ('platform.monitoring', 'Мониторинг системы', NOW()),
  ('platform.audit', 'Аудит действий администраторов', NOW()),
  ('platform.settings', 'Глобальные настройки платформы', NOW())
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "User" ("email", "status", "type", "createdAt", "updatedAt")
VALUES ('admin@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE
SET "status" = EXCLUDED."status", "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "UserIdentity" (
  "userId",
  "provider",
  "providerUserId",
  "email",
  "passwordHash",
  "passwordSalt",
  "passwordAlgo",
  "passwordUpdatedAt",
  "createdAt"
)
SELECT
  u.id,
  'EMAIL',
  'admin@beauty.local',
  'admin@beauty.local',
  '1d335ba7a07e4b97606dab40739b678f1c825dcd0be28c34b694be2b2496e903',
  'bf5c8aa7665bd93783fa0613ca9dcb3e',
  'scrypt',
  NOW(),
  NOW()
FROM "User" u
WHERE u.email = 'admin@beauty.local'
ON CONFLICT ("provider", "providerUserId") DO UPDATE
SET "passwordHash" = EXCLUDED."passwordHash",
    "passwordSalt" = EXCLUDED."passwordSalt",
    "passwordAlgo" = EXCLUDED."passwordAlgo",
    "passwordUpdatedAt" = EXCLUDED."passwordUpdatedAt";

INSERT INTO "PlatformAdmin" ("userId", "status", "createdAt")
SELECT u.id, 'ACTIVE', NOW()
FROM "User" u
WHERE u.email = 'admin@beauty.local'
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "PlatformAdminPermissionAssignment" ("adminId", "permissionId", "createdAt")
SELECT pa.id, pp.id, NOW()
FROM "PlatformAdmin" pa
JOIN "User" u ON u.id = pa."userId"
JOIN "PlatformPermission" pp ON pp."key" = 'platform.all'
WHERE u.email = 'admin@beauty.local'
ON CONFLICT ("adminId", "permissionId") DO NOTHING;

INSERT INTO "User" ("email", "status", "type", "createdAt", "updatedAt")
VALUES ('moderator@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE
SET "status" = EXCLUDED."status", "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "UserIdentity" (
  "userId",
  "provider",
  "providerUserId",
  "email",
  "passwordHash",
  "passwordSalt",
  "passwordAlgo",
  "passwordUpdatedAt",
  "createdAt"
)
SELECT
  u.id,
  'EMAIL',
  'moderator@beauty.local',
  'moderator@beauty.local',
  '1d335ba7a07e4b97606dab40739b678f1c825dcd0be28c34b694be2b2496e903',
  'bf5c8aa7665bd93783fa0613ca9dcb3e',
  'scrypt',
  NOW(),
  NOW()
FROM "User" u
WHERE u.email = 'moderator@beauty.local'
ON CONFLICT ("provider", "providerUserId") DO UPDATE
SET "passwordHash" = EXCLUDED."passwordHash",
    "passwordSalt" = EXCLUDED."passwordSalt",
    "passwordAlgo" = EXCLUDED."passwordAlgo",
    "passwordUpdatedAt" = EXCLUDED."passwordUpdatedAt";

INSERT INTO "PlatformAdmin" ("userId", "status", "createdAt")
SELECT u.id, 'ACTIVE', NOW()
FROM "User" u
WHERE u.email = 'moderator@beauty.local'
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "PlatformAdminPermissionAssignment" ("adminId", "permissionId", "createdAt")
SELECT pa.id, pp.id, NOW()
FROM "PlatformAdmin" pa
JOIN "User" u ON u.id = pa."userId"
JOIN "PlatformPermission" pp ON pp."key" = 'platform.moderation'
WHERE u.email = 'moderator@beauty.local'
ON CONFLICT ("adminId", "permissionId") DO NOTHING;

COMMIT;
