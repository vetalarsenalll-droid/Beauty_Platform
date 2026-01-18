BEGIN;

INSERT INTO "PlatformPermission" ("id", "key", "description", "createdAt")
VALUES
  ('perm_platform_all', 'platform.all', 'Полный доступ ко всем разделам платформы', NOW()),
  ('perm_platform_accounts', 'platform.accounts', 'Управление аккаунтами и лимитами', NOW()),
  ('perm_platform_plans', 'platform.plans', 'Тарифы и подписки', NOW()),
  ('perm_platform_moderation', 'platform.moderation', 'Модерация публичного контента', NOW()),
  ('perm_platform_monitoring', 'platform.monitoring', 'Мониторинг системы', NOW()),
  ('perm_platform_audit', 'platform.audit', 'Аудит действий администраторов', NOW()),
  ('perm_platform_settings', 'platform.settings', 'Глобальные настройки платформы', NOW())
ON CONFLICT ("id") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "User" ("id", "email", "status", "type", "createdAt", "updatedAt")
VALUES (
  'user_platform_admin_1',
  'admin@beauty.local',
  'ACTIVE',
  'STAFF',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "UserIdentity" (
  "id",
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
VALUES (
  'identity_platform_admin_1',
  'user_platform_admin_1',
  'EMAIL',
  'admin@beauty.local',
  'admin@beauty.local',
  '0ec8f2c9985c78cc6bc179b028bc3f85a34233a33281aaed7df07b0efb724c96',
  'ea1eeb9af1e9e987fd41842f2f3cd6a4',
  'scrypt',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PlatformAdmin" ("id", "userId", "status", "createdAt")
VALUES (
  'platform_admin_1',
  'user_platform_admin_1',
  'ACTIVE',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PlatformAdminPermissionAssignment" ("id", "adminId", "permissionId", "createdAt")
VALUES (
  'assign_platform_admin_all',
  'platform_admin_1',
  'perm_platform_all',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "User" ("id", "email", "status", "type", "createdAt", "updatedAt")
VALUES (
  'user_platform_moderator_1',
  'moderator@beauty.local',
  'ACTIVE',
  'STAFF',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "UserIdentity" (
  "id",
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
VALUES (
  'identity_platform_moderator_1',
  'user_platform_moderator_1',
  'EMAIL',
  'moderator@beauty.local',
  'moderator@beauty.local',
  'c83ba4cba8fe9686f7b9bd47b66b6e4565ed2cb85315000884a67f420681cc39',
  '3c48237a640f50c427da8a72145fc29a',
  'scrypt',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PlatformAdmin" ("id", "userId", "status", "createdAt")
VALUES (
  'platform_admin_moderator_1',
  'user_platform_moderator_1',
  'ACTIVE',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "PlatformAdminPermissionAssignment" ("id", "adminId", "permissionId", "createdAt")
VALUES (
  'assign_platform_moderator_moderation',
  'platform_admin_moderator_1',
  'perm_platform_moderation',
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
