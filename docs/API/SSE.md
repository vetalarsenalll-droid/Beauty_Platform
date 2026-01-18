API: SSE

Endpoint
GET /api/v1/realtime/sse?channels=appointments.changed,payments.changed

Формат события
{ "event": "appointments.changed", "data": { "accountId": "...", "appointmentId": "...", "type": "updated" }, "ts": "2026-01-15T12:00:00Z" }
