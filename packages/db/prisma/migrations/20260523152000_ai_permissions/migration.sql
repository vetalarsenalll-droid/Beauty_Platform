INSERT INTO "PlatformPermission" ("key", "description", "createdAt")
VALUES
  ('platform.ai.read', 'Просмотр AI-раздела платформы', NOW()),
  ('platform.ai.manage', 'Управление AI-разделом платформы', NOW()),
  ('platform.ai.packages.manage', 'Управление AI-пакетами', NOW()),
  ('platform.ai.accounts.manage', 'Управление AI-доступом аккаунтов', NOW()),
  ('platform.ai.usage.read', 'Просмотр глобального AI-расхода', NOW()),
  ('platform.ai.ledger.manage', 'Управление AI-балансами и движениями', NOW())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Permission" ("key", "description", "createdAt")
VALUES
  ('crm.assistant.read', 'Просмотр раздела Ассистент', NOW()),
  ('crm.assistant.manage', 'Управление AI-ассистентом', NOW()),
  ('crm.assistant.site.read', 'Просмотр настроек ассистента на сайте', NOW()),
  ('crm.assistant.site.manage', 'Управление ассистентом на сайте', NOW()),
  ('crm.assistant.dialogs.read', 'Просмотр диалогов AI-ассистента', NOW()),
  ('crm.assistant.analytics.read', 'Просмотр аналитики AI-ассистента', NOW()),
  ('crm.assistant.billing.read', 'Просмотр AI-баланса и списаний', NOW()),
  ('crm.assistant.billing.manage', 'Покупка AI-пакетов и управление AI-балансом', NOW()),
  ('crm.assistant.agent.use', 'Использование CRM AI-агента', NOW()),
  ('crm.assistant.agent.write', 'Подтверждение действий CRM AI-агента', NOW()),
  ('crm.assistant.logs.read', 'Просмотр технических AI-логов', NOW())
ON CONFLICT ("key") DO NOTHING;
