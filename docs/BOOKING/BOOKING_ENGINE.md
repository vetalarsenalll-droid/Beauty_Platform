BOOKING ENGINE — ЭТАЛОН

6.0. Принцип
Единый движок доступности для Marketplace/Client/CRM/AI.

6.1. Время и таймзоны
- account.time_zone (IANA)
- хранение в UTC
- day window [00:00..24:00) в TZ аккаунта

6.2. Шаг слота
- account_settings.slot_step_minutes, default 15
- сетка слотов + subslots

6.3. Длительность и цена по уровню
- service_level_configs + specialist_services overrides

6.4. Источники доступности
- working hours
- breaks
- vacations/day off
- blocked slots
- buffers
- overlaps

6.5. Алгоритм расчета
- candidate resources -> windows -> stepMinutes -> valid slots

6.6. Статусы
new/confirmed/in_progress/done/cancelled/no_show

6.7. UI воронки
Дата -> услуга -> специалист
Услуга -> время -> специалист
специалист -> услуга -> время

6.8. Конкурентность
- appointment_holds с TTL или транзакция
- Idempotency-Key на POST /booking/appointments

6.9. API
- availability
- slots
- appointments create/reschedule/cancel

6.10. События
booking.appointment.*
SSE: appointments.changed, availability.changed
