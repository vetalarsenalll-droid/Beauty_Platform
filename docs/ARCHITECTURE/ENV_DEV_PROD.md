ENV: Dev/Prod

Dev
- docker-compose (web/worker/postgres/redis)
- Prisma Studio only dev

Prod (VPS Reg.ru)
- docker-compose + nginx + SSL
- backups + healthchecks
- secrets only via env
