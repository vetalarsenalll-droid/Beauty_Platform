# GigaChat Freemium (Public AI Chat)

## Environment

Add to `.env`:

```env
GIGACHAT_AUTH_KEY=base64(client_id:client_secret)
GIGACHAT_MODEL=GigaChat
GIGACHAT_AUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
GIGACHAT_API_URL=https://gigachat.devices.sberbank.ru/api/v1/chat/completions
```

## API routes

- `GET /api/v1/public/ai/chat?account=<account-slug>&threadId=<optional>`
- `POST /api/v1/public/ai/chat?account=<account-slug>`
- `DELETE /api/v1/public/ai/chat?account=<account-slug>&threadId=<required>`

Body:

```json
{
  "message": "Хочу записаться на маникюр завтра вечером",
  "threadId": 12
}
```

Response:

```json
{
  "data": {
    "threadId": 12,
    "reply": "Текст ответа ассистента...",
    "action": {
      "type": "open_booking",
      "bookingUrl": "/slug-id/booking?locationId=1&serviceId=2&date=2026-02-26&time=17:00"
    },
    "draft": {
      "locationId": 1,
      "serviceId": 2,
      "specialistId": 7,
      "date": "2026-02-26",
      "time": "17:00",
      "clientName": "Ирина",
      "clientPhone": "+79990000000",
      "mode": "ASSISTANT",
      "status": "WAITING_CONFIRMATION",
      "consentConfirmedAt": "2026-02-25T18:25:00.000Z"
    }
  }
}
```
