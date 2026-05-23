BEGIN;

SET client_encoding = 'UTF8';

INSERT INTO "Permission" ("key", "description", "createdAt")
VALUES
  ('crm.all', 'Полный доступ к CRM', NOW()),
  ('crm.locations.read', 'Просмотр локаций', NOW()),
  ('crm.locations.create', 'Создание локаций', NOW()),
  ('crm.locations.update', 'Изменение локаций', NOW()),
  ('crm.locations.delete', 'Удаление локаций', NOW()),
  ('crm.services.read', 'Просмотр услуг', NOW()),
  ('crm.services.create', 'Создание услуг', NOW()),
  ('crm.services.update', 'Изменение услуг', NOW()),
  ('crm.services.delete', 'Удаление услуг', NOW()),
  ('crm.specialists.read', 'Просмотр специалистов', NOW()),
  ('crm.specialists.create', 'Создание специалистов', NOW()),
  ('crm.specialists.update', 'Изменение специалистов', NOW()),
  ('crm.specialists.delete', 'Удаление специалистов', NOW()),
  ('crm.schedule.read', 'Просмотр расписания', NOW()),
  ('crm.schedule.create', 'Создание расписаний', NOW()),
  ('crm.schedule.update', 'Изменение расписаний', NOW()),
  ('crm.schedule.delete', 'Удаление расписаний', NOW()),
  ('crm.calendar.read', 'Просмотр календаря', NOW()),
  ('crm.appointments.create', 'Создание записей', NOW()),
  ('crm.appointments.update', 'Изменение записей', NOW()),
  ('crm.appointments.confirm', 'Подтверждение записей', NOW()),
  ('crm.appointments.cancel', 'Отмена записей', NOW()),
  ('crm.appointments.reschedule', 'Перенос записей', NOW()),
  ('crm.clients.read', 'Просмотр клиентов', NOW()),
  ('crm.clients.create', 'Создание клиентов', NOW()),
  ('crm.clients.update', 'Изменение клиентов', NOW()),
  ('crm.clients.delete', 'Удаление клиентов', NOW()),
  ('crm.payments.read', 'Просмотр оплат', NOW()),
  ('crm.payments.refund', 'Возвраты оплат', NOW()),
  ('crm.payments.export', 'Экспорт оплат', NOW()),
  ('crm.promos.read', 'Просмотр промо', NOW()),
  ('crm.promos.create', 'Создание промо', NOW()),
  ('crm.promos.update', 'Изменение промо', NOW()),
  ('crm.promos.delete', 'Удаление промо', NOW()),
  ('crm.loyalty.read', 'Просмотр лояльности', NOW()),
  ('crm.loyalty.create', 'Создание правил лояльности', NOW()),
  ('crm.loyalty.update', 'Изменение лояльности', NOW()),
  ('crm.loyalty.delete', 'Удаление лояльности', NOW()),
  ('crm.analytics.read', 'Просмотр аналитики', NOW()),
  ('crm.analytics.export', 'Экспорт аналитики', NOW()),
  ('crm.settings.read', 'Просмотр настроек CRM', NOW()),
  ('crm.settings.update', 'Изменение настроек CRM', NOW())
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

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
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

COMMIT;
