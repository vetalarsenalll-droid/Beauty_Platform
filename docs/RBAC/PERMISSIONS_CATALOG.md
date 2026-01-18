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
- admin роль не используем

Policies
- Specialist: только свое
- Manager: операционка (календарь/записи/клиенты), без критичных настроек/финансов (по настройкам)
- Owner: все + финансы/интеграции/права

Permissions
- CRUD по сущностям + действия confirm/cancel/refund/export
