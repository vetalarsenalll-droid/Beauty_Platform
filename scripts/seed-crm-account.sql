BEGIN;

SET client_encoding = 'UTF8';

WITH account_row AS (
  INSERT INTO "Account" ("name", "slug", "status", "timeZone", "createdAt", "updatedAt")
  VALUES ('Beauty Studio Demo', 'demo', 'ACTIVE', 'Europe/Moscow', NOW(), NOW())
  ON CONFLICT ("slug") DO UPDATE
  SET "name" = EXCLUDED."name",
      "status" = EXCLUDED."status",
      "timeZone" = EXCLUDED."timeZone",
      "updatedAt" = EXCLUDED."updatedAt"
  RETURNING "id"
),
role_rows AS (
  INSERT INTO "Role" ("accountId", "name", "createdAt")
  SELECT account_row.id, role_name, NOW()
  FROM account_row
  CROSS JOIN (VALUES
    ('OWNER'::"RoleName"),
    ('MANAGER'::"RoleName"),
    ('SPECIALIST'::"RoleName"),
    ('READONLY'::"RoleName")
  ) AS roles(role_name)
  ON CONFLICT ("accountId", "name") DO NOTHING
  RETURNING "id", "name", "accountId"
),
owner_role AS (
  SELECT r.id, r."accountId"
  FROM "Role" r
  JOIN account_row a ON a.id = r."accountId"
  WHERE r."name" = 'OWNER'
  LIMIT 1
),
admin_user AS (
  SELECT id
  FROM "User"
  WHERE "email" = 'admin@beauty.local'
  LIMIT 1
),
crm_all_permission AS (
  SELECT id
  FROM "Permission"
  WHERE "key" = 'crm.all'
  LIMIT 1
)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT owner_role.id, crm_all_permission.id
FROM owner_role, crm_all_permission
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

WITH account_row AS (
  SELECT id
  FROM "Account"
  WHERE "slug" = 'demo'
  LIMIT 1
),
owner_role AS (
  SELECT r.id, r."accountId"
  FROM "Role" r
  JOIN account_row a ON a.id = r."accountId"
  WHERE r."name" = 'OWNER'
  LIMIT 1
),
admin_user AS (
  SELECT id
  FROM "User"
  WHERE "email" = 'admin@beauty.local'
  LIMIT 1
)
INSERT INTO "RoleAssignment" ("userId", "accountId", "roleId", "createdAt")
SELECT admin_user.id, owner_role."accountId", owner_role.id, NOW()
FROM admin_user, owner_role
ON CONFLICT ("userId", "accountId") DO NOTHING;

COMMIT;
