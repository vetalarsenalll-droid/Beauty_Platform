DB: Prisma Rules

- schema.prisma = truth
- миграции через prisma migrate
- standard CLI: prisma@6.19.1
- индексы: account_id, created_at, status
- enum статусы фиксируем в Prisma
- outbox_items.dedupe_key unique
- delivery_logs index on outbox_item_id
