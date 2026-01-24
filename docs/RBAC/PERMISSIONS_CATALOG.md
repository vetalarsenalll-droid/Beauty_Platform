RBAC: Roles and Permissions

Actors
- Client
- Business User
- Specialist
- Platform Admin

Business roles
- owner
- manager
- specialist
- readonly


Policies
- Specialist: только свое
- Manager: операционка (календарь/записи/клиенты), без критичных настроек/финансов (по настройкам)
- Owner: все + финансы/интеграции/права

Permissions
- CRUD по сущностям + действия confirm/cancel/refund/export

CRM permissions (ключи)
- crm.all
- crm.locations.read/create/update/delete
- crm.services.read/create/update/delete
- crm.specialists.read/create/update/delete
- crm.schedule.read/create/update/delete
- crm.calendar.read
- crm.appointments.create/update/confirm/cancel/reschedule
- crm.clients.read/create/update/delete
- crm.payments.read/refund/export
- crm.promos.read/create/update/delete
- crm.loyalty.read/create/update/delete
- crm.analytics.read/export
- crm.settings.read/update
