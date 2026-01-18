SECURITY OVERVIEW

Auth (MVP)
- email + пароль
- восстановление пароля по email
- Web: httpOnly cookies + refresh + CSRF
- Mobile: access/refresh + secure storage + PIN
- Заложено сразу: SMS login, Telegram login, MAX login

Protection
- Rate limiting (Redis): IP + user + account
- Anti-bruteforce
- Идемпотентность: booking, payment callbacks, deliveries/webhooks
- HMAC подпись вебхуков + timestamp + replay protection
- Аудит действий (кто/что/когда/IP + diff)
- Маскирование PII в логах
- Backups + restore-проверки
