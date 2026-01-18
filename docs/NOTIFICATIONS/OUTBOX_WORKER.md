NOTIFICATIONS: Outbox and Worker

Outbox
- outbox_items: scope, account_id, user_id, event_name, payload, status, dedupe_key, available_at
- создается в одной транзакции с доменным изменением

Worker
- читает outbox_items
- доставляет по каналам
- пишет delivery_logs

Delivery logs
- status queued/sent/failed/dead
- retries + backoff
- дедупликация
