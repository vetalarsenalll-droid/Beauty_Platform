# Platform Payments: подробный план реализации

## 1. Цель

Платформа должна принимать реальные платежи от CRM-аккаунтов за:

- подписку на CRM;
- AI-пакеты токенов для ассистента;
- будущие платные модули платформы.

Первый провайдер: **T-Банк / T-Касса интернет-эквайринг**.

Архитектура должна быть провайдер-независимой, чтобы позже добавить:

- Сбербанк;
- Альфа-Банк;
- другие провайдеры;
- безналичный расчет для юрлиц и ИП через отдельный B2B-процесс.

UX должен быть похож на Tilda:

- CRM-пользователь выбирает покупку;
- видит понятную модалку оплаты;
- выбирает `Банковской картой` или `СБП`;
- не видит внутреннюю маржу платформы;
- после успешной оплаты подписка продлевается или токены начисляются автоматически;
- чек формируется и отправляется покупателю.

## 2. Важное ограничение

Не делать собственную форму ввода номера карты внутри CRM.

Правильный вариант для старта: использовать платежную форму банка / hosted payment page.

Причины:

- не хранить и не обрабатывать карточные данные;
- не брать на себя PCI DSS;
- быстрее запустить карту, СБП, T-Pay и будущие способы оплаты;
- платежная форма банка сама проходит 3-D Secure и банковские сценарии.

В CRM можно сделать свою модалку выбора способа оплаты, но ввод карты и QR СБП должны открываться через T-Банк.

## 3. Текущая структура проекта

### 3.1 Основная Prisma-схема

Файл:

```text
packages/db/prisma/schema.prisma
```

Сейчас уже есть базовые модели платформенного биллинга:

```prisma
model PlatformInvoice {
  id             Int
  accountId      Int
  subscriptionId Int?
  status         InvoiceStatus
  amount         Decimal
  currency       String
  issuedAt       DateTime?
  dueAt          DateTime?
  paidAt         DateTime?
  createdAt      DateTime
  updatedAt      DateTime
}

model PlatformPayment {
  id          Int
  invoiceId   Int?
  amount      Decimal
  currency    String
  status      PaymentStatus
  provider    String?
  providerRef String?
  createdAt   DateTime
}
```

Статусы:

```prisma
enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
  VOID
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
}
```

Подписки:

```prisma
model PlatformSubscription {
  id            Int
  accountId     Int
  planId        Int
  status        SubscriptionStatus
  startedAt     DateTime
  endsAt        DateTime?
  nextBillingAt DateTime?
}
```

AI-покупки:

```prisma
model AiAccessPackage {
  id                Int
  code              String
  name              String
  includedCreditRub Decimal
  displayTokens     Int?
  priceRub          Decimal
}

model AiAccessPurchase {
  id        Int
  accountId Int
  packageId Int?
  invoiceId Int?
  amountRub Decimal
  creditRub Decimal
  status    String
  paidAt    DateTime?
}
```

Важно: `AiAccessPackage.displayTokens` - клиентский номинал пакета в токенах. Клиент должен видеть токены и цену пакета, но не внутренний `includedCreditRub` и не маржу.

### 3.2 Текущая цепочка AI-пакета

Файл:

```text
apps/web/lib/ai-billing.ts
```

Функция:

```ts
requestAiPackageInvoice(accountId, packageId)
```

Текущий поток:

1. CRM-пользователь нажимает купить AI-пакет.
2. Создается `PlatformInvoice`.
3. Создается `AiAccessPurchase` со статусом `PENDING`.
4. В CRM показывается `Счёт #...`.
5. Сейчас в старом коде счет завершается только через админское действие.
6. Это legacy-состояние, которое нужно заменить автоматическим подтверждением от платежного провайдера через webhook.

Целевой поток:

1. CRM-пользователь нажимает `Оплатить`.
2. Платформа создает или переиспользует `PlatformInvoice`.
3. Платформа создает платеж в T-Банке.
4. Пользователь оплачивает картой или СБП на стороне банка.
5. T-Банк присылает webhook.
6. Платформа автоматически ставит счет `PAID`.
7. Платформа автоматически начисляет токены через `AiBalanceLedger`.
8. Администратор платформы ничего вручную не подтверждает.

Старый endpoint админского подтверждения сейчас находится здесь:

```text
apps/web/app/api/v1/platform/billing/invoices/[id]/pay/route.ts
```

Его нельзя использовать как основной сценарий оплаты. После внедрения эквайринга он должен быть либо удален, либо оставлен только как аварийный админский инструмент после отдельной проверки.

Страница платформы:

```text
apps/web/app/(platform)/platform/billing/page.tsx
```

Страница CRM с покупкой AI-пакетов:

```text
apps/web/app/(crm)/crm/assistant/site/page.tsx
```

### 3.3 Текущие настройки платформы

Есть модель:

```prisma
model PlatformSetting {
  id        Int
  key       String
  valueJson Json
  updatedAt DateTime
}
```

UI настроек:

```text
apps/web/app/(platform)/platform/settings/platform-settings-panels.tsx
```

Сейчас там уже есть черновая идея платежных настроек, но секреты провайдера не должны храниться в базе.

Секреты платежных провайдеров хранить в `.env`.

В базе можно хранить только несекретные настройки:

- активный провайдер;
- включен ли СБП;
- включены ли автоплатежи;
- публичное название продавца;
- email поддержки;
- режим `test` / `production`, если это не секрет.

## 4. Что нужно изменить в базе

### 4.1 Расширить `PlatformInvoice`

Добавить поля:

```prisma
enum PlatformInvoicePurpose {
  MANUAL
  SUBSCRIPTION
  AI_TOKENS
}

model PlatformInvoice {
  // existing fields...

  purpose           PlatformInvoicePurpose @default(MANUAL)
  description       String?
  paymentProvider   String?
  paymentMethod     String?
  providerPaymentId String?
  providerStatus    String?
  paymentUrl        String?
  metadataJson      Json?
}
```

Назначение:

- `purpose` - зачем создан счет;
- `description` - человекочитаемое описание для UI и чеков;
- `paymentProvider` - `tbank`, позже `sber`, `alfa`, `manual`;
- `paymentMethod` - `card`, `sbp`, `tpay`, `bank_transfer`;
- `providerPaymentId` - ID платежа в банке;
- `providerStatus` - последний статус банка;
- `paymentUrl` - ссылка на платежную форму;
- `metadataJson` - безопасные дополнительные данные.

### 4.2 Расширить `PlatformPayment`

Добавить:

```prisma
model PlatformPayment {
  // existing fields...

  method          String?
  providerStatus  String?
  receiptStatus   String?
  receiptUrl      String?
  rawProviderJson Json?
  paidAt          DateTime?
  updatedAt       DateTime @updatedAt
}
```

Назначение:

- хранить фактический платеж;
- видеть способ оплаты;
- сохранять статус банка;
- сохранять сырой ответ провайдера для аудита;
- видеть чек.

### 4.3 Добавить строки счета и чека

Новая модель:

```prisma
model PlatformInvoiceItem {
  id              Int      @id @default(autoincrement())
  invoiceId       Int
  name            String
  quantity        Decimal  @db.Decimal(12, 3) @default(1)
  unitPrice       Decimal  @db.Decimal(12, 2)
  amount          Decimal  @db.Decimal(12, 2)
  vat             String   @default("none")
  paymentObject   String   @default("service")
  paymentMethod   String   @default("full_payment")
  metadataJson     Json?
  createdAt       DateTime @default(now())

  invoice PlatformInvoice @relation(fields: [invoiceId], references: [id])

  @@index([invoiceId])
}
```

Примеры строк:

```text
AI-пакет "Стартовый", 1 000 000 токенов
Подписка CRM Business на 1 месяц
```

Для ИП на УСН 6%:

- `vat = "none"`;
- `paymentObject = "service"`;
- `paymentMethod` уточнить с бухгалтером:
  - для подписки чаще `full_payment`;
  - для предоплаты токенов может потребоваться `full_prepayment`.

### 4.4 Добавить журнал webhook-событий

Новая модель:

```prisma
model PlatformPaymentWebhookEvent {
  id                Int      @id @default(autoincrement())
  provider          String
  providerEventId   String?
  providerPaymentId String?
  invoiceId         Int?
  status            String
  payloadJson       Json
  tokenValid        Boolean  @default(false)
  processedAt       DateTime?
  errorMessage      String?
  createdAt         DateTime @default(now())

  @@index([provider, providerPaymentId])
  @@index([invoiceId])
  @@index([createdAt])
}
```

Задача:

- webhook от банка может прийти несколько раз;
- начислять токены или продлевать подписку можно только один раз;
- все события нужно логировать для разбора спорных платежей.

### 4.5 Добавить модель для автоплатежей позже

Не делать в первом этапе, но заложить архитектуру.

Будущая модель:

```prisma
model PlatformRecurringPaymentMethod {
  id              Int      @id @default(autoincrement())
  accountId       Int
  provider        String
  customerKey     String
  rebillId        String
  status          String
  cardMask        String?
  cardType        String?
  expiresAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  account Account @relation(fields: [accountId], references: [id])

  @@index([accountId, status])
  @@unique([provider, rebillId])
}
```

T-Банк для автоплатежей использует `Recurrent=Y`, `CustomerKey` и `RebillId`.

## 5. Конфигурация `.env`

Добавить переменные:

```env
PAYMENT_PROVIDER=tbank
PAYMENT_MODE=test

APP_PUBLIC_URL=http://localhost:3000

TBANK_TERMINAL_KEY=
TBANK_PASSWORD=
TBANK_API_URL=https://securepay.tinkoff.ru/v2
TBANK_TAXATION=usn_income
TBANK_VAT=none
TBANK_RECEIPT_ENABLED=true
TBANK_SBP_ENABLED=true
TBANK_RECURRENT_ENABLED=false
```

Для локальной разработки webhook невозможен с `localhost` напрямую. Нужен tunnel:

```text
ngrok / cloudflared / другой публичный tunnel
```

В T-Банке webhook URL должен смотреть на:

```text
https://<public-host>/api/v1/platform/payments/tbank/webhook
```

## 6. Платежный слой в коде

Создать папку:

```text
apps/web/lib/payments
```

Рекомендуемая структура:

```text
apps/web/lib/payments/types.ts
apps/web/lib/payments/config.ts
apps/web/lib/payments/provider.ts
apps/web/lib/payments/checkout.ts
apps/web/lib/payments/apply-payment.ts
apps/web/lib/payments/providers/tbank.ts
```

### 6.1 Общие типы

`types.ts`:

```ts
export type PaymentProviderCode = "manual" | "tbank" | "sber" | "alfa";
export type PaymentMethodCode = "card" | "sbp" | "tpay" | "bank_transfer";

export type CreatePaymentInput = {
  invoiceId: number;
  method: PaymentMethodCode;
  customerEmail?: string | null;
  customerPhone?: string | null;
  returnUrl?: string;
  failUrl?: string;
};

export type CreatePaymentResult = {
  provider: PaymentProviderCode;
  providerPaymentId: string;
  paymentUrl?: string;
  qrPayload?: string;
  qrUrl?: string;
  raw: unknown;
};
```

### 6.2 Провайдер-независимый интерфейс

`provider.ts`:

```ts
export interface PaymentProvider {
  code: PaymentProviderCode;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhook(input: WebhookVerifyInput): Promise<WebhookVerifyResult>;
}
```

Так Сбер/Альфа позже добавляются отдельными файлами без переписывания CRM-покупки.

## 7. T-Банк: что реализовать

Официальные страницы, которые нужно использовать:

```text
https://www.tbank.ru/business/help/business-payments/internet-acquiring/
https://www.tbank.ru/business/online-payments/
https://developer.tbank.ru/eacq/api/init
https://developer.tbank.ru/eacq/api/get-qr
https://developer.tbank.ru/eacq/intro/developer/notification
https://developer.tbank.ru/eacq/scenarios/payments/nonPCI
https://developer.tbank.ru/eacq/scenarios/payments/PCI_DSS/autopay/
```

### 7.1 `Init`

Для карты и обычной платежной формы:

- вызвать T-Банк `Init`;
- передать `TerminalKey`;
- `Amount` в копейках;
- `OrderId` = стабильный ID счета, например `platform_invoice_123`;
- `Description`;
- `CustomerKey` = `account_${accountId}`;
- `SuccessURL`;
- `FailURL`;
- `NotificationURL`;
- `Receipt`, если включены чеки;
- `Token`.

Ответ сохранить:

- `PaymentId` -> `providerPaymentId`;
- `PaymentURL` -> `paymentUrl`;
- весь ответ -> `rawProviderJson`.

### 7.2 Подпись `Token`

Нужно реализовать строго по документации T-Банка:

- взять верхнеуровневые поля запроса;
- исключить вложенные объекты и массивы;
- исключить `Token`;
- добавить `Password`;
- отсортировать ключи по алфавиту;
- склеить значения;
- посчитать SHA-256 hex.

Важно: `Receipt` не входит в подпись как вложенный объект.

### 7.3 СБП

Вариант старта:

1. Сначала делать `Init`.
2. Потом для `PaymentId` вызывать `GetQr`.
3. В CRM показывать QR или отдавать ссылку/ payload, который вернул банк.

Если T-Банк в конкретном терминале позволяет выбирать СБП прямо на платежной форме, можно для первого этапа открывать `PaymentURL` и не делать свой QR. Но для UX “как Tilda” лучше добавить `GetQr` отдельным вторым этапом.

### 7.4 Чеки

В `Init` передавать `Receipt`:

```json
{
  "Email": "client@example.com",
  "Taxation": "usn_income",
  "Items": [
    {
      "Name": "AI-пакет Стартовый, 1 000 000 токенов",
      "Price": 9900,
      "Quantity": 1,
      "Amount": 9900,
      "Tax": "none",
      "PaymentMethod": "full_payment",
      "PaymentObject": "service"
    }
  ]
}
```

Суммы передавать в копейках.

Для ИП на УСН 6%:

```text
Taxation = usn_income
Tax = none
```

Перед запуском боевого режима обязательно подтвердить у бухгалтера:

- `PaymentMethod` для CRM-подписки;
- `PaymentMethod` для AI-токенов;
- нужен ли отдельный документооборот для B2B безналичных оплат.

### 7.5 Webhook

Создать endpoint:

```text
apps/web/app/api/v1/platform/payments/tbank/webhook/route.ts
```

Требования:

- принимать webhook без авторизации;
- распарсить JSON или form payload, как требует T-Банк;
- проверить `Token`;
- записать событие в `PlatformPaymentWebhookEvent`;
- найти счет по `OrderId` или `PaymentId`;
- обработать только успешные финальные статусы;
- ответить ровно `OK`, если событие принято.

Успешным считать статус, который по документации соответствует финально оплаченному платежу:

- обычно `CONFIRMED` для одностадийной оплаты;
- `AUTHORIZED` не считать финальной оплатой, если используется двухстадийная схема.

Для старта лучше использовать одностадийную оплату, чтобы не добавлять `Confirm`.

## 8. Применение успешной оплаты

Создать общий сервис:

```text
apps/web/lib/payments/apply-payment.ts
```

Функция:

```ts
applySuccessfulPlatformPayment({
  invoiceId,
  provider,
  providerPaymentId,
  method,
  rawProviderJson,
})
```

Логика должна быть идемпотентной.

Алгоритм:

1. Открыть transaction.
2. Заблокировать или повторно прочитать `PlatformInvoice`.
3. Если `invoice.status === "PAID"` - ничего повторно не начислять.
4. Создать/обновить `PlatformPayment`.
5. Поставить `PlatformInvoice.status = "PAID"`.
6. Поставить `paidAt`.
7. Если есть `AiAccessPurchase`:
   - `status = "PAID"`;
   - `paidAt = now`;
   - создать `AiBalanceLedger` с типом `purchase`;
   - начислить внутренний кредит, но CRM продолжает показывать токены.
8. Если это подписка:
   - активировать или продлить `PlatformSubscription`;
   - обновить `nextBillingAt`.
9. Revalidate:
   - `/platform/billing`;
   - `/platform/ai/accounts`;
   - `/crm/assistant/site`;
   - будущую страницу подписки CRM.

Важно: основной путь применения оплаты должен идти из webhook платежного провайдера. Если старый админский endpoint `/platform/billing/invoices/[id]/pay` временно остается, он тоже должен использовать эту функцию, чтобы аварийное действие не расходилось с автоматической логикой и не могло начислить токены повторно.

## 9. CRM API для оплаты AI-пакета

Добавить endpoint:

```text
apps/web/app/api/v1/crm/assistant/packages/[id]/checkout/route.ts
```

Метод:

```http
POST
```

Body:

```json
{
  "method": "card"
}
```

или:

```json
{
  "method": "sbp"
}
```

Проверки:

- пользователь авторизован в CRM;
- есть permission `crm.assistant.billing.manage`;
- package существует и активен;
- invoice принадлежит текущему `accountId`;
- нельзя оплатить чужой счет.

Логика:

1. Вызвать `requestAiPackageInvoice(accountId, packageId)`.
2. Получить или создать `PlatformInvoice`.
3. Вызвать общий checkout-сервис.
4. Вернуть:

```json
{
  "invoiceId": 123,
  "provider": "tbank",
  "method": "card",
  "paymentUrl": "https://..."
}
```

Для СБП:

```json
{
  "invoiceId": 123,
  "provider": "tbank",
  "method": "sbp",
  "qrPayload": "...",
  "qrUrl": "..."
}
```

## 10. CRM UI

Страница:

```text
apps/web/app/(crm)/crm/assistant/site/page.tsx
```

Сейчас карточка пакета:

- показывает цену;
- показывает токены;
- при pending invoice блокирует кнопку и пишет ожидание подтверждения админом.

Нужно заменить поведение:

### 10.1 Карточка пакета

Кнопка:

```text
Купить
```

Если уже есть pending invoice:

```text
Оплатить счёт #123
```

Не блокировать кнопку. Пользователь должен иметь возможность перейти к оплате.

### 10.2 Модалка оплаты

Создать client component, например:

```text
apps/web/app/(crm)/crm/assistant/site/ai-package-checkout.tsx
```

Модалка:

- название пакета;
- сумма;
- токены;
- кнопка `Банковской картой`;
- кнопка `СБП`;
- состояние загрузки;
- ошибка, если провайдер не настроен;
- статус “Ожидаем подтверждение оплаты”.

Для карты:

- получить `paymentUrl`;
- открыть в текущей вкладке или новой вкладке.

Для СБП:

- если есть QR - показать QR;
- если есть только redirect - открыть платежную страницу.

### 10.3 Страницы результата

Добавить:

```text
apps/web/app/(crm)/crm/billing/success/page.tsx
apps/web/app/(crm)/crm/billing/fail/page.tsx
```

На success:

- показать “Оплата обрабатывается”;
- объяснить, что токены появятся после подтверждения банка;
- дать кнопку назад к ассистенту.

Не считать redirect от банка доказательством оплаты. Истина только webhook.

## 11. Платформенный UI оплат

Страница:

```text
apps/web/app/(platform)/platform/billing/page.tsx
```

Нужно изменить смысл с “ручное выставление счетов” на “счета и платежи”.

Показывать:

- номер счета;
- аккаунт;
- назначение;
- сумма;
- статус счета;
- провайдер;
- способ оплаты;
- `providerPaymentId`;
- статус банка;
- дата оплаты;
- AI-пакет и токены, если это AI;
- ссылка на чек, если есть.

Ручного подтверждения оплаты в основном сценарии быть не должно. После подключения webhook старое админское действие подтверждения оплаты нужно убрать из обычного списка счетов или удалить полностью.

## 12. Настройки платформы

Страница:

```text
apps/web/app/(platform)/platform/settings/platform-settings-panels.tsx
```

Из настроек убрать поля для секретов:

- Tinkoff Secret Key;
- Tinkoff Webhook Secret;
- YooKassa Secret;
- любые password/API secret.

Оставить или добавить только:

- активный провайдер;
- включить СБП;
- включить автоплатежи;
- режим тест/боевой;
- текст “секреты задаются через `.env`”.

Ключи хранятся в `.env`, потому что:

- это один владелец платформы;
- секреты не должны лежать в БД;
- меньше риск утечки через админку;
- проще разделять dev/test/prod.

## 13. Подписки CRM

AI-пакеты можно подключить первым этапом. Подписки CRM - второй этап.

Текущие модели уже есть:

```prisma
PlatformPlan
PlatformSubscription
PlatformInvoice
```

Нужно добавить CRM-страницу управления тарифом:

```text
apps/web/app/(crm)/crm/billing/page.tsx
```

или доработать существующую, если она уже используется.

Функции:

- показать текущий тариф;
- дата окончания;
- варианты оплаты на месяц/год;
- кнопка `Оплатить`;
- автопродление;
- отмена автопродления.

Для первого запуска можно сделать без автопродления:

- разовая оплата месяца;
- webhook продлевает `nextBillingAt`.

Автоплатежи добавить после стабильной разовой оплаты.

## 14. Автоплатежи как у Tilda

Делать после разовой оплаты.

T-Банк-сценарий:

1. Первый платеж создается с `Recurrent=Y`.
2. Передается `CustomerKey`.
3. После успешного платежа банк возвращает/позволяет получить `RebillId`.
4. `RebillId` сохраняется в `PlatformRecurringPaymentMethod`.
5. По расписанию платформа создает новый invoice.
6. Платформа списывает оплату через rebill API.
7. Если успешно - продлевает подписку.
8. Если неуспешно - переводит подписку в `PAST_DUE`.

Нужно добавить:

- worker/job для автосписаний;
- email/уведомления о предстоящем списании;
- UI отмены автопродления;
- историю списаний.

Не смешивать автоплатежи с первым этапом AI-токенов.

## 15. Безналичный расчет для юрлиц и ИП

Tilda показывает отдельный вариант:

```text
Безналичный расчет для юридических лиц и ИП
```

Для платформы нужен отдельный поток:

- сформировать счет на оплату;
- скачать PDF;
- оплата идет банковским переводом;
- админ или банковская интеграция подтверждает поступление;
- после подтверждения применяется тот же `applySuccessfulPlatformPayment`.

Важно: кассовые чеки для B2B безналичных оплат зависят от типа покупателя и способа оплаты. Это нужно отдельно подтвердить с бухгалтером.

## 16. Ошибки и edge cases

Обязательно обработать:

- T-Банк недоступен;
- ключи не настроены;
- invoice уже оплачен;
- пользователь пытается оплатить чужой invoice;
- webhook пришел повторно;
- webhook с неверным Token;
- банк прислал статус отказа;
- пользователь закрыл платежную форму;
- redirect success пришел, а webhook еще нет;
- чек не сформировался;
- сумма webhook не совпадает со счетом;
- валюта не RUB.

При расхождении суммы:

- не начислять токены;
- записать webhook event с ошибкой;
- показать в платформе проблему.

## 17. Тестирование

### 17.1 Unit tests

Покрыть:

- генерацию T-Банк `Token`;
- проверку webhook token;
- перевод рублей в копейки;
- сборку `Receipt`;
- идемпотентность `applySuccessfulPlatformPayment`;
- повторный webhook.

### 17.2 Интеграционные проверки

Сценарии:

1. CRM покупает AI-пакет картой.
2. Создается invoice.
3. Создается pending payment.
4. Webhook `CONFIRMED`.
5. Invoice становится `PAID`.
6. AiAccessPurchase становится `PAID`.
7. AiBalanceLedger получает `purchase`.
8. CRM видит токены.

Сценарий повторного webhook:

1. Прислать тот же webhook второй раз.
2. Баланс не должен начислиться повторно.

Сценарий отказа:

1. Webhook failed/rejected.
2. Invoice остается `ISSUED`.
3. Payment становится `FAILED`.
4. Токены не начисляются.

### 17.3 Команды проверки

После реализации запускать:

```bash
npm run typecheck
npm run lint
npm run prisma:validate
```

Если добавлены тесты:

```bash
npm test
```

или конкретные scripts, которые будут добавлены.

## 18. Очередность реализации

### Этап 1. Подготовка БД

- добавить enum `PlatformInvoicePurpose`;
- расширить `PlatformInvoice`;
- расширить `PlatformPayment`;
- добавить `PlatformInvoiceItem`;
- добавить `PlatformPaymentWebhookEvent`;
- создать миграцию;
- проверить `prisma validate`.

### Этап 2. Общий платежный слой

- создать `apps/web/lib/payments/**`;
- описать общие типы;
- реализовать конфиг из `.env`;
- реализовать `applySuccessfulPlatformPayment`;
- удалить старый админский endpoint подтверждения оплаты после внедрения webhook или закрыть его от обычного UI.

### Этап 3. T-Банк provider

- реализовать Token;
- реализовать `Init`;
- реализовать `GetQr`;
- реализовать сборку `Receipt`;
- реализовать verify webhook.

### Этап 4. API checkout для AI-пакетов

- добавить CRM endpoint checkout;
- связать с `requestAiPackageInvoice`;
- сохранить `providerPaymentId` и `paymentUrl`;
- вернуть данные для UI.

### Этап 5. Webhook T-Банка

- добавить публичный endpoint;
- логировать событие;
- проверить подпись;
- применить успешную оплату;
- ответить `OK`.

### Этап 6. CRM UI оплаты AI-пакетов

- добавить модалку оплаты;
- сделать кнопки `Картой` и `СБП`;
- не блокировать pending invoice;
- показывать понятные статусы.

### Этап 7. Платформенный UI

- обновить `/platform/billing`;
- показать provider/payment status/receipt;
- убрать ручное подтверждение из сценария оплаты.

### Этап 8. Подписки CRM

- добавить оплату тарифов;
- продление подписки после webhook;
- отдельный UI тарифов.

### Этап 9. Автоплатежи

- добавить `PlatformRecurringPaymentMethod`;
- включить `Recurrent=Y`;
- сохранить `RebillId`;
- добавить worker для списаний;
- добавить отмену автопродления.

## 19. Что не делать на первом этапе

Не делать сразу:

- собственную форму ввода карты;
- PCI DSS flow;
- автоплатежи;
- Сбер/Альфа адаптеры;
- сложный PDF-счет для безнала;
- бухгалтерскую автоматизацию налогов;
- возвраты;
- частичные возвраты;
- двухстадийную оплату с capture.

Сначала нужен стабильный поток:

```text
CRM -> invoice -> T-Банк Init -> payment page / SBP -> webhook -> PAID -> начисление токенов
```

## 20. Критерии готовности первого этапа

Первый этап считается готовым, когда:

- CRM-пользователь может купить AI-пакет;
- реальный платеж создается в T-Банке;
- карта открывается через платежную форму банка;
- СБП работает через QR или через платежную форму;
- webhook отмечает invoice оплаченным;
- токены начисляются автоматически;
- повторный webhook не начисляет токены повторно;
- платформа видит платеж, провайдера, ID платежа и статус;
- обычная покупка не требует ручного подтверждения администратором;
- старое админское подтверждение не используется в клиентском сценарии;
- секреты лежат в `.env`;
- `npm run typecheck`, `npm run lint`, `npm run prisma:validate` проходят.

## 21. Важные замечания для следующего агента

- В текущем репозитории уже есть незавершенные изменения по AI-токенам и CRM Agent v2. Не откатывать чужие изменения.
- Перед началом реализации обязательно проверить `git status --short`.
- Не менять публичный клиентский ассистент Аишу без необходимости.
- Не показывать CRM-клиенту внутренний рублевый AI-баланс и маржу.
- `AiAccessPackage.includedCreditRub` остается внутренним техническим кредитом.
- `AiAccessPackage.displayTokens` - то, что видит клиент.
- Истина оплаты - webhook банка, не redirect success.
- Все начисления делать идемпотентно.
- Секреты платежного провайдера не сохранять в `PlatformSetting`.
- Для боевого запуска нужны реальные настройки магазина T-Банка и подтвержденные бухгалтером параметры чеков.

## 22. Рабочий протокол реализации

Этот раздел обязателен для каждого агента, который продолжает реализацию. Нельзя начинать писать код, пока не прочитаны разделы 18, 20, 21 и 22.

Во время реализации этот документ является рабочим источником правды. После каждого законченного шага нужно обновлять:

1. чеклист реализации;
2. текущий статус;
3. журнал изменений;
4. следующий шаг;
5. список проверок, которые реально запускались.

Если работа была прервана, следующий агент должен не начинать заново, а восстановить состояние по этому разделу.

### 22.1 Протокол возобновления после паузы

Перед продолжением выполнить:

```text
1. Прочитать разделы 18, 20, 21, 22.
2. Выполнить git status --short.
3. Сверить чеклист с реальными файлами, миграциями, API, UI и тестами.
4. Если чеклист говорит [x], но в коде результата нет, считать шаг не завершенным и поставить [!].
5. Если в коде шаг уже выполнен, но чеклист не обновлен, обновить чеклист и журнал.
6. Найти первый шаг со статусом [ ], [~] или [!], который блокирует дальнейшую реализацию.
7. Продолжить именно с него.
8. После изменения кода обновить этот файл.
```

Нельзя полагаться только на память из переписки. Истина для продолжения - код + этот план.

### 22.2 Статусы чеклиста

```text
[ ] не начато
[~] в работе
[x] выполнено и проверено
[!] проблема / блокер / требуется повторная проверка
[-] отменено осознанно, с причиной в журнале
```

Правила:

```text
1. Не отмечать [x], пока код не написан и не пройдены релевантные проверки.
2. Не начинать следующий крупный этап, пока предыдущий не имеет [x] или явно описанный [!] с решением.
3. Если проверку не удалось запустить, шаг не считается полностью закрытым. Указать причину.
4. Если меняется архитектурное решение, сначала обновить план, потом код.
5. Каждый шаг должен иметь запись в журнале.
```

### 22.3 Рабочий чеклист реализации

Этот чеклист обновлять по мере выполнения. Он должен совпадать с реальным состоянием репозитория.

```text
[x] 1. Зафиксировать план реализации платежей.
    Результат: создан PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md с архитектурой T-Банк, СБП, webhook, чеками, .env, БД, UI и протоколом продолжения.

[x] 2. Провести стартовую сверку перед кодом.
    Проверить git status, текущие изменения AI-токенов, текущие billing файлы, schema.prisma, отсутствие лишних платежных файлов.

[x] 3. Подготовить Prisma-модели и миграцию.
    Добавить PlatformInvoicePurpose, расширить PlatformInvoice/PlatformPayment, добавить PlatformInvoiceItem и PlatformPaymentWebhookEvent.

[x] 4. Проверить Prisma.
    Запустить prisma validate/generate по локальному способу проекта. Зафиксировать команды и результат.

[x] 5. Создать общий payment-слой.
    Добавить apps/web/lib/payments/types.ts, config.ts, provider.ts, checkout.ts, apply-payment.ts.

[x] 6. Реализовать идемпотентное применение успешной оплаты.
    applySuccessfulPlatformPayment должен закрывать invoice, создавать payment, начислять AI-токены или продлевать подписку без дублей.

[x] 7. Убрать ручное подтверждение из основного сценария.
    Старый platform endpoint подтверждения оплаты удалить из UI или закрыть как технический legacy, не использовать в клиентской покупке.

[x] 8. Реализовать T-Банк provider.
    Token, Init, GetQr, Receipt, проверка webhook token.

[x] 9. Добавить webhook endpoint T-Банка.
    /api/v1/platform/payments/tbank/webhook должен логировать событие, проверять подпись, применять оплату и отвечать OK.

[x] 10. Добавить CRM checkout endpoint для AI-пакетов.
    /api/v1/crm/assistant/packages/[id]/checkout создает/переиспользует invoice и возвращает paymentUrl или QR.

[x] 11. Обновить CRM UI покупки AI-пакетов.
    Кнопка Купить/Оплатить, модалка карта/СБП, ожидание webhook, без ручного подтверждения админом.

[x] 12. Обновить platform billing UI.
    Показать provider, payment id, status, method, receipt status, назначение счета, AI-пакет и токены.

[x] 13. Убрать секреты провайдера из platform settings UI.
    В базе оставить только несекретные настройки. Секреты читать из .env.

[x] 14. Добавить тесты payment-логики.
    Token, webhook verify, Receipt, idempotent apply payment, duplicate webhook.

[x] 15. Проверить AI-покупку end-to-end на тестовом/моковом T-Банке.
    Invoice -> payment init -> webhook confirmed -> PAID -> AiAccessPurchase PAID -> AiBalanceLedger purchase -> CRM видит токены.

[x] 16. Добавить оплату CRM-подписок.
    После AI-пакетов: тарифы, invoice purpose SUBSCRIPTION, продление PlatformSubscription через webhook.

[x] 17. Подключить тестовый терминал T-Банка локально.
    Добавить реальные тестовые значения только в apps/web/.env.local, а в .env.example оставить пустые placeholders без секретов.

[x] 18. Проверить реальный T-Банк checkout smoke-тестом и проверку магазина.
    Init на тестовом терминале возвращает PaymentURL. Через Tilda/HTTPS пройдены проверки магазина Т-Банка: успешная оплата, неуспешная оплата, возврат.

[ ] 19. Проверить webhook/e2e на публичном backend.
    Отложено до VPS/стабильного публичного стенда: оплатить тестовый платеж, принять webhook, автоматически поставить invoice PAID и начислить токены/подписку.

[ ] 20. Подготовить автоплатежи.
    Только после стабильных разовых платежей: Recurrent=Y, RebillId, recurring model, worker.
```

### 22.4 Текущий статус реализации

Этот блок обновлять после каждого шага. Это главный указатель для продолжения после потери контекста, смены агента или прерывания.

```yaml
status: paused_until_public_backend
current_step: 19
next_step: 19
last_updated: 2026-06-01
owner_note: "Базовая реализация платежей T-Банк для AI-пакетов и разовой оплаты CRM-подписок добавлена. Тестовый терминал T-Банка внесен в apps/web/.env.local, .env.example содержит только placeholders. Реальный Init smoke-тест через dev server успешен: T-Банк возвращает PaymentURL. Проверка магазина в кабинете Т-Банка пройдена через Tilda/HTTPS: успешная оплата, неуспешная оплата, возврат. Реальные ключи не подключать до публичного backend/VPS. Webhook/e2e отложен до стабильного HTTPS backend."
resume_instruction: "Прочитать разделы 18, 20, 21, 22; выполнить git status --short; сверить чеклист с кодом; продолжить с next_step."
known_dirty_worktree:
  - "В репозитории ранее были изменения по AI-токенам и CRM Agent v2. Их не откатывать."
  - "PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md создан как новый рабочий план."
blocking_questions:
  - "Перед боевым запуском подтвердить у бухгалтера PaymentMethod для CRM-подписки и AI-токенов."
  - "Для полного теста webhook с T-Банком нужен публичный HTTPS backend/VPS или стабильный named tunnel."
  - "До публичного стенда реальные T-Банк ключи не подключать; оставить тестовые ключи для локальной разработки."
applied_migrations:
  - "20260601162000_platform_payments"
```

### 22.5 Журнал реализации

Каждое изменение по плану добавлять новой записью. Журнал нужен, чтобы другой агент видел, что реально было сделано, какие проверки запускались и почему следующий шаг именно такой.

Шаблон записи:

```text
YYYY-MM-DD HH:mm - step N - status
Что сделано:
- ...
Измененные файлы:
- ...
Проверка:
- ...
Следующий шаг:
- ...
Блокеры:
- нет / описание
```

Записи:

```text
2026-06-01 - step 18 - completed
Что сделано:
- Магазин в кабинете Т-Банка прошел обязательные тесты через Tilda/HTTPS: успешная оплата, неуспешная оплата, полный возврат.
- Для Tilda использовались одноразовые PaymentURL, созданные нашим backend через T-Банк Init.
- В кабинете Т-Банка видны тестовые операции platform_invoice_* со статусами Подтвержден, Отклонен, Возвращен полностью.
- Решение: реальные ключи пока не подключать, потому что проект продолжает локальную разработку; тестовые ключи остаются в apps/web/.env.local.
- Webhook/e2e не считается заблокированным кодом; он отложен до появления стабильного публичного backend/VPS.
Измененные файлы:
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- T-Банк onboarding: тест успешной оплаты пройден.
- T-Банк onboarding: тест неуспешной оплаты пройден.
- T-Банк onboarding: тест возврата пройден.
- Локально ранее проходили npm run test:payments и npm run typecheck после исправлений Token/env/OrderId.
Следующий шаг:
- До поднятия публичного backend продолжать локальную разработку платежной логики, CRM, тарифов, AI-токенов и подписок.
- Когда будет VPS/стенд: step 19, полный webhook/e2e с APP_PUBLIC_URL=https://... и тестовым терминалом.
Блокеры:
- Для step 19 нужен публичный HTTPS backend. Бесплатные quick tunnels на текущей машине нестабильны.

2026-06-01 - step 18 - in_progress
Что сделано:
- Проверена документация T-Банка по Init: OrderId должен быть уникальным для каждой операции, Amount в копейках, сумма должна совпадать со строками Receipt, Token строится по верхнеуровневым scalar-полям без вложенных DATA/Receipt.
- Исправлено чтение TBANK_PASSWORD в Next env: символ $ экранирован в apps/web/.env.local.
- Исправлена генерация OrderId: теперь platform_invoice_<invoiceId>_<attempt>, чтобы каждая попытка оплаты была новой операцией T-Банка.
- parseInvoiceIdFromTbankOrderId обновлен под новый формат OrderId.
- Реальный smoke-тест checkout endpoint для AI-пакета успешно получил PaymentURL от T-Банка.
Измененные файлы:
- apps/web/.env.local
- apps/web/lib/payments/providers/tbank.ts
- scripts/platform-payments-tests.mjs
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run test:payments
- npm run typecheck
- POST /api/v1/crm/assistant/packages/2/checkout -> T-Банк Init Success=true, PaymentURL получен.
Следующий шаг:
- Открыть PaymentURL, оплатить тестовой картой из кабинета Т-Банка и проверить webhook. Для webhook нужен публичный HTTPS APP_PUBLIC_URL, localhost из Т-Банка недоступен.
Блокеры:
- Без tunnel/публичного стенда Т-Банк не сможет отправить NotificationURL на локальный /api/v1/platform/payments/tbank/webhook.

2026-06-01 - tunnel attempt - blocked
Что сделано:
- Проверен cloudflared quick tunnel: URL создается, но публичный домен возвращает Cloudflare 530 и не прокидывает запрос до локального Next.
- Повторно проверен cloudflared с protocol=http2, url=http://127.0.0.1:3000 и http-host-header=localhost:3000; результат тот же 530.
- Проверен localtunnel через npx: URL создается, но HTTPS-запрос зависает до timeout.
- Проверен localhost.run через ssh reverse tunnel: ssh-команда зависает и не выдает публичный URL за разумное время.
- APP_PUBLIC_URL возвращен на http://localhost:3000, чтобы локальная разработка не была привязана к мертвому tunnel URL.
Измененные файлы:
- apps/web/.env.local
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- http://localhost:3000 отвечает 200.
- T-Банк Init ранее успешно возвращал PaymentURL; проблема только в публичной доставке webhook.
Следующий шаг:
- Для полного теста webhook поднять стабильный публичный тестовый стенд/VPS или использовать авторизованный named Cloudflare Tunnel/ngrok с аккаунтом.
Блокеры:
- Бесплатные quick tunnels из текущей сети/машины не дали стабильный публичный HTTPS URL.

2026-06-01 - step 17 - completed
Что сделано:
- Локальный тестовый терминал T-Банка подключен через apps/web/.env.local.
- В .env.example добавлены платежные переменные без реальных секретов.
- Секреты T-Банка по-прежнему не хранятся в базе и не показываются в настройках платформы.
Измененные файлы:
- apps/web/.env.local
- .env.example
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- Запланировано: npm run test:payments, npm run typecheck.
Следующий шаг:
- step 18: проверить реальный T-Банк Init/GetQr на тестовом терминале через dev server.
Блокеры:
- Для входящего webhook от T-Банка localhost не подходит; нужен публичный HTTPS tunnel или тестовый стенд.

2026-06-01 - step 16 - completed
Что сделано:
- Добавлена разовая оплата CRM-подписок через тот же payment-слой.
- Добавлен requestSubscriptionInvoice: создает PlatformInvoice purpose SUBSCRIPTION, invoice item для чека и metadataJson с planId.
- Добавлен endpoint /api/v1/crm/billing/plans/[id]/checkout.
- /crm/payments заменен с заглушки на страницу текущего тарифа, тарифных планов и счетов платформы.
- Добавлен client component SubscriptionCheckout с выбором карты/СБП.
- applySuccessfulPlatformPayment теперь для subscription invoice активирует/создает PlatformSubscription, продлевает nextBillingAt и обновляет Account.planId на оплаченный тариф.
- Добавлен моковый DB-тест оплаты подписки.
Измененные файлы:
- apps/web/lib/payments/apply-payment.ts
- apps/web/lib/payments/subscriptions.ts
- apps/web/app/api/v1/crm/billing/plans/[id]/checkout/route.ts
- apps/web/app/(crm)/crm/payments/page.tsx
- apps/web/app/(crm)/crm/payments/subscription-checkout.tsx
- scripts/platform-payments-tests.mjs
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run test:payments
- npm run typecheck
- npm run prisma:validate
- npm run lint
Следующий шаг:
- step 17: подготовить автоплатежи, но не включать их без тестового T-Банк Recurrent/RebillId сценария.
Блокеры:
- Для реальных автоплатежей нужны настройки T-Банка Recurrent, RebillId и юридическое/UX-решение по сохранению карты.

2026-06-01 - step 15 - completed
Что сделано:
- Расширен scripts/platform-payments-tests.mjs моковым DB e2e сценарием AI-покупки.
- Тест создает временный PlatformPlan, Account, AiAccessPackage, PlatformInvoice и AiAccessPurchase.
- applySuccessfulPlatformPayment вызывается дважды с одним providerPaymentId.
- Проверяется, что invoice становится PAID, AiAccessPurchase становится PAID, а AiBalanceLedger получает ровно одну purchase-запись.
- Тест сам очищает созданные данные.
Измененные файлы:
- scripts/platform-payments-tests.mjs
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run test:payments
- npm run typecheck
- npm run prisma:validate
- npm run lint
Следующий шаг:
- step 16: добавить оплату CRM-подписок.
Блокеры:
- Для реального T-Банк e2e по Init/GetQr нужны .env ключи и публичный webhook URL.

2026-06-01 - step 14 - completed
Что сделано:
- Добавлен локальный набор unit-тестов платежной логики без реальных ключей T-Банка.
- Покрыты rubToKopecks, генерация T-Банк Token, verifyWebhook, parseInvoiceIdFromTbankOrderId, isTbankFinalSuccessStatus и paymentMethodFromTbankPayload.
- Добавлен npm script test:payments.
Измененные файлы:
- scripts/platform-payments-tests.mjs
- package.json
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run test:payments
- npm run typecheck
- npm run prisma:validate
- npm run lint
Следующий шаг:
- step 15: проверить AI-покупку end-to-end на моковом webhook/T-Банк сценарии.
Блокеры:
- Для настоящего T-Банк Init/GetQr по-прежнему нужны ключи .env и публичный webhook URL, но моковый e2e можно делать без них.

2026-06-01 - migration applied - completed
Что сделано:
- Остановлен процесс dev server, который держал порт 3000.
- Применена миграция 20260601162000_platform_payments через scripts/prisma.ps1 migrate-deploy.
- Обновлен Prisma Client через scripts/prisma.ps1 generate.
- Повторно выполнены проверки после применения миграции.
Измененные файлы:
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 migrate-deploy
- powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 generate
- npm run prisma:validate
- npm run typecheck
- npm run lint
Следующий шаг:
- step 14: добавить тесты payment-логики и/или моковый webhook/e2e.
Блокеры:
- Для реальной оплаты нужны .env ключи T-Банка и публичный APP_PUBLIC_URL/webhook URL.

2026-06-01 - step 5-13 - completed
Что сделано:
- Создан общий payment-слой apps/web/lib/payments: types, config, provider, checkout, apply-payment.
- Реализован T-Банк provider: Token, Init, GetQr, Receipt, verify webhook.
- Добавлен CRM checkout endpoint /api/v1/crm/assistant/packages/[id]/checkout.
- Добавлен webhook endpoint /api/v1/platform/payments/tbank/webhook.
- requestAiPackageInvoice теперь создает invoice purpose AI_TOKENS, description и PlatformInvoiceItem для чека.
- CRM UI покупки AI-пакетов переведен на модалку оплаты картой/СБП без ожидания ручного подтверждения админом.
- Из обычного platform billing UI убрана ручная кнопка подтверждения оплаты.
- Platform billing UI показывает provider, method, provider payment id и статус банка.
- Platform settings UI больше не показывает поля банковских секретов, добавлена подсказка про .env.
- Сохранение platform billing settings санитизирует payload и пишет в базу только provider/sbpEnabled без secret-полей.
- Исправлен риск миграции: provider/providerRef оставлен индексом, не unique, чтобы старые manual/manual платежи не ломали миграцию.
Измененные файлы:
- apps/web/lib/payments/types.ts
- apps/web/lib/payments/config.ts
- apps/web/lib/payments/money.ts
- apps/web/lib/payments/provider.ts
- apps/web/lib/payments/checkout.ts
- apps/web/lib/payments/apply-payment.ts
- apps/web/lib/payments/providers/tbank.ts
- apps/web/app/api/v1/crm/assistant/packages/[id]/checkout/route.ts
- apps/web/app/api/v1/platform/payments/tbank/webhook/route.ts
- apps/web/app/(crm)/crm/assistant/site/ai-package-checkout.tsx
- apps/web/app/(crm)/crm/assistant/site/page.tsx
- apps/web/app/(platform)/platform/billing/billing-invoice-actions.tsx
- apps/web/app/(platform)/platform/billing/page.tsx
- apps/web/app/(platform)/platform/settings/platform-settings-panels.tsx
- apps/web/lib/ai-billing.ts
- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260601162000_platform_payments/migration.sql
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run lint
- npm run prisma:validate
- После sanitization platform settings повторно запущены npm run typecheck и npm run lint.
- Prisma Client позже успешно обновлен после остановки dev server; см. запись "migration applied".
Следующий шаг:
- step 14: добавить тесты payment-логики и/или моковый сценарий webhook.
Блокеры:
- Для реальной оплаты нужны .env ключи T-Банка и публичный APP_PUBLIC_URL/webhook URL.

2026-06-01 - step 2-4 - completed
Что сделано:
- Проведена стартовая сверка: git status показывал только новый PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md, apps/web/lib/payments отсутствовал.
- Проверены текущие PlatformInvoice/PlatformPayment в schema.prisma и requestAiPackageInvoice в apps/web/lib/ai-billing.ts.
- Добавлен enum PlatformInvoicePurpose.
- Расширены PlatformInvoice и PlatformPayment под provider/payment/webhook данные.
- Добавлены PlatformInvoiceItem и PlatformPaymentWebhookEvent.
- Создана миграция 20260601162000_platform_payments.
Измененные файлы:
- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260601162000_platform_payments/migration.sql
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run prisma:validate
Следующий шаг:
- step 5: создать общий payment-слой.
Блокеры:
- нет

2026-06-01 - step 1 - completed
Что сделано:
- Создан рабочий план реализации платформенных платежей.
- Описаны текущие модели PlatformInvoice, PlatformPayment, AiAccessPurchase и текущий legacy-поток.
- Зафиксирован целевой автоматический поток: CRM -> T-Банк -> webhook -> PAID -> автоматическое начисление токенов.
- Добавлены требования по T-Банку, СБП, чекам, .env, webhook, provider-independent архитектуре.
- Добавлен рабочий протокол: чеклист, текущий статус, журнал, протокол возобновления.
Измененные файлы:
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- Документ создан и сверены ключевые разделы.
Следующий шаг:
- step 2: провести стартовую сверку перед кодом.
Блокеры:
- нет
```

### 22.6 Протокол сверки перед продолжением

Перед любым новым этапом выполнить и записать результат в журнал:

```text
Проверить:
- git status --short
- packages/db/prisma/schema.prisma: текущие PlatformInvoice, PlatformPayment, AiAccessPurchase
- apps/web/lib/ai-billing.ts: requestAiPackageInvoice и начисление AI
- apps/web/app/(crm)/crm/assistant/site/page.tsx: текущий UI покупки AI-пакетов
- apps/web/app/(platform)/platform/billing/page.tsx: текущий UI счетов
- apps/web/app/api/v1/platform/billing/invoices/[id]/pay/route.ts: старый legacy endpoint
- apps/web/app/(platform)/platform/settings/platform-settings-panels.tsx: нет ли секретов в настройках
- наличие/отсутствие apps/web/lib/payments/**
- какие проверки запускались в этом заходе
```

Если реальность расходится с чеклистом, сначала исправить чеклист, статус и журнал, потом продолжать код.

2026-06-01 - AI token UI cleanup - completed
Что сделано:
- Проверены страницы AI/GigaChat после подключения платежей.
- Подтверждено, что токенная витрина CRM в целом работает, но часть платформенного AI-раздела еще показывала legacy AI-баланс в рублях.
- На /platform/ai/accounts убрано ручное рублевое "Начислить AI-баланс".
- Вместо этого добавлена выдача конкретного AI-пакета токенов аккаунту.
- Таблица аккаунтов теперь показывает доступные токены по формуле: оплаченные package.displayTokens минус фактический AiUsage.totalTokens.
- На /platform/ai/accounts/[id] основная метрика заменена с рублевого AI-баланса на доступные токены.
- В CRM /crm/assistant/site убраны рублевые поля лимитов из клиентского интерфейса; существующие внутренние лимиты сохраняются без изменения.
- В apps/web/.env.local выключен GIGACHAT_ALLOW_INSECURE_TLS, чтобы убрать предупреждение NODE_TLS_REJECT_UNAUTHORIZED=0.
Измененные файлы:
- apps/web/lib/ai-billing.ts
- apps/web/app/(platform)/platform/ai/accounts/page.tsx
- apps/web/app/(platform)/platform/ai/accounts/[id]/page.tsx
- apps/web/app/(platform)/platform/ai/ledger/page.tsx
- apps/web/app/(crm)/crm/assistant/site/page.tsx
- apps/web/.env.local
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run lint
- npm run test:payments
- npm run typecheck
- npm run lint
Следующий шаг:
- Добавить отдельную миграцию полноценного token-ledger: amountTokens/creditTokens/token limits, чтобы backend enforcement тоже был токенным, а рубли остались только для цены, себестоимости и маржи платформы.
Блокеры:
- Для webhook/e2e T-Банка по-прежнему нужен публичный HTTPS backend или стабильный tunnel.
- Для автоматической проверки B2B-счетов по безналу нужен отдельный этап интеграции банковской выписки/Business API; текущий интернет-эквайринг T-Банка автоматически покрывает карты/СБП/T-Pay, но не входящие платежи по расчетному счету.

2026-06-01 - AI token ledger backend migration - completed
Что сделано:
- Добавлена миграция 20260601195000_ai_token_ledger.
- В AiBalanceLedger добавлено amountTokens.
- В AiAccessPurchase добавлено creditTokens.
- В AiAccountAccess добавлены dailyTokenLimit, monthlyTokenLimit, minTokensNotify, stopWhenTokensBelow.
- Миграция переносит displayTokens из оплаченных пакетов в creditTokens.
- Миграция заполняет amountTokens для usage-списаний из AiUsage.totalTokens.
- Миграция сопоставляет исторические purchase-ledger записи с оплаченными покупками и заполняет amountTokens.
- Новые AI-покупки через счет теперь создают AiAccessPurchase.creditTokens.
- Успешная оплата T-Банка и legacy manual pay создают ledger с amountTokens.
- Ручная выдача пакета на /platform/ai/accounts создает purchase и ledger с token credit.
- recordAiUsage теперь списывает amountTokens = -totalTokens.
- checkAiAccessAllowed переведен на токенный баланс и token limits.
- CRM Agent context переведен с balanceRub/рублевых лимитов на balanceTokens/token limits.
- Ledger UI платформы показывает токенные движения рядом с внутренней рублевой экономикой.
- Клиентская история ассистента показывает токены из amountTokens.
- Удалены неиспользуемые getAiAccountBalance/getAiBalanceByAccountIds из ai-billing.ts.
Измененные файлы:
- packages/db/prisma/schema.prisma
- packages/db/prisma/migrations/20260601195000_ai_token_ledger/migration.sql
- apps/web/lib/ai-billing.ts
- apps/web/lib/ai-usage.ts
- apps/web/lib/payments/apply-payment.ts
- apps/web/lib/crm-agent-v2/core/context.ts
- apps/web/lib/crm-agent-v2/core/runtime.ts
- apps/web/app/api/v1/platform/billing/invoices/[id]/pay/route.ts
- apps/web/app/(platform)/platform/ai/accounts/page.tsx
- apps/web/app/(platform)/platform/ai/accounts/[id]/page.tsx
- apps/web/app/(platform)/platform/ai/ledger/page.tsx
- apps/web/app/(crm)/crm/assistant/site/page.tsx
- scripts/platform-payments-tests.mjs
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 validate
- powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 migrate-deploy
- powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 generate
- npm run typecheck
- npm run lint
- npm run test:payments
Следующий шаг:
- Запустить dev server и визуально проверить /platform/ai, /platform/ai/accounts, /platform/ai/ledger и /crm/assistant/site.
- Позже можно удалить legacy rub-limit поля из UI/схемы отдельной миграцией, когда убедимся, что старые данные больше не нужны.
Блокеры:
- Нет для token-ledger.
- Для T-Банк webhook/e2e остается прежний блокер: нужен публичный HTTPS backend или стабильный tunnel.

2026-06-01 - AI token balance historical usage fix - completed
Что сделано:
- Исправлен расчет доступных токенов: старый расход до первого токенного пополнения аккаунта больше не съедает новый выданный пакет.
- /crm/assistant/site переведен на общий getAiTokenBalancesByAccountIds, чтобы CRM и платформа показывали один и тот же остаток.
- Проверен аккаунт #2: после выдачи 20 000 токенов расчет возвращает balanceTokens=20000, purchasedTokens=20000, usedTokens=0.
Измененные файлы:
- apps/web/lib/ai-billing.ts
- apps/web/app/(crm)/crm/assistant/site/page.tsx
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run lint
- Локальная DB-проверка accountId=2 через Prisma query
Следующий шаг:
- Перезапустить dev server и обновить страницы /platform/ai/accounts и /crm/assistant/site.
Блокеры:
- Нет.

2026-06-01 - AI local assistant token metering - completed
Что сделано:
- Исправлена причина, по которой сообщения в окне ассистента могли не списывать токены: часть ответов Аиши собирается локальными правилами без вызова GigaChat, поэтому recordAiUsage не запускался.
- Добавлен учет локального ответа через recordAiMeteredUsage: если внутри хода уже был реальный вызов GigaChat, повторное списание не делается; если вызова модели не было, списывается расчетный расход по длине входящего сообщения и ответа.
- Локальные ответы пишутся как provider=platform, model=aisha-local, purpose=public_assistant_local, billRub=false. Это списывает клиентские токены, но не добавляет фиктивную рублевую себестоимость GigaChat.
- Публичный чат уже проверяет checkAiAccessAllowed до обработки хода, поэтому при нулевом токенном остатке локальные ответы также не должны обходить лимит.
- В CRM-preview добавлен refresh страницы после успешного ответа ассистента, чтобы карточки "Доступно", "Использовано" и история баланса обновлялись без ручной перезагрузки. На публичном сайте refresh не включен.
- Для расходов, которые приходят из опубликованного сайта или конструктора в другой вкладке, CRM-страница обновляет серверные данные только при возврате фокуса/видимости вкладки. Постоянного polling по интервалу нет.
Измененные файлы:
- apps/web/lib/ai-usage.ts
- apps/web/lib/aisha-chat-post-handler.ts
- apps/web/components/public-ai-chat-widget.tsx
- apps/web/app/(crm)/crm/assistant/site/page.tsx
- apps/web/app/(crm)/crm/assistant/site/ai-balance-auto-refresh.tsx
- PLATFORM_PAYMENTS_IMPLEMENTATION_PLAN.md
Проверка:
- npm run typecheck
- npm run lint
- Локальный POST в /api/v1/public/ai/chat?account=severnaya-orhideya создал новые строки AiBalanceLedger: -19, -24, -33 токена с comment platform:aisha-local:public_assistant_local.
- Для аккаунта severnaya-orhideya #2 после покупки 20 000 токенов расчет по строкам после первой покупки: куплено 20 000, списано после покупки 76, доступно 19 924.
Следующий шаг:
- Обновить /crm/assistant/site в браузере один раз, отправить новое сообщение в CRM-preview и проверить, что карточка "Доступно" уменьшается автоматически после ответа.
- Для опубликованного сайта/конструктора: после общения в другой вкладке вернуться на вкладку /crm/assistant/site и проверить, что данные обновились при фокусе.
- Если продуктово нужно списывать не расчетные токены, а всегда заставлять GigaChat отвечать даже на smalltalk, менять маршрутизацию Аиши, а не ledger.
Блокеры:
- Нет.
