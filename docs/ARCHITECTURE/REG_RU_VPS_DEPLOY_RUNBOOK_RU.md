# Полная инструкция деплоя BeautyPlatform на VPS REG.RU

Документ описывает практический план запуска проекта на VPS REG.RU в production-режиме. Инструкция рассчитана на вариант: один VPS, Docker Compose, PostgreSQL, Redis, Next.js web-приложение, Nginx, HTTPS через Let's Encrypt.

## 1. Что будет на VPS

Итоговая схема:

```text
Пользователь
  -> https://your-domain.ru
  -> Nginx на VPS
  -> web контейнер Next.js
  -> PostgreSQL контейнер
  -> Redis контейнер
```

Компоненты:

- `web` - Next.js приложение `apps/web`.
- `postgres` - основная база данных.
- `redis` - pub/sub для real-time Журнала записи.
- `nginx` - внешний веб-сервер, принимает 80/443 и проксирует в `web`.
- `certbot` - выпуск и продление SSL-сертификатов.

## 2. Что нужно подготовить заранее

Нужно:

- VPS в REG.RU.
- Домен или поддомен, например `onlais.ru` или `app.onlais.ru`.
- Доступ к DNS-зоне домена.
- SSH-доступ к VPS.
- Репозиторий проекта, доступный через Git.
- Production-секреты: `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `NEXTAUTH_SECRET`, `PUBLIC_BOOKING_HOLD_SECRET`.

Рекомендуемые характеристики VPS для старта:

- Ubuntu 22.04 LTS или Ubuntu 24.04 LTS.
- 2 CPU.
- 4 GB RAM минимум.
- 40 GB SSD минимум.
- Если будут реальные клиенты и медиафайлы, лучше 4 CPU / 8 GB RAM / 80+ GB SSD.

## 3. Настройка DNS

В панели REG.RU для домена добавь A-записи:

```text
@              A      VPS_IP
www            A      VPS_IP
app            A      VPS_IP
```

Если используешь только поддомен:

```text
app            A      VPS_IP
```

Проверить DNS с локального компьютера:

```powershell
nslookup app.example.ru
```

В ответе должен быть IP твоего VPS.

DNS может обновляться от нескольких минут до нескольких часов.

## 4. Первый вход на VPS

На Windows открой PowerShell:

```powershell
ssh root@VPS_IP
```

Если REG.RU выдал пользователя не `root`, используй его:

```powershell
ssh username@VPS_IP
```

Обнови систему:

```bash
apt update
apt upgrade -y
```

Поставь базовые утилиты:

```bash
apt install -y curl git unzip ca-certificates gnupg lsb-release ufw htop nano
```

Проверь время:

```bash
timedatectl
```

Для Москвы можно поставить:

```bash
timedatectl set-timezone Europe/Moscow
```

## 5. Создание отдельного пользователя

Не рекомендуется постоянно работать под `root`.

```bash
adduser deploy
usermod -aG sudo deploy
```

Перелогинься:

```bash
exit
```

С локального компьютера:

```powershell
ssh deploy@VPS_IP
```

## 6. Установка Docker и Docker Compose

На VPS:

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

Добавь Docker repository:

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Установи Docker:

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Разреши пользователю `deploy` запускать Docker:

```bash
sudo usermod -aG docker deploy
```

Перелогинься, чтобы группа применилась:

```bash
exit
ssh deploy@VPS_IP
```

Проверка:

```bash
docker --version
docker compose version
docker run hello-world
```

## 7. Firewall

Разреши SSH, HTTP, HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Важно: не открывай наружу PostgreSQL `5432` и Redis `6379`. Эти сервисы должны быть доступны только внутри Docker-сети.

## 8. Клонирование проекта

Создай папку:

```bash
sudo mkdir -p /opt/beauty-platform
sudo chown deploy:deploy /opt/beauty-platform
cd /opt/beauty-platform
```

Клонируй репозиторий:

```bash
git clone REPO_URL .
```

Если репозиторий приватный, удобнее настроить SSH key:

```bash
ssh-keygen -t ed25519 -C "deploy@beauty-platform"
cat ~/.ssh/id_ed25519.pub
```

Публичный ключ добавь в GitHub/GitLab.

## 9. Production env-файл

Создай файл:

```bash
nano .env.production
```

Пример:

```env
NODE_ENV=production

POSTGRES_DB=beauty_platform
POSTGRES_USER=beauty_user
POSTGRES_PASSWORD=CHANGE_TO_LONG_RANDOM_PASSWORD

DATABASE_URL=postgresql://beauty_user:CHANGE_TO_LONG_RANDOM_PASSWORD@postgres:5432/beauty_platform
REDIS_URL=redis://redis:6379

PUBLIC_BOOKING_HOLD_SECRET=CHANGE_TO_LONG_RANDOM_SECRET
SESSION_SECRET=CHANGE_TO_LONG_RANDOM_SECRET
NEXTAUTH_SECRET=CHANGE_TO_LONG_RANDOM_SECRET

NEXT_PUBLIC_APP_URL=https://app.example.ru
```

Сгенерировать секреты можно так:

```bash
openssl rand -hex 32
```

Сгенерируй отдельное значение для каждого:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

Не коммить `.env.production` в Git.

## 10. Production Docker Compose

Создай отдельный production compose файл:

```bash
nano docker-compose.prod.yml
```

Базовый вариант:

```yaml
name: beauty_platform_prod

services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    env_file:
      - ./.env.production
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    restart: unless-stopped
    env_file:
      - ./.env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "127.0.0.1:3000:3000"

volumes:
  postgres_data:
  redis_data:
```

## 11. Dockerfile для web

Если production Dockerfile еще нет, создай:

```bash
nano Dockerfile.web
```

Пример:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm --workspace apps/web run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages ./packages

EXPOSE 3000
CMD ["npm", "--workspace", "apps/web", "run", "start"]
```

Примечание: это простой Dockerfile. Позже его можно оптимизировать через standalone output Next.js.

## 12. Первый build и запуск контейнеров

На VPS:

```bash
cd /opt/beauty-platform
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Проверить контейнеры:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Проверить логи web:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
```

Проверить Redis:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec redis redis-cli ping
```

Ожидаемый ответ:

```text
PONG
```

Проверить Postgres:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres pg_isready -U beauty_user -d beauty_platform
```

## 13. Prisma migrations

После запуска базы применить миграции:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec web npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

Проверить статус:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec web npx prisma migrate status --schema packages/db/prisma/schema.prisma
```

Если нужна начальная тестовая база, можно запускать seed только осознанно. Для настоящего production не запускай демо-seed без необходимости:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec web npm run seed:ru
```

## 14. Проверка приложения без домена

Пока Nginx не настроен, проверь локально на VPS:

```bash
curl -I http://127.0.0.1:3000
```

Если нужно проверить с компьютера напрямую, временно можно открыть порт `3000`, но для production лучше не открывать. Правильный путь - Nginx на 80/443.

## 15. Установка Nginx

На VPS:

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Проверь:

```bash
systemctl status nginx
```

## 16. Nginx конфиг

Создай конфиг:

```bash
sudo nano /etc/nginx/sites-available/beauty-platform
```

Вставь, заменив `app.example.ru` на свой домен:

```nginx
server {
    listen 80;
    server_name app.example.ru www.app.example.ru;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

SSE для Журнала идет через обычный HTTP response stream. Важно оставить:

```nginx
proxy_buffering off;
proxy_read_timeout 3600s;
```

Активируй сайт:

```bash
sudo ln -s /etc/nginx/sites-available/beauty-platform /etc/nginx/sites-enabled/beauty-platform
sudo nginx -t
sudo systemctl reload nginx
```

## 17. SSL через Let's Encrypt

Установи certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Выпусти сертификат:

```bash
sudo certbot --nginx -d app.example.ru
```

Если нужен `www`:

```bash
sudo certbot --nginx -d app.example.ru -d www.app.example.ru
```

Проверка автообновления:

```bash
sudo certbot renew --dry-run
```

## 18. Проверка production после SSL

Открой:

```text
https://app.example.ru
```

Проверь:

- Главная публичная страница открывается.
- `/crm/login` открывается.
- `/crm/calendar` открывается после входа.
- Публичная онлайн-запись создает одиночную запись.
- Публичная онлайн-запись в групповой сеанс увеличивает `Мест: X/Y`.
- В Журнале запись появляется без ручной перезагрузки.
- В логах нет `Controller is already closed`.

Логи:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
```

## 19. Проверка Redis pub/sub на VPS

Проверить Redis:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec redis redis-cli ping
```

Ожидаемый ответ:

```text
PONG
```

Проверить, что web видит переменную:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec web printenv REDIS_URL
```

Ожидаемо:

```text
redis://redis:6379
```

## 20. Обновление проекта на VPS

Обычный порядок деплоя новой версии:

```bash
cd /opt/beauty-platform
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build web
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml exec web npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

Проверить:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 web
```

## 21. Бэкапы базы

Создай папку:

```bash
mkdir -p /opt/beauty-platform/backups/postgres
```

Ручной backup:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U beauty_user -d beauty_platform \
  > /opt/beauty-platform/backups/postgres/beauty_platform_$(date +%F_%H-%M).sql
```

Проверить файл:

```bash
ls -lh /opt/beauty-platform/backups/postgres
```

Автобэкап через cron:

```bash
crontab -e
```

Добавь:

```cron
0 3 * * * cd /opt/beauty-platform && docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_dump -U beauty_user -d beauty_platform > /opt/beauty-platform/backups/postgres/beauty_platform_$(date +\%F_\%H-\%M).sql
```

Рекомендуется дополнительно копировать бэкапы вне VPS: в S3-совместимое хранилище, Яндекс Object Storage, REG.RU storage или другой сервер.

## 22. Восстановление базы из backup

Осторожно: восстановление перезапишет данные.

```bash
cat /opt/beauty-platform/backups/postgres/BACKUP_FILE.sql | \
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  psql -U beauty_user -d beauty_platform
```

Перед восстановлением production-базы сделай свежий backup.

## 23. Где хранить загружаемые файлы

Если проект будет хранить медиафайлы локально, нужно:

- вынести uploads в Docker volume;
- настроить backup этого volume;
- не хранить важные пользовательские файлы только внутри контейнера.

Лучший production-вариант позже:

- S3-compatible storage;
- отдельный bucket для медиа;
- CDN при необходимости.

## 24. Мониторинг и базовая диагностика

Контейнеры:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Логи web:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
```

Логи Postgres:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f postgres
```

Логи Redis:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f redis
```

Проверка места на диске:

```bash
df -h
```

Проверка памяти:

```bash
free -h
```

Процессы:

```bash
htop
```

## 25. Частые проблемы

### Сайт не открывается

Проверить:

```bash
sudo nginx -t
sudo systemctl status nginx
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 web
```

### SSL не выпускается

Проверь:

- DNS A-запись ведет на VPS.
- Порт 80 открыт.
- Nginx отвечает по домену.

Команды:

```bash
nslookup app.example.ru
sudo ufw status
curl -I http://app.example.ru
```

### Prisma migration падает

Проверить `DATABASE_URL` внутри web:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec web printenv DATABASE_URL
```

Проверить доступность Postgres:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres pg_isready -U beauty_user -d beauty_platform
```

### Журнал не обновляется real-time

Проверить Redis:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec redis redis-cli ping
```

Проверить env:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec web printenv REDIS_URL
```

Проверить SSE endpoint в браузере:

```text
https://app.example.ru/api/v1/crm/calendar/events
```

Без CRM-сессии может быть 401. С открытым Журналом в логах web должен быть запрос:

```text
GET /api/v1/crm/calendar/events 200
```

## 26. Что нельзя делать в production

Нельзя:

- Коммитить `.env.production`.
- Открывать наружу PostgreSQL и Redis.
- Запускать demo seed на реальной базе без понимания последствий.
- Делать `git reset --hard` на сервере, если там есть незакоммиченные production-файлы.
- Хранить единственную копию базы только на VPS.
- Использовать короткие пароли.
- Оставлять `root` SSH с паролем без необходимости.

## 27. Минимальный чеклист перед реальным запуском

- Домен указывает на VPS.
- Docker и Docker Compose установлены.
- `.env.production` заполнен реальными секретами.
- `postgres`, `redis`, `web` контейнеры запущены.
- `prisma migrate deploy` выполнен.
- Nginx проксирует на `127.0.0.1:3000`.
- HTTPS выпущен через certbot.
- Redis отвечает `PONG`.
- Онлайн-запись создает записи.
- Журнал обновляется без ручной перезагрузки.
- Backup базы настроен.
- Проверено восстановление backup на тестовой базе или хотя бы ручная выгрузка.

## 28. Команды коротко

Первичный запуск:

```bash
cd /opt/beauty-platform
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml exec web npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

Обновление:

```bash
cd /opt/beauty-platform
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build web
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml exec web npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

Логи:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
```

Статус:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

