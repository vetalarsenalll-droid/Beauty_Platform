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
  '0ec8f2c9985c78cc6bc179b028bc3f85a34233a33281aaed7df07b0efb724c96',
  'ea1eeb9af1e9e987fd41842f2f3cd6a4',
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
  'c83ba4cba8fe9686f7b9bd47b66b6e4565ed2cb85315000884a67f420681cc39',
  '3c48237a640f50c427da8a72145fc29a',
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
