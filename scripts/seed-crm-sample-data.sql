BEGIN;

SET client_encoding = 'UTF8';

INSERT INTO "Account" ("name", "slug", "status", "timeZone", "createdAt", "updatedAt")
VALUES ('Beauty Salon', 'beauty-salon', 'ACTIVE', 'Europe/Moscow', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name",
    "status" = EXCLUDED."status",
    "timeZone" = EXCLUDED."timeZone",
    "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "Role" ("accountId", "name", "createdAt")
SELECT a.id, r.name, NOW()
FROM "Account" a
JOIN (VALUES
  ('MANAGER'::"RoleName"),
  ('SPECIALIST'::"RoleName")
) AS r(name) ON true
WHERE a.slug = 'beauty-salon'
ON CONFLICT ("accountId", "name") DO NOTHING;

INSERT INTO "Location" ("accountId", "name", "address", "phone", "status", "createdAt", "updatedAt")
SELECT a.id, v.name, v.address, v.phone, 'ACTIVE', NOW(), NOW()
FROM "Account" a
JOIN (VALUES
  ('Beauty Salon Center', 'Tverskaya 10', '+79990001010'),
  ('Beauty Salon Riverside', 'Kutuzovsky 22', '+79990002020')
) AS v(name, address, phone) ON true
WHERE a.slug = 'beauty-salon'
  AND NOT EXISTS (
    SELECT 1
    FROM "Location" l
    WHERE l."accountId" = a.id AND l."name" = v.name
  );

INSERT INTO "SpecialistLevel" ("accountId", "name", "rank", "createdAt")
SELECT a.id, v.name, v.rank, NOW()
FROM "Account" a
JOIN (VALUES
  ('Junior', 1),
  ('Middle', 2),
  ('Senior', 3)
) AS v(name, rank) ON true
WHERE a.slug = 'beauty-salon'
  AND NOT EXISTS (
    SELECT 1
    FROM "SpecialistLevel" s
    WHERE s."accountId" = a.id AND s."name" = v.name
  );

INSERT INTO "ServiceCategory" ("accountId", "name", "slug", "createdAt")
SELECT a.id, v.name, v.slug, NOW()
FROM "Account" a
JOIN (VALUES
  ('Hair', 'hair'),
  ('Nails', 'nails'),
  ('Skin', 'skin')
) AS v(name, slug) ON true
WHERE a.slug = 'beauty-salon'
  AND NOT EXISTS (
    SELECT 1
    FROM "ServiceCategory" c
    WHERE c."accountId" = a.id AND c."slug" = v.slug
  );

WITH account AS (
  SELECT id FROM "Account" WHERE slug = 'beauty-salon' LIMIT 1
),
data AS (
  SELECT *
  FROM (VALUES
    ('Women Haircut', 'hair', 'Women haircut', 60, 1800),
    ('Men Haircut', 'hair', 'Men haircut', 45, 1200),
    ('Hair Coloring', 'hair', 'Single color', 120, 3500),
    ('Balayage', 'hair', 'Balayage technique', 180, 5500),
    ('Manicure', 'nails', 'Classic manicure', 60, 1400),
    ('Pedicure', 'nails', 'Classic pedicure', 75, 1900),
    ('Gel Polish', 'nails', 'Gel polish coating', 90, 2200),
    ('Basic Facial', 'skin', 'Basic facial care', 60, 2500),
    ('Peeling', 'skin', 'Light peeling', 45, 2100),
    ('Hydra Facial', 'skin', 'Hydra facial', 75, 3800)
  ) AS v(name, category_slug, description, duration, price)
)
INSERT INTO "Service" (
  "accountId",
  "categoryId",
  "name",
  "description",
  "baseDurationMin",
  "basePrice",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT account.id,
       c.id,
       data.name,
       data.description,
       data.duration,
       data.price,
       true,
       NOW(),
       NOW()
FROM account
JOIN data ON true
LEFT JOIN "ServiceCategory" c
  ON c."accountId" = account.id AND c."slug" = data.category_slug
WHERE NOT EXISTS (
  SELECT 1
  FROM "Service" s
  WHERE s."accountId" = account.id AND s."name" = data.name
);

INSERT INTO "User" ("email", "status", "type", "createdAt", "updatedAt")
VALUES
  ('specialist1@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('specialist2@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('specialist3@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('specialist4@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('specialist5@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('specialist6@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('specialist7@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('specialist8@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('manager1@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW()),
  ('manager2@beauty.local', 'ACTIVE', 'STAFF', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE
SET "status" = EXCLUDED."status",
    "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "UserProfile" ("userId", "firstName", "lastName", "createdAt", "updatedAt")
SELECT u.id, v.first_name, v.last_name, NOW(), NOW()
FROM "User" u
JOIN (VALUES
  ('specialist1@beauty.local', 'Elena', 'Ivanova'),
  ('specialist2@beauty.local', 'Maria', 'Petrova'),
  ('specialist3@beauty.local', 'Olga', 'Smirnova'),
  ('specialist4@beauty.local', 'Anna', 'Volkova'),
  ('specialist5@beauty.local', 'Pavel', 'Sidorov'),
  ('specialist6@beauty.local', 'Sergey', 'Kuznetsov'),
  ('specialist7@beauty.local', 'Dmitry', 'Orlov'),
  ('specialist8@beauty.local', 'Irina', 'Belova'),
  ('manager1@beauty.local', 'Nikita', 'Manager'),
  ('manager2@beauty.local', 'Alina', 'Supervisor')
) AS v(email, first_name, last_name)
  ON v.email = u.email
ON CONFLICT ("userId") DO UPDATE
SET "firstName" = EXCLUDED."firstName",
    "lastName" = EXCLUDED."lastName",
    "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "SpecialistProfile" ("accountId", "userId", "levelId", "bio", "createdAt", "updatedAt")
SELECT a.id,
       u.id,
       lvl.id,
       v.bio,
       NOW(),
       NOW()
FROM "Account" a
JOIN (VALUES
  ('specialist1@beauty.local', 'Junior', 'Color specialist'),
  ('specialist2@beauty.local', 'Junior', 'Hair styling'),
  ('specialist3@beauty.local', 'Middle', 'Nail care'),
  ('specialist4@beauty.local', 'Senior', 'Top stylist'),
  ('specialist5@beauty.local', 'Junior', 'Skincare'),
  ('specialist6@beauty.local', 'Middle', 'Brow artist'),
  ('specialist7@beauty.local', 'Senior', 'Senior therapist'),
  ('specialist8@beauty.local', 'Middle', 'Massage specialist')
) AS v(email, level_name, bio) ON true
JOIN "User" u ON u.email = v.email
LEFT JOIN "SpecialistLevel" lvl
  ON lvl."accountId" = a.id AND lvl."name" = v.level_name
WHERE a.slug = 'beauty-salon'
ON CONFLICT ("accountId", "userId") DO UPDATE
SET "levelId" = EXCLUDED."levelId",
    "bio" = EXCLUDED."bio",
    "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "RoleAssignment" ("userId", "accountId", "roleId", "createdAt")
SELECT u.id, a.id, r.id, NOW()
FROM "User" u
JOIN "Account" a ON a.slug = 'beauty-salon'
JOIN "Role" r ON r."accountId" = a.id AND r."name" = 'SPECIALIST'
WHERE u.email IN (
  'specialist1@beauty.local',
  'specialist2@beauty.local',
  'specialist3@beauty.local',
  'specialist4@beauty.local',
  'specialist5@beauty.local',
  'specialist6@beauty.local',
  'specialist7@beauty.local',
  'specialist8@beauty.local'
)
ON CONFLICT ("userId", "accountId") DO UPDATE
SET "roleId" = EXCLUDED."roleId";

INSERT INTO "RoleAssignment" ("userId", "accountId", "roleId", "createdAt")
SELECT u.id, a.id, r.id, NOW()
FROM "User" u
JOIN "Account" a ON a.slug = 'beauty-salon'
JOIN "Role" r ON r."accountId" = a.id AND r."name" = 'MANAGER'
WHERE u.email IN ('manager1@beauty.local', 'manager2@beauty.local')
ON CONFLICT ("userId", "accountId") DO UPDATE
SET "roleId" = EXCLUDED."roleId";

INSERT INTO "SpecialistLocation" ("specialistId", "locationId")
SELECT sp.id, l.id
FROM "SpecialistProfile" sp
JOIN "User" u ON u.id = sp."userId"
JOIN "Account" a ON a.id = sp."accountId" AND a.slug = 'beauty-salon'
JOIN "Location" l ON l."accountId" = a.id
WHERE (u.email IN (
    'specialist1@beauty.local',
    'specialist2@beauty.local',
    'specialist3@beauty.local',
    'specialist4@beauty.local'
  ) AND l."name" = 'Beauty Salon Center')
   OR (u.email IN (
    'specialist5@beauty.local',
    'specialist6@beauty.local',
    'specialist7@beauty.local',
    'specialist8@beauty.local'
  ) AND l."name" = 'Beauty Salon Riverside')
ON CONFLICT ("specialistId", "locationId") DO NOTHING;

INSERT INTO "LocationManager" ("accountId", "locationId", "userId", "createdAt")
SELECT a.id, l.id, u.id, NOW()
FROM "Account" a
JOIN "Location" l ON l."accountId" = a.id
JOIN "User" u ON u.email IN ('manager1@beauty.local', 'manager2@beauty.local')
WHERE a.slug = 'beauty-salon'
  AND (
    (u.email = 'manager1@beauty.local' AND l."name" = 'Beauty Salon Center')
    OR (u.email = 'manager2@beauty.local' AND l."name" = 'Beauty Salon Riverside')
  )
ON CONFLICT ("locationId", "userId") DO NOTHING;

INSERT INTO "ServiceLocation" ("serviceId", "locationId")
SELECT s.id, l.id
FROM "Service" s
JOIN "Location" l ON l."accountId" = s."accountId"
WHERE s."accountId" = (SELECT id FROM "Account" WHERE slug = 'beauty-salon' LIMIT 1)
  AND l."name" IN ('Beauty Salon Center', 'Beauty Salon Riverside')
  AND s."name" IN (
    'Women Haircut',
    'Men Haircut',
    'Hair Coloring',
    'Manicure',
    'Pedicure',
    'Gel Polish',
    'Basic Facial',
    'Peeling'
  )
ON CONFLICT ("serviceId", "locationId") DO NOTHING;

INSERT INTO "ServiceLocation" ("serviceId", "locationId")
SELECT s.id, l.id
FROM "Service" s
JOIN "Location" l ON l."accountId" = s."accountId"
WHERE s."accountId" = (SELECT id FROM "Account" WHERE slug = 'beauty-salon' LIMIT 1)
  AND s."name" = 'Balayage'
  AND l."name" = 'Beauty Salon Center'
ON CONFLICT ("serviceId", "locationId") DO NOTHING;

INSERT INTO "ServiceLocation" ("serviceId", "locationId")
SELECT s.id, l.id
FROM "Service" s
JOIN "Location" l ON l."accountId" = s."accountId"
WHERE s."accountId" = (SELECT id FROM "Account" WHERE slug = 'beauty-salon' LIMIT 1)
  AND s."name" = 'Hydra Facial'
  AND l."name" = 'Beauty Salon Riverside'
ON CONFLICT ("serviceId", "locationId") DO NOTHING;

COMMIT;
