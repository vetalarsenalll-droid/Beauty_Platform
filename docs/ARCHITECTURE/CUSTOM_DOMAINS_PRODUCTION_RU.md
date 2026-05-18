# Подключение своих доменов клиентов в production

Этот документ описывает, что нужно сделать на production-сервере, чтобы в CRM работал раздел:

```text
Сайт -> Настройки -> Свой домен
```

После настройки клиент сможет ввести свой домен в конструкторе сайта, прописать A-записи у регистратора и открыть сайт по адресу:

```text
https://client-domain.ru
https://client-domain.ru/booking
https://client-domain.ru/client
```

Технический адрес платформы при этом остается рабочим:

```text
https://platform-domain.ru/public-slug_id
```

## 1. Что уже сделано в коде

В приложении уже реализовано:

- модель `AccountDomain` в Prisma;
- миграция для новых полей домена;
- CRUD API доменов для CRM;
- DNS-проверка A-записей через `node:dns/promises`;
- CRM-страница `Сайт -> Настройки`;
- internal endpoint для Caddy `ask`;
- internal endpoint для resolve домена в аккаунт;
- host-based routing для custom domain через `apps/web/proxy.ts`;
- генерация публичных ссылок без `/{publicSlug}` на своем домене.

Перед production-деплоем нужно только применить миграции, обновить Prisma Client на сервере и настроить инфраструктуру.

## 2. Что такое Caddy и нужно ли где-то регистрироваться

Caddy - это веб-сервер/reverse proxy, как Nginx, но с автоматическим HTTPS.

Регистрироваться в Caddy не нужно. Это обычная программа, которую ставят на VPS.

Caddy сам:

- принимает запросы на портах `80` и `443`;
- проксирует запросы в Next.js на `127.0.0.1:3000`;
- выпускает SSL-сертификаты для доменов через Let's Encrypt или ZeroSSL;
- продлевает сертификаты автоматически;
- при on-demand TLS спрашивает наше приложение, можно ли выпускать сертификат для конкретного домена.

Для Caddy можно указать email администратора. Это не регистрация в панели Caddy, а контакт для центров сертификации на случай важных уведомлений по сертификатам.

Официальные страницы:

- установка Caddy: https://caddyserver.com/docs/install
- `on_demand_tls ask`: https://caddyserver.com/docs/caddyfile/options#on-demand-tls

## 3. Production-схема

Итоговая схема:

```text
Клиентский браузер
  -> https://client-domain.ru
  -> Caddy на VPS, порт 443
  -> Next.js web app, 127.0.0.1:3000
  -> PostgreSQL
```

Для технического адреса:

```text
Клиентский браузер
  -> https://platform-domain.ru/zolotaya-liliya_1
  -> Caddy
  -> Next.js
```

Для своего домена:

```text
Клиентский браузер
  -> https://zolotaya-liliya.ru/booking
  -> Caddy
  -> Next.js
  -> proxy.ts определяет Host
  -> AccountDomain.domain = zolotaya-liliya.ru
  -> account.slug + "_" + account.id
  -> /zolotaya-liliya_1/booking
```

## 4. Что должно быть у тебя до настройки

Нужно:

- VPS с публичным IPv4, например `194.58.112.174`;
- домен самой платформы, например `platform-domain.ru`;
- доступ по SSH к VPS;
- production `.env` для приложения;
- PostgreSQL production-база;
- открытые порты `80` и `443`;
- Next.js приложение должно запускаться на VPS и слушать `127.0.0.1:3000` или `localhost:3000`.

Важно: `127.0.0.1` в локальной разработке - это твой компьютер. В production клиентам нельзя давать `127.0.0.1`. Клиентам нужен публичный IP VPS.

## 5. DNS домена платформы

Сначала настраивается домен самой платформы.

У регистратора домена платформы нужно добавить:

```text
Тип   Имя   Значение
A     @     194.58.112.174
A     www   194.58.112.174
```

Если платформа будет на поддомене, например `app.platform-domain.ru`:

```text
Тип   Имя   Значение
A     app   194.58.112.174
```

DNS-серверы регистратора менять не нужно. Например, у REG.RU можно оставить:

```text
ns1.reg.ru
ns2.reg.ru
```

Меняются только ресурсные записи.

Проверка с локального компьютера:

```powershell
nslookup platform-domain.ru
nslookup www.platform-domain.ru
```

В ответе должен быть IP VPS:

```text
194.58.112.174
```

## 6. Production env

На VPS в production `.env` должны быть реальные значения.

Пример:

```env
NEXT_PUBLIC_APP_URL=https://platform-domain.ru
APP_INTERNAL_ORIGIN=http://127.0.0.1:3000

PLATFORM_PUBLIC_ORIGIN=https://platform-domain.ru
PLATFORM_PUBLIC_IP=194.58.112.174
PLATFORM_SYSTEM_DOMAINS=platform-domain.ru,www.platform-domain.ru,localhost,127.0.0.1

DOMAIN_TLS_ASK_SECRET=replace-with-long-random-secret
```

Что означает каждое значение:

```env
PLATFORM_PUBLIC_ORIGIN=https://platform-domain.ru
```

Публичный технический адрес платформы. Из него CRM строит техническую ссылку:

```text
https://platform-domain.ru/zolotaya-liliya_1
```

```env
PLATFORM_PUBLIC_IP=194.58.112.174
```

Публичный IP твоего VPS. С этим IP приложение сравнивает DNS клиента при нажатии `Проверить`.

```env
PLATFORM_SYSTEM_DOMAINS=platform-domain.ru,www.platform-domain.ru,localhost,127.0.0.1
```

Домены самой платформы. Их нельзя подключить как домен клиента, и для них не включается custom-domain rewrite.

```env
APP_INTERNAL_ORIGIN=http://127.0.0.1:3000
```

Внутренний адрес Next.js на VPS. `proxy.ts` использует его, чтобы обратиться к:

```text
/api/internal/domains/resolve
```

Даже если снаружи сайт открыт по HTTPS, внутри VPS Caddy обычно проксирует в Next.js по HTTP на `127.0.0.1:3000`.

```env
DOMAIN_TLS_ASK_SECRET=replace-with-long-random-secret
```

Секрет для Caddy `ask` endpoint. Он нужен, чтобы посторонние не могли напрямую дергать endpoint проверки SSL.

Сгенерировать секрет можно так:

```bash
openssl rand -hex 32
```

## 7. Применить миграции и обновить Prisma Client на VPS

После деплоя кода на VPS:

```bash
npm install
npx prisma generate --schema packages/db/prisma/schema.prisma
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npm --workspace apps/web run build
```

Если проект запускается через Docker, эти команды должны выполняться внутри build/deploy-процесса контейнера или отдельной release-команды.

Проверить схему:

```bash
npm run prisma:validate
```

## 8. Установка Caddy на Ubuntu/Debian VPS

Если на VPS уже стоит Nginx и он занимает `80`/`443`, нужно либо удалить/остановить Nginx, либо не ставить Caddy на эти же порты. Для custom domains проще заменить Nginx на Caddy.

Проверить, кто слушает порты:

```bash
sudo ss -tulpn | grep -E ':80|:443'
```

Если Nginx больше не нужен:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

Установка Caddy по официальному apt-репозиторию:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Проверить:

```bash
caddy version
sudo systemctl status caddy
```

Открыть порты в firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

## 9. Caddyfile

Открыть конфиг:

```bash
sudo nano /etc/caddy/Caddyfile
```

Пример для production:

```caddyfile
{
	email admin@platform-domain.ru

	on_demand_tls {
		ask http://127.0.0.1:3000/api/internal/domains/allow?secret=replace-with-long-random-secret
	}
}

platform-domain.ru {
	reverse_proxy 127.0.0.1:3000
}

www.platform-domain.ru {
	redir https://platform-domain.ru{uri} permanent
}

http:// {
	reverse_proxy 127.0.0.1:3000
}

https:// {
	tls {
		on_demand
	}

	reverse_proxy 127.0.0.1:3000
}
```

Что здесь важно:

- `platform-domain.ru` - домен самой платформы;
- `www.platform-domain.ru` редиректится на основной домен платформы;
- `http://` принимает HTTP-запросы для любых доменов и проксирует в Next.js;
- `https://` принимает HTTPS для любых custom domains;
- `tls { on_demand }` говорит Caddy выпускать сертификат при первом HTTPS-запросе;
- `ask` перед выпуском сертификата спрашивает приложение, разрешен ли домен.

Секрет в Caddyfile должен совпадать с:

```env
DOMAIN_TLS_ASK_SECRET=replace-with-long-random-secret
```

Проверить конфиг:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Перезагрузить Caddy:

```bash
sudo systemctl reload caddy
```

Посмотреть логи:

```bash
journalctl -u caddy -f
```

## 10. Проверка internal endpoints на VPS

На самом VPS:

```bash
curl -i "http://127.0.0.1:3000/api/internal/domains/resolve?host=platform-domain.ru"
```

Для системного домена платформы ответ должен быть:

```json
{"data":null}
```

Для клиентского домена endpoint начнет возвращать аккаунт только после того, как домен добавлен в CRM и прошел DNS-проверку.

Проверка Caddy `ask` для домена, которого нет в базе:

```bash
curl -i "http://127.0.0.1:3000/api/internal/domains/allow?domain=unknown-domain.ru&secret=replace-with-long-random-secret"
```

Ожидаемо:

```text
403 forbidden
```

После добавления и успешной проверки клиентского домена:

```bash
curl -i "http://127.0.0.1:3000/api/internal/domains/allow?domain=client-domain.ru&secret=replace-with-long-random-secret"
```

Ожидаемо:

```text
200 ok
```

## 11. Что делает клиент в REG.RU

Клиенту не нужно менять DNS-серверы на какие-то серверы платформы.

Если у клиента в REG.RU стоят:

```text
ns1.reg.ru
ns2.reg.ru
```

их можно оставить.

Клиент открывает DNS-зону домена и меняет только ресурсные записи:

```text
Тип   Имя   Значение
A     @     194.58.112.174
A     www   194.58.112.174
```

Где `194.58.112.174` - публичный IP твоего VPS из `PLATFORM_PUBLIC_IP`.

Если у клиента уже есть старые A-записи для `@` или `www`, которые ведут на старый сайт, их нужно заменить на IP VPS.

Если у клиента есть MX-записи для почты, их не трогать.

Если у клиента есть TXT-записи для верификаций, их не трогать.

Если у клиента есть CNAME для `www`, его обычно нужно удалить или заменить на A-запись `www -> VPS_IP`.

## 12. Что делает клиент в CRM

В CRM:

```text
Сайт -> Настройки -> Свой домен
```

Шаги:

1. Ввести домен без `https://` и без пути:

```text
client-domain.ru
```

2. Нажать `Сохранить`.

3. Прописать у регистратора:

```text
A @   194.58.112.174
A www 194.58.112.174
```

4. Подождать обновления DNS. Обычно от нескольких минут до нескольких часов.

5. Нажать `Проверить`.

6. Если основной домен указывает на VPS, статус станет активным.

7. Открыть:

```text
https://client-domain.ru
```

При первом открытии Caddy выпустит SSL-сертификат. Первый HTTPS-запрос может быть чуть дольше обычного.

## 13. Как проверить DNS

С локального компьютера:

```powershell
nslookup client-domain.ru
nslookup www.client-domain.ru
```

На VPS:

```bash
dig +short client-domain.ru A
dig +short www.client-domain.ru A
```

Ожидаемый ответ:

```text
194.58.112.174
```

Проверка HTTP:

```bash
curl -I http://client-domain.ru
```

Проверка HTTPS:

```bash
curl -I https://client-domain.ru
```

Проверка конкретной страницы:

```bash
curl -I https://client-domain.ru/booking
```

## 14. Типовые проблемы

### В CRM написано `IP сервера: 127.0.0.1`

Это значит, что приложение запущено в локальной разработке или на production не задан `PLATFORM_PUBLIC_IP`.

На production должно быть:

```env
PLATFORM_PUBLIC_IP=194.58.112.174
```

После изменения env нужно перезапустить web-приложение.

### DNS проверка показывает старый IP

Причины:

- клиент изменил не ту DNS-зону;
- у домена используются другие DNS-серверы;
- DNS еще не обновился;
- осталась старая A-запись;
- `www` настроен как CNAME на старый сайт.

Проверить:

```bash
dig NS client-domain.ru
dig +short client-domain.ru A
dig +short www.client-domain.ru A
```

### Сайт открывается по HTTP, но HTTPS не работает

Проверить:

```bash
sudo systemctl status caddy
journalctl -u caddy -f
```

Частые причины:

- порт `443` закрыт firewall;
- Caddy не запущен;
- Caddy не может достучаться до Next.js на `127.0.0.1:3000`;
- `/api/internal/domains/allow` возвращает `403`;
- домен не прошел DNS-проверку в CRM;
- домен не указывает на VPS.

### Caddy не выпускает сертификат

Проверить ask endpoint:

```bash
curl -i "http://127.0.0.1:3000/api/internal/domains/allow?domain=client-domain.ru&secret=replace-with-long-random-secret"
```

Должно быть:

```text
200 ok
```

Если `403`, значит домен:

- не добавлен в CRM;
- не прошел DNS-проверку;
- не имеет `verifiedAt`;
- привязан к неактивному аккаунту;
- передан не в том виде, например с `www`, а в базе только корневой домен.

Для поддержки `www.client-domain.ru` добавь его отдельным доменом в CRM или настрой в DNS и добавь как второй домен, потом выбери primary без `www`.

### Технический адрес перестал работать

Технический адрес не должен зависеть от custom domain.

Проверить:

```bash
curl -I https://platform-domain.ru/zolotaya-liliya_1
curl -I https://platform-domain.ru/zolotaya-liliya_1/booking
```

Если не работает, проверить:

- `PLATFORM_PUBLIC_ORIGIN`;
- Caddyfile для `platform-domain.ru`;
- запущен ли Next.js;
- не попал ли домен платформы в `AccountDomain` как клиентский домен.

## 15. Минимальный чеклист запуска

1. На VPS установлен и запущен Next.js на `127.0.0.1:3000`.
2. На VPS применены Prisma migrations.
3. На VPS обновлен Prisma Client.
4. В production env задан `PLATFORM_PUBLIC_IP`.
5. В production env задан `PLATFORM_PUBLIC_ORIGIN`.
6. В production env задан `APP_INTERNAL_ORIGIN`.
7. В production env задан `PLATFORM_SYSTEM_DOMAINS`.
8. В production env задан `DOMAIN_TLS_ASK_SECRET`.
9. Caddy установлен.
10. Nginx не занимает `80` и `443`, если используется Caddy.
11. Caddyfile настроен.
12. `sudo caddy validate --config /etc/caddy/Caddyfile` проходит.
13. `sudo systemctl reload caddy` проходит.
14. Домен платформы указывает на VPS.
15. CRM открывается по `https://platform-domain.ru/crm`.
16. Клиентский домен добавляется в CRM.
17. Клиентский DNS `A @` указывает на VPS.
18. Клиентский DNS `A www` указывает на VPS.
19. Кнопка `Проверить` в CRM показывает успешный DNS.
20. `https://client-domain.ru` открывает публичный сайт.
21. `https://client-domain.ru/booking` открывает запись.
22. `https://www.client-domain.ru/booking` редиректит на primary, если оба домена добавлены и primary выбран без `www`.

## 16. Что сказать клиенту

Короткая инструкция для клиента:

```text
Откройте DNS-зону домена у регистратора.
DNS-серверы менять не нужно.
Измените только ресурсные записи:

A   @     194.58.112.174
A   www   194.58.112.174

Сохраните изменения.
DNS может обновляться от нескольких минут до нескольких часов.
После этого в CRM нажмите "Проверить".
```

Если у клиента REG.RU, это делается в разделе:

```text
Домены -> нужный домен -> DNS-серверы и управление зоной -> Ресурсные записи
```

Нужно получить примерно такой результат:

```text
A   @     194.58.112.174
A   www   194.58.112.174
```

