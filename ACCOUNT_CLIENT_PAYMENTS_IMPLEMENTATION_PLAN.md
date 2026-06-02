# Account Client Payments: подробный план реализации

## 1. Цель

CRM-аккаунты должны принимать реальные оплаты от своих клиентов за записи, услуги, предоплаты, депозиты и будущие онлайн-продажи.

Это отдельный платежный контур, не тот же самый, что уже сделан для оплаты CRM/AI-токенов платформе.

- `Platform payments`: бизнес-аккаунт платит платформе за CRM, подписку, AI-токены.
- `Account client payments`: клиент салона платит самому салону за услугу или запись.

Деньги клиента салона не должны идти на ИП платформы. Они должны идти на платежное подключение конкретного CRM-аккаунта: ЮKassa, Сбер, T-Банк или Альфа-Банк.

## 2. Термины в интерфейсе

Не использовать слово `магазин` как основной термин в интерфейсе платформы. У платежных провайдеров это технический термин, но для владельца салона он звучит неправильно.

Правильные названия в CRM:

- `Платежное подключение`
- `Провайдер оплаты`
- `Идентификатор подключения`
- `Секретный ключ`
- `URL уведомлений`
- `Онлайн-касса и чеки`
- `Тестовый режим`
- `Рабочий режим`

Подсказки по провайдерам:

- ЮKassa: `Идентификатор подключения`, подсказка: `В кабинете ЮKassa это shopId / номер магазина`.
- T-Банк: `Terminal Key`, `Пароль терминала`.
- Сбер: `API-логин`, `API-пароль`, `версия шлюза`.
- Альфа-Банк: `API-логин`, `API-пароль`.

## 3. Провайдеры, которые нужно заложить сразу

Архитектура должна поддерживать четыре провайдера с первого этапа, даже если реализовывать их будем по очереди.

| Провайдер | Что принимает | Основные данные подключения | Приоритет |
| --- | --- | --- | --- |
| ЮKassa | карты, СБП, ЮMoney, SberPay/другие способы при наличии в кабинете | shopId, secret key, webhook URL | 1 |
| T-Банк / T-Касса | карты, СБП, T-Pay | Terminal Key, password, webhook URL | 2 |
| Сбер | карты, SberPay, СБП при подключении | API-логин, API-пароль, callback URL | 3 |
| Альфа-Банк | карты, Alfa Pay/СБП при подключении | API-логин, API-пароль, callback URL | 4 |

Важно: сначала можно реализовать ЮKassa как самый простой вариант для салонов, но модель БД, типы, UI и роутинг должны быть провайдер-независимыми.

## 3.1 Продуктовые решения

Это не MVP и не временная ручная схема. Реализуется полноценный production-контур оплат клиентов аккаунта.

Обязательные возможности:

- предоплата записи;
- полная онлайн-оплата услуги;
- оплата товаров;
- оплата сертификатов;
- возвраты;
- частичные возвраты, если провайдер поддерживает;
- подключение онлайн-кассы владельца аккаунта;
- передача фискальных данных и чеков;
- поддержка ИП и ООО как основных типов владельцев аккаунтов.

Финансовая модель:

- платформа не берет комиссию с платежей клиентов салона;
- деньги клиента идут напрямую владельцу CRM-аккаунта через его платежное подключение;
- платформа зарабатывает отдельно на CRM, AI-токенах и платных модулях;
- терминал платформы не используется для оплат услуг салона.

## 4. Официальные источники

Использовать официальные документы и проверять параметры перед реализацией каждого провайдера:

- ЮKassa API: https://yookassa.ru/developers/api
- ЮKassa входящие уведомления: https://yookassa.ru/developers/using-api/webhooks
- ЮKassa чеки: https://yookassa.ru/developers/payment-acceptance/receipts/54fz/yoomoney/payments
- T-Банк Init: https://developer.tbank.ru/eacq/api/init
- T-Банк руководство разработчика: https://developer.tbank.ru/eacq/intro/developer/
- Сбер API платежного шлюза: https://ecomtest.sberbank.ru/doc
- Альфа-Банк инструкции интернет-эквайринга: https://pay.alfabank.ru/ecommerce/instructions/simple_aquiring.pdf
- Альфа-Банк СБП: https://pay.alfabank.ru/ecommerce/instructions/SBP_C2B.pdf

## 4.1 Что нужно доизучить перед реализацией

Перед написанием кода по каждому провайдеру нужно отдельно зафиксировать в коде и тестах:

- метод создания платежа;
- обязательные поля запроса;
- как передается `returnUrl` / `failUrl`;
- как передается `notificationUrl` / callback URL;
- как передается наш `PaymentIntent.id` или idempotency key в metadata;
- какие статусы провайдера считаются успешными, ошибочными и промежуточными;
- как проверяется подлинность webhook;
- как провайдер присылает повторные webhook-и;
- как получить статус платежа server-side, если webhook не дошел;
- как создать возврат;
- поддерживает ли провайдер частичный возврат;
- как передавать чековые данные;
- какие значения НДС, системы налогообложения, признака предмета и способа расчета поддерживает провайдер;
- какие тестовые карты/сценарии есть у провайдера;
- какие ограничения есть по СБП и быстрым способам оплаты.

Для чеков важно: чек формирует провайдер/онлайн-касса владельца аккаунта, но платформа должна правильно передать фискальные данные в запросе на оплату или отдельном запросе на чек. Поэтому в CRM должны храниться настройки фискализации аккаунта, а provider adapter должен маппить их в формат конкретного провайдера.

Что именно рискованно в webhook:

- у разных провайдеров разные схемы подписи и проверки подлинности;
- разные названия финальных статусов;
- webhook может прийти раньше, чем пользователь вернется на success page;
- webhook может прийти несколько раз;
- webhook может не дойти на localhost или при сетевом сбое;
- в webhook нужно надежно найти наш `PaymentIntent`, а не доверять только сумме или описанию;
- обработка должна быть идемпотентной, чтобы не создать две транзакции и два чека на один платеж.

## 4.2 Технические заметки по провайдерам

Эти заметки нужно использовать как основу для адаптеров. Перед написанием конкретного адаптера открыть официальную документацию провайдера и сверить актуальные поля, но не менять общую архитектуру: все провайдеры должны приводиться к единому внутреннему `PaymentIntent`.

### 4.2.1 ЮKassa

Данные подключения аккаунта:

- `shopId` / номер магазина в ЮKassa. В интерфейсе CRM называть `Идентификатор подключения`, а подсказкой писать: `В ЮKassa это shopId / номер магазина`.
- `secretKey` / секретный ключ API.
- `testMode`.
- `webhookUrl`, который владелец аккаунта указывает в ЮKassa.
- настройки чеков: передавать чек или нет, НДС, система налогообложения, признак предмета расчета, признак способа расчета.

Создание платежа:

- server-side запрос `POST /v3/payments`;
- авторизация Basic Auth через `shopId` и `secretKey`;
- обязательно использовать `Idempotence-Key`, чтобы повторный запрос не создал дубль платежа;
- передавать `amount`, `currency`, `capture: true`, `description`;
- передавать `confirmation: { type: "redirect", return_url }`;
- в `metadata` класть `accountId`, `paymentIntentId`, `appointmentId`/`orderId`, сценарий оплаты;
- если чеки включены, передавать `receipt` с customer и items;
- клиенту отдавать `confirmation.confirmation_url`.

Статусы:

- `pending` -> внутренний `PROCESSING`;
- `succeeded` -> внутренний `SUCCEEDED`;
- `canceled` -> внутренний `FAILED` или `CANCELLED` по причине отмены.

Webhook:

- подписаться минимум на `payment.succeeded`, `payment.canceled`, `refund.succeeded`;
- после входящего webhook не доверять только телу уведомления: найти `PaymentIntent` по `metadata.paymentIntentId` или provider payment id и server-side получить платеж из ЮKassa;
- обработка webhook должна быть идемпотентной;
- отвечать `200` только после успешной обработки или после безопасного распознавания дубля.

Возвраты:

- использовать `POST /v3/refunds`;
- обязательно `Idempotence-Key`;
- поддержать полный и частичный возврат;
- связать refund с исходным provider payment id и внутренним `Transaction`.

Чеки:

- чек формирует ЮKassa/подключенная касса владельца аккаунта;
- платформа должна только передать правильный `receipt`;
- каждый item должен иметь название, количество, сумму, НДС, `payment_subject`, `payment_mode`;
- сумма items должна совпадать с суммой платежа.

Тесты:

- создать тестовое подключение;
- проверить успешную оплату, отмену/неуспех, полный возврат, частичный возврат, webhook, чек;
- отдельно проверить сценарии предоплаты записи, полной оплаты услуги, товара и сертификата.

### 4.2.2 T-Банк / T-Касса

Данные подключения аккаунта:

- `TerminalKey`;
- пароль терминала;
- `testMode`;
- `NotificationURL`;
- настройки чеков: `Taxation`, `Tax`, `PaymentMethod`, `PaymentObject`.

Создание платежа:

- server-side запрос `POST /v2/Init`;
- сумма передается в копейках через `Amount`;
- `OrderId` должен быть уникальным. Формат: `account_payment_{paymentIntentId}_{nonce}`;
- передавать `Description`;
- передавать `SuccessURL`, `FailURL`, `NotificationURL`;
- в `DATA` класть `accountId`, `paymentIntentId`, `appointmentId`/`orderId`, сценарий оплаты;
- токен формируется как SHA-256 по отсортированным top-level primitive полям + пароль терминала. `Token` и вложенные объекты в подпись не входят;
- клиенту отдавать `PaymentURL`.

Статусы:

- `NEW`, `FORM_SHOWED`, `AUTHORIZING`, `AUTHORIZED`, `CONFIRMING` -> внутренний `PROCESSING`;
- `CONFIRMED` -> внутренний `SUCCEEDED`;
- `REJECTED`, `DEADLINE_EXPIRED`, `CANCELED` -> внутренний `FAILED` или `CANCELLED`;
- `REFUNDED` -> внутренний возврат `SUCCEEDED`;
- `PARTIAL_REFUNDED` -> частичный возврат `SUCCEEDED` с остатком платежа.

Webhook:

- проверить `Token` входящего уведомления;
- найти `PaymentIntent` по `PaymentId`, `OrderId` или `DATA.paymentIntentId`;
- если webhook пришел раньше success page, success page должна только показать уже обработанный статус;
- если success page открылась раньше webhook, success page должна сделать server-side `GetState`;
- повторные webhook-и не должны создавать дубль `Transaction`, `Receipt` или бизнес-действия.

Возвраты:

- перед кодом сверить актуальный метод T-Банка для возврата подтвержденного платежа;
- для уже подтвержденного платежа использовать возврат, для неподтвержденной/незавершенной операции - отмену, если провайдер этого требует;
- поддержать полный и частичный возврат, если включено у терминала.

Чеки:

- если онлайн-касса у владельца аккаунта подключена в T-Бизнесе, платформа передает `Receipt`;
- `Receipt` содержит `Email`/`Phone`, `Taxation`, `Items`;
- каждый item содержит `Name`, `Price`, `Quantity`, `Amount`, `Tax`, `PaymentMethod`, `PaymentObject`;
- название item должно быть из CRM: название услуги/товара/сертификата, а не автоматически добавленный префикс платформы.

Тесты:

- повторить сценарии, которые уже были пройдены для платформенного терминала: успешная оплата, неуспешная оплата, возврат;
- дополнительно проверить webhook через HTTPS-домен или tunnel;
- проверить чек с включенной онлайн-кассой.

### 4.2.3 Сбер

Данные подключения аккаунта:

- `apiLogin`;
- `apiPassword`;
- версия шлюза: старый/новый шлюз, если это требуется конкретным договором;
- `callbackUrl`;
- настройки чеков и налогов.

Создание платежа:

- использовать обычный платеж с прямым списанием;
- для REST-шлюза типовой метод создания платежа: `register.do`;
- передавать `userName`, `password`, `orderNumber`, `amount`, `returnUrl`, `failUrl`;
- `amount` передается в минимальных единицах валюты;
- `orderNumber` должен быть уникальным и связан с `PaymentIntent`;
- если шлюз поддерживает `jsonParams`, класть туда `accountId`, `paymentIntentId`, сценарий оплаты;
- клиенту отдавать ссылку `formUrl`;
- provider reference сохранять из `orderId`.

Статусы:

- статус получать через `getOrderStatusExtended.do`;
- перед кодом зафиксировать точную таблицу numeric `orderStatus` из документации Сбера;
- внутренний успех засчитывать только по финальному успешному статусу провайдера;
- промежуточные статусы не должны запускать выдачу услуги или закрытие записи.

Webhook/callback:

- перед реализацией уточнить формат callback выбранного шлюза и схему проверки подлинности;
- если надежной подписи нет, webhook использовать только как сигнал, а итоговый статус подтверждать через `getOrderStatusExtended.do`;
- обработка должна быть идемпотентной.

Возвраты:

- перед кодом сверить, какой метод нужен для возврата подтвержденного платежа: `refund.do`, `reverse.do` или вариант нового шлюза;
- поддержать полный возврат;
- частичный возврат включить только если выбранный шлюз и договор аккаунта это поддерживают.

Чеки:

- фискальные данные передаются через формат провайдера, обычно через order/cart bundle;
- перед кодом зафиксировать точные поля для items, НДС, системы налогообложения, признака предмета и способа расчета;
- чек формирует Сбер/подключенная касса владельца аккаунта, платформа только передает данные.

Тесты:

- тестовые учетные данные Сбера;
- успешная оплата, отказ, возврат, частичный возврат при поддержке;
- webhook/callback через HTTPS;
- чек по услуге, товару и сертификату.

### 4.2.4 Альфа-Банк

Данные подключения аккаунта:

- `apiLogin`;
- `apiPassword`;
- `callbackUrl`;
- настройки чеков и налогов;
- включенные способы оплаты, включая карты и СБП, если подключено в кабинете.

Создание платежа:

- использовать обычный платеж с прямым списанием;
- по базовой инструкции интернет-эквайринга типовой метод создания платежа: `register.do`;
- передавать `userName`, `password`, `orderNumber`, `amount`, `returnUrl`, `failUrl`, `description`;
- `orderNumber` должен быть уникальным и связан с `PaymentIntent`;
- если API поддерживает `jsonParams`/metadata, класть туда `accountId`, `paymentIntentId`, сценарий оплаты;
- клиенту отдавать `formUrl`;
- provider reference сохранять из `orderId`.

Статусы:

- статус получать через `getOrderStatusExtended.do`;
- перед кодом зафиксировать точную таблицу numeric статусов из документации Альфа-Банка;
- финальный успех маппить только в `SUCCEEDED`;
- ошибки, отмены и истечение срока оплаты маппить в `FAILED`/`CANCELLED`.

Webhook/callback:

- перед реализацией уточнить, как настраивается callback и как проверяется подлинность;
- если подпись отсутствует или недостаточна, webhook использовать как сигнал, а статус подтверждать server-side запросом;
- обязательно идемпотентно обрабатывать повторные уведомления.

Возвраты:

- перед кодом сверить точный метод возврата и поддержку частичного возврата в выбранной версии API;
- полный возврат обязателен;
- частичный возврат реализовать только при подтвержденной поддержке провайдера.

Чеки:

- фискальные данные передаются в формате Альфа-Банка, часто через order/cart bundle;
- платформа должна маппить CRM item в fiscal item;
- чек формирует Альфа-Банк/подключенная касса владельца аккаунта.

Тесты:

- тестовые учетные данные Альфа-Банка;
- успешная оплата, отказ, возврат, частичный возврат при поддержке;
- webhook/callback через HTTPS;
- чек по услуге, товару и сертификату.

### 4.2.5 Единые правила для всех провайдеров

- Деньги клиента салона всегда идут на подключение владельца аккаунта, не на терминал платформы.
- Платформа не берет комиссию с этих платежей.
- Создание платежа всегда идет через backend, не через frontend.
- Внутренний `PaymentIntent` создается до обращения к провайдеру.
- Один успешный provider payment может создать только одну `Transaction`.
- Один возврат может создать только одну `Refund`.
- Success page не является доказательством оплаты. Она только запускает server-side проверку статуса.
- Webhook не должен напрямую доверять сумме и описанию из тела уведомления без сверки с внутренним `PaymentIntent`.
- Все провайдеры должны возвращать единый результат адаптера: `providerPaymentId`, `paymentUrl`, `providerStatus`, `normalizedStatus`, `rawPayload`.
- Чеки включаются настройкой аккаунта. Если чек включен, без customer email/phone и fiscal items оплату лучше не создавать, чтобы не получить нефискализированный платеж.

## 5. Текущая база

Файл:

```text
packages/db/prisma/schema.prisma
```

Уже есть базовые модели клиентских платежей:

```prisma
model PaymentIntent {
  id            Int
  accountId     Int
  appointmentId Int?
  clientId      Int?
  amount        Decimal
  currency      String
  status        PaymentIntentStatus
  scenario      String
  provider      String?
  providerRef   String?
}

model Transaction {
  id          Int
  accountId   Int
  intentId    Int?
  type        TransactionType
  amount      Decimal
  currency    String
  providerRef String?
}

model Refund {
  id            Int
  accountId     Int
  transactionId Int?
  intentId      Int?
  amount        Decimal
  status        RefundStatus
  reason        String?
}

model Receipt {
  id            Int
  accountId     Int
  transactionId Int?
  provider      String
  receiptUrl    String?
  payload       Json?
}

model PaymentMethod {
  id        Int
  accountId Int
  clientId  Int?
  provider  String
  token     String
  last4     String?
  expiresAt DateTime?
}

model PaymentWebhookEvent {
  id              Int
  provider        String
  providerEventId String
  payload         Json
  receivedAt      DateTime
}
```

Эти модели можно использовать как основу, но не хватает модели платежных подключений аккаунта и расширенных полей для статусов провайдера, redirect URL, чеков и идемпотентности.

## 6. Миграция БД

Добавить enum:

```prisma
enum AccountPaymentProvider {
  YOOKASSA
  TBANK
  SBER
  ALFA
}

enum PaymentConnectionMode {
  TEST
  LIVE
}

enum ReceiptVatCode {
  NONE
  VAT_0
  VAT_5
  VAT_7
  VAT_10
  VAT_18
  VAT_20
}

enum ReceiptTaxationSystem {
  DEFAULT
  OSN
  USN_INCOME
  USN_INCOME_OUTCOME
  ENVD
  ESN
  PATENT
}
```

Добавить модель:

```prisma
model AccountPaymentConnection {
  id                    Int                    @id @default(autoincrement())
  accountId             Int
  provider              AccountPaymentProvider
  mode                  PaymentConnectionMode  @default(TEST)
  title                 String?
  isEnabled             Boolean                @default(false)
  isDefault             Boolean                @default(false)
  credentialsEncrypted  String
  credentialsMasked     Json?
  publicConfig          Json?
  receiptEnabled        Boolean                @default(false)
  receiptVat            ReceiptVatCode         @default(NONE)
  receiptTaxationSystem ReceiptTaxationSystem  @default(DEFAULT)
  receiptFfdVersion     String?
  paymentSubject        String?                // service/goods/payment/etc by provider mapping
  paymentMethod         String?                // full_payment/prepayment/etc by provider mapping
  currency              String                 @default("RUB")
  webhookSecret         String?
  lastTestedAt          DateTime?
  lastTestStatus        String?
  createdAt             DateTime               @default(now())
  updatedAt             DateTime               @updatedAt

  account Account @relation(fields: [accountId], references: [id])

  @@index([accountId, provider])
  @@index([accountId, isEnabled])
}
```

Расширить `PaymentIntent`:

```prisma
connectionId       Int?
providerStatus     String?
providerPayload     Json?
paymentUrl          String?
returnUrl           String?
failUrl             String?
idempotencyKey      String?
paidAt              DateTime?
expiresAt           DateTime?
receiptRequested    Boolean @default(false)
receiptPayload      Json?
```

Расширить `Transaction`:

```prisma
providerStatus  String?
providerPayload Json?
paidAt          DateTime?
```

Расширить `Refund`:

```prisma
providerRef     String?
providerStatus  String?
providerPayload Json?
completedAt     DateTime?
```

Расширить `PaymentWebhookEvent`:

```prisma
accountId         Int?
intentId          Int?
processedAt       DateTime?
processingStatus  String?
processingError   String?
```

## 7. Секреты и безопасность

Платежные ключи аккаунтов нельзя хранить открытым текстом.

Добавить env:

```env
ACCOUNT_PAYMENT_CREDENTIALS_ENCRYPTION_KEY=
ACCOUNT_PAYMENT_WEBHOOK_BASE_URL=
```

Требования:

- AES-GCM или libsodium для шифрования `credentialsEncrypted`.
- Ключ шифрования только в env, не в базе.
- На фронт возвращать только `credentialsMasked`.
- При сохранении пустые поля секретов не должны затирать существующие ключи.
- Все изменения платежного подключения писать в аудит.
- Webhook обрабатывать идемпотентно.
- Статус оплаты нельзя считать успешным только по redirect в браузере. Успех подтверждается webhook или server-side проверкой статуса у провайдера.
- Не делать собственный ввод карты в CRM. Только hosted payment page / виджет провайдера.

## 8. Архитектура кода

Создать отдельный модуль для клиентских платежей, не смешивать с платформенными оплатами:

```text
apps/web/lib/account-payments/
  types.ts
  provider.ts
  config.ts
  encryption.ts
  checkout.ts
  apply-payment.ts
  receipts.ts
  providers/
    yookassa.ts
    tbank.ts
    sber.ts
    alfa.ts
```

Общий интерфейс провайдера:

```ts
type AccountPaymentProviderAdapter = {
  code: "yookassa" | "tbank" | "sber" | "alfa";
  createPayment(input: CreateAccountPaymentInput): Promise<CreateAccountPaymentResult>;
  getPaymentStatus(input: GetAccountPaymentStatusInput): Promise<AccountPaymentStatusResult>;
  refund(input: RefundAccountPaymentInput): Promise<RefundAccountPaymentResult>;
  verifyWebhook(input: VerifyAccountPaymentWebhookInput): Promise<VerifiedWebhookEvent>;
};
```

Общий результат создания платежа:

```ts
type CreateAccountPaymentResult = {
  providerRef: string;
  paymentUrl: string;
  providerStatus: string;
  raw: unknown;
};
```

## 9. API routes

CRM-настройки платежей:

```text
GET    /api/v1/crm/payment-connections
POST   /api/v1/crm/payment-connections
PATCH  /api/v1/crm/payment-connections/[id]
POST   /api/v1/crm/payment-connections/[id]/test
POST   /api/v1/crm/payment-connections/[id]/set-default
```

Публичная оплата клиентом:

```text
POST /api/v1/public/booking/payments/create
GET  /api/v1/public/payments/[intentId]/status
POST /api/v1/public/payments/[intentId]/cancel
```

Webhook-и:

```text
POST /api/v1/account-payments/yookassa/webhook
POST /api/v1/account-payments/tbank/webhook
POST /api/v1/account-payments/sber/webhook
POST /api/v1/account-payments/alfa/webhook
```

Страницы результата:

```text
/{accountSlug}/payment/success?intentId=...
/{accountSlug}/payment/fail?intentId=...
```

## 10. CRM UI

Добавить раздел:

```text
CRM -> Настройки -> Оплата клиентов
```

Блоки:

- `Платежные подключения`
- `Правила оплаты записи`
- `Чеки`
- `Тестирование`
- `История платежей`

Провайдеры показывать карточками:

- ЮKassa
- T-Банк
- Сбер
- Альфа-Банк

Поля ЮKassa:

- `Идентификатор подключения`
- подсказка: `В кабинете ЮKassa это shopId / номер магазина`
- `Секретный ключ API`
- `URL уведомлений`
- `Тестовый режим`
- `Передавать чек`
- `НДС`
- `Система налогообложения`
- `ФФД`
- `Признак предмета расчета`
- `Признак способа расчета`

Поля T-Банк:

- `Terminal Key`
- `Пароль терминала`
- `URL уведомлений`
- `Тестовый режим`
- `Передавать чек`
- `НДС`
- `Система налогообложения`
- `ФФД`

Поля Сбер:

- `API-логин`
- `API-пароль`
- `Версия шлюза`
- `Callback URL`
- `Тестовый режим`
- `Передавать чек`
- `НДС`
- `Система налогообложения`

Поля Альфа-Банк:

- `API-логин`
- `API-пароль`
- `Callback URL`
- `Тестовый режим`
- `Передавать чек`
- `НДС`
- `Система налогообложения`

## 11. Правила оплаты записи

Добавить настройки аккаунта:

- `Оплата не обязательна`
- `Предоплата обязательна`
- `Полная оплата обязательна`
- `Оплата товаров`
- `Оплата сертификатов`
- `Создавать запись только после оплаты`
- `Создавать запись сразу, но подтверждать после оплаты`
- `Размер предоплаты`: фиксированная сумма или процент
- `Срок оплаты`: например 15 минут
- `Срок действия сертификата`
- `Разрешить частичную оплату сертификатом`

Использовать существующие поля `AccountSetting.requireDeposit` и `AccountSetting.requirePaymentToConfirm`, но расширить их, если текущих флагов недостаточно.

## 12. Основные сценарии

### 12.1 Оплата после выбора услуги

1. Клиент выбирает услугу, специалиста и слот.
2. Backend рассчитывает сумму.
3. Создается `PaymentIntent`.
4. Провайдер создает платеж.
5. Клиент уходит на hosted payment page.
6. Webhook подтверждает платеж.
7. Система создает `Transaction`.
8. Запись подтверждается или создается, в зависимости от правила аккаунта.
9. Если включены чеки, создается `Receipt`.

### 12.2 Предоплата

1. Настройка аккаунта задает депозит: сумма или процент.
2. `PaymentIntent.amount` равен сумме предоплаты.
3. После оплаты запись получает статус подтверждения.
4. Остаток оплаты можно вести как долг клиента или оплату в салоне.

### 12.3 Возврат

1. Администратор открывает платеж в CRM.
2. Нажимает `Вернуть`.
3. Backend вызывает refund у провайдера.
4. Webhook или проверка статуса подтверждает возврат.
5. Создается `Refund`.
6. Если был чек, создается чек возврата.

### 12.4 Оплата товара

1. Клиент выбирает товар на сайте или в CRM-сценарии продажи.
2. Backend проверяет цену, наличие и правила резервирования.
3. Создается `PaymentIntent` со сценарием `PRODUCT_PURCHASE`.
4. После успешной оплаты создается `Transaction`.
5. Остатки товара уменьшаются после оплаты, если включено резервирование после оплаты.
6. Если включены чеки, предмет расчета передается как товар.

### 12.5 Оплата сертификата

1. Клиент выбирает сертификат: номинал, срок действия, получателя.
2. Backend создает `PaymentIntent` со сценарием `CERTIFICATE_PURCHASE`.
3. После успешной оплаты создается сертификат с уникальным кодом.
4. Сертификат отправляется клиенту или получателю.
5. Если включены чеки, предмет расчета передается по настройке аккаунта: услуга, аванс или иной предмет расчета, в зависимости от юридической модели владельца аккаунта.

## 13. Чеки

Чеки для клиентских платежей относятся к владельцу CRM-аккаунта, а не к платформе.

Платформа должна только передавать фискальные данные в провайдера, если владелец аккаунта включил онлайн-кассу у своего провайдера. В production-сценарии поддержка чеков обязательна: аккаунт, который принимает онлайн-оплату и обязан выдавать чек, должен подключить онлайн-кассу у своего провайдера и заполнить настройки фискализации в CRM.

Дефолт для салонных услуг:

- НДС: `Без НДС`
- Предмет расчета: `Услуга`
- Способ расчета: `Полный расчет` или `Предоплата`, зависит от сценария
- Система налогообложения: выбирает владелец аккаунта

Нельзя автоматически ставить УСН или НДС за владельца аккаунта без настройки. В интерфейсе нужна подсказка: `Проверьте эти значения с бухгалтером`.

Для товаров и сертификатов должны быть отдельные настройки фискализации:

- товар: предмет расчета `Товар`, если владелец аккаунта реально продает товар;
- услуга: предмет расчета `Услуга`;
- сертификат: настраиваемый предмет расчета, потому что юридически это может быть аванс, предоплата, услуга или иной предмет в зависимости от схемы продаж;
- возврат: чек возврата формируется через тот же провайдер/онлайн-кассу, если чек был передан при продаже.

## 14. Интеграция с записью

Нужно связать платежи с записью:

- `PaymentIntent.appointmentId`
- `Appointment.paymentStatus` если такого поля нет, добавить
- статус записи не должен становиться финально подтвержденным без успешной оплаты, если включено `requirePaymentToConfirm`

При успешной оплате:

- обновить `PaymentIntent.status = SUCCEEDED`
- создать `Transaction`
- обновить запись
- отправить уведомление клиенту
- отправить уведомление владельцу аккаунта

## 15. Личный кабинет клиента

Если клиент оплачивает запись:

- показывать понятный экран оплаты;
- после оплаты показывать результат;
- в истории записи показывать сумму, статус, способ оплаты;
- при ошибке давать возможность повторить оплату.

## 16. Админка платформы

Платформа должна видеть техническую диагностику, но не управлять деньгами салона:

- какие аккаунты подключили оплату;
- какой провайдер;
- тестовый или рабочий режим;
- последние ошибки webhook;
- количество успешных/ошибочных платежей;
- без отображения полных секретов.

## 17. Что не делать

- Не принимать деньги клиентов салона на терминал платформы.
- Не хранить данные банковских карт.
- Не показывать секретные ключи после сохранения.
- Не считать redirect успешной оплатой.
- Не делать ручное подтверждение оплаты как основной сценарий.
- Не писать в UI `номер магазина` как основной термин.

## 18. Тестирование

Unit-тесты:

- маппинг статусов каждого провайдера;
- подпись webhook;
- формирование payload;
- шифрование и дешифрование credentials;
- идемпотентность webhook.

Integration-тесты:

- создать платеж;
- получить статус;
- обработать webhook success;
- обработать webhook fail;
- сделать возврат;
- проверить повторный webhook.

Manual E2E:

- ЮKassa тестовый платеж;
- T-Банк тестовый платеж;
- Сбер тестовый платеж;
- Альфа тестовый платеж;
- локально через HTTPS-туннель;
- на production-домене после деплоя.

## 19. Очередность реализации

### Этап 1. Каркас

- [ ] Добавить Prisma-модели и миграцию.
- [ ] Добавить шифрование credentials.
- [ ] Добавить общий интерфейс провайдера.
- [ ] Добавить CRM UI `Оплата клиентов`.
- [ ] Добавить API для сохранения подключений.

### Этап 2. ЮKassa

- [ ] Реализовать `providers/yookassa.ts`.
- [ ] Создавать платеж через API.
- [ ] Обрабатывать `payment.succeeded`.
- [ ] Обрабатывать `payment.canceled`.
- [ ] Добавить возврат.
- [ ] Добавить передачу чеков при включенной настройке.

### Этап 3. Публичная оплата записи

- [ ] Подключить создание `PaymentIntent` к онлайн-записи.
- [ ] Сделать success/fail страницы.
- [ ] Подтверждать запись после успешной оплаты.
- [ ] Показывать статус оплаты в CRM.

### Этап 4. T-Банк для аккаунтов

- [ ] Переиспользовать опыт платформенного T-Банка, но не использовать терминал платформы.
- [ ] Добавить отдельные credentials аккаунта.
- [ ] Реализовать webhook и GetState.
- [ ] Добавить возвраты.

### Этап 5. Сбер

- [ ] Реализовать создание заказа.
- [ ] Реализовать проверку статуса.
- [ ] Реализовать callback.
- [ ] Реализовать возврат.
- [ ] Проверить SberPay/СБП по доступности в кабинете.

### Этап 6. Альфа-Банк

- [ ] Реализовать создание заказа.
- [ ] Реализовать проверку статуса.
- [ ] Реализовать callback.
- [ ] Реализовать возврат.
- [ ] Проверить СБП по доступности в кабинете.

### Этап 7. Полировка

- [ ] Добавить аудит изменений.
- [ ] Добавить диагностику ошибок.
- [ ] Добавить фильтры платежей.
- [ ] Добавить повтор оплаты.
- [ ] Добавить частичные возвраты, если провайдер поддерживает.

## 20. Зафиксированные решения

- Делать сразу production-контур, а не MVP.
- Поддерживать предоплату записи.
- Поддерживать полную оплату услуги.
- Поддерживать оплату товаров.
- Поддерживать оплату сертификатов.
- Аккаунты подключают свои платежные провайдеры и свои онлайн-кассы.
- Чеки по клиентским платежам формируются от имени владельца аккаунта, не от платформы.
- Платформа не берет комиссию с оплат клиентов салона.
- Платформа зарабатывает отдельно на CRM, AI-токенах и платных модулях.

## 21. Правило работы по этому плану

Перед каждым продолжением агент должен:

1. Прочитать этот файл.
2. Проверить текущее состояние git diff.
3. Выполнить только следующий незавершенный пункт.
4. После фактической работы добавить новую запись в `Progress Journal`.
5. В записи указать: что сделано, какие файлы изменены, какие проверки прошли, что делать дальше, какие есть блокеры.

Не отмечать пункт выполненным заранее.

## 22. Progress Journal

### 2026-06-02 - public booking starts online checkout

Status: in_progress

Done:

- `apps/web/app/api/v1/public/booking/bootstrap/route.ts` now returns a safe `payments` block without secrets: booking settings and whether the account has an enabled payment connection.
- `apps/web/app/booking/booking-client.tsx` now calls `/api/v1/public/payments/checkout` after a single appointment is created when `requirePaymentToConfirm` is enabled and an online payment connection exists.
- If the provider returns `paymentUrl`, the client is redirected to the provider payment page immediately.
- Multi-appointment visit chains are intentionally not redirected yet, because the current `PaymentIntent` links to one `appointmentId`; charging one appointment as the whole visit would create an incorrect amount/receipt.

Verified:

- `npm run typecheck` passed.
- `npm run prisma:validate` passed.

Next:

- Add a product-level CRM setting for booking payment mode: no online payment, full payment before confirmation, or explicit prepayment amount/percent.
- Extend `PaymentIntent`/checkout flow to support one payment for a multi-appointment visit chain with a correct total and receipt.
- Wire the same public checkout foundation into products and certificates when those public order/cart entities are ready.
### 2026-06-02 - добавлен публичный checkout и страницы возврата клиентских оплат

Статус: in_progress

Что сделано:

- Добавлен публичный API checkout `/api/v1/public/payments/checkout`.
- Для оплаты записи API принимает `appointmentId`, проверяет принадлежность записи текущему публичному аккаунту и берет сумму из `Appointment.priceTotal`, а не из данных клиента.
- Для будущих оплат товаров, сертификатов и произвольных клиентских счетов API поддерживает явные `amountRub` и `description`.
- Добавлены публичные страницы `/payment/success` и `/payment/fail`, которые не требуют CRM-авторизации.
- Страницы возврата выполняют server-side refresh статуса у провайдера по `PaymentIntent`, поэтому на localhost можно подтвердить оплату даже если webhook банка не дошел.

Измененные файлы:

- `apps/web/app/api/v1/public/payments/checkout/route.ts`
- `apps/web/app/payment/success/page.tsx`
- `apps/web/app/payment/fail/page.tsx`
- `ACCOUNT_CLIENT_PAYMENTS_IMPLEMENTATION_PLAN.md`

Проверка:

- `npm run typecheck` - успешно.
- `npm run prisma:validate` - успешно.

Что делать дальше:

- Встроить публичный checkout в реальный booking flow: после создания записи показывать оплату, если у аккаунта включен прием оплат и для сценария требуется онлайн-оплата.
- Добавить настройки правил оплаты по услугам: без онлайн-оплаты, предоплата, полная оплата.
- Добавить CRM-экран операций и возвратов по клиентским платежам.

Блокеры:

- Для автоматического webhook в production нужен публичный HTTPS URL. На localhost используется fallback через success/fail refresh.

### 2026-06-02 - реализован каркас платежных подключений аккаунтов

Статус: in_progress

Что сделано:

- Добавлена миграция БД для `AccountPaymentConnection` и расширения `PaymentIntent`, `Transaction`, `Refund`, `Receipt`, `PaymentWebhookEvent`.
- Добавлены enum-ы провайдеров, режимов подключения, НДС и системы налогообложения.
- Реализован модуль `apps/web/lib/account-payments`: шифрование реквизитов, нормализация credential-ов, receipt mapping, единый adapter interface, YooKassa adapter, T-Bank adapter, заглушки для Sber/Alfa.
- Добавлены route handlers для webhook аккаунтных платежей: `/api/v1/account-payments/[provider]/webhook`.
- Добавлены CRM API routes для сохранения платежного подключения, создания тестового checkout и refresh статуса intent.
- Добавлен UI-блок в CRM оплатах для настройки платежного подключения владельца аккаунта.
- В `.env.example` добавлены переменные для ключа шифрования реквизитов и публичного origin.
- В локальный `apps/web/.env.local` добавлен dev-only ключ шифрования реквизитов аккаунтных платежей. Это не ключ банка и не реквизиты владельца салона; реальные credential-ы владельцев вводятся в CRM и хранятся в БД зашифрованно.

Измененные файлы:

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260602232000_account_client_payments/migration.sql`
- `.env.example`
- `apps/web/.env.local`
- `apps/web/lib/account-payments/*`
- `apps/web/app/api/v1/account-payments/[provider]/webhook/route.ts`
- `apps/web/app/api/v1/crm/account-payments/connections/route.ts`
- `apps/web/app/api/v1/crm/account-payments/checkout/route.ts`
- `apps/web/app/api/v1/crm/account-payments/intents/[id]/refresh/route.ts`
- `apps/web/app/(crm)/crm/payments/page.tsx`
- `apps/web/app/(crm)/crm/payments/account-payments-client.tsx`

Проверка:

- `powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 migrate-deploy` - миграция применена.
- `powershell -ExecutionPolicy Bypass -File ./scripts/prisma.ps1 generate` - Prisma Client обновлен.
- `npm run prisma:validate` - успешно.
- `npm run typecheck` - успешно.

Что делать дальше:

- Реализовать публичный checkout для клиента салона: создание `PaymentIntent` по записи/услуге/товару/сертификату через активное платежное подключение аккаунта.
- Добавить success/fail страницы для клиентских платежей салона с server-side проверкой статуса у провайдера.
- Встроить оплату в публичный booking flow так, чтобы запись/бронь завершалась только после успешного webhook/status refresh, если для услуги требуется онлайн-оплата.
- Добавить CRM-экран операций/возвратов по платежам клиентов салона.
- Реализовать Sber/Alfa adapters после сверки с актуальной официальной документацией.

Блокеры:

- Для реального webhook нужен публичный HTTPS URL. На localhost используется redirect success page + server-side refresh, но webhook провайдера без туннеля/продакшн URL не дойдет.
- Для YooKassa/Sber/Alfa нужны реальные или тестовые реквизиты соответствующих аккаунтов владельцев салонов.

### 2026-06-02 - уточнен scope и риски провайдеров

Статус: completed

Что сделано:

- Чеки уточнены как зона провайдера/онлайн-кассы владельца аккаунта, но с обязательной передачей фискальных данных из платформы.
- Добавлен раздел `Что нужно доизучить перед реализацией`.
- Зафиксированы риски webhook: подпись, статусы, повторы, server-side проверка статуса и идемпотентность.

Измененные файлы:

- `ACCOUNT_CLIENT_PAYMENTS_IMPLEMENTATION_PLAN.md`

Проверка:

- Код не менялся, тесты не запускались.

Следующий шаг:

- Перед стартом кода пройти provider-by-provider исследование ЮKassa, T-Банк, Сбер и Альфа-Банк по чеклисту раздела 4.1.

Блокеры:

- Нет.

### 2026-06-02 - зафиксирован production-scope вместо MVP

Статус: completed

Что сделано:

- Убраны открытые вопросы по объему первой версии.
- Зафиксировано, что делаем полноценный production-контур.
- В обязательный scope добавлены предоплата, полная оплата услуги, товары, сертификаты, возвраты и частичные возвраты.
- Зафиксировано, что аккаунты подключают свои онлайн-кассы и чеки.
- Зафиксировано, что платформа не берет комиссию с оплат клиентов салона.

Измененные файлы:

- `ACCOUNT_CLIENT_PAYMENTS_IMPLEMENTATION_PLAN.md`

Проверка:

- Код не менялся, тесты не запускались.

Следующий шаг:

- Начать этап 1: миграция БД и модель `AccountPaymentConnection` с учетом товаров, сертификатов и чеков.

Блокеры:

- Нет.

### 2026-06-01 - создан план клиентских платежей

Статус: completed

Что сделано:

- Зафиксирована граница между платежами платформе и платежами клиентов салона.
- Заложены провайдеры: ЮKassa, T-Банк, Сбер, Альфа-Банк.
- Зафиксирована терминология без слова `магазин` как основного UI-термина.
- Описаны нужные миграции, API, UI, сценарии, чеки, безопасность и тесты.

Измененные файлы:

- `ACCOUNT_CLIENT_PAYMENTS_IMPLEMENTATION_PLAN.md`

Проверка:

- Код не менялся, тесты не запускались.

Следующий шаг:

- Начать этап 1: миграция БД и модель `AccountPaymentConnection`.

Блокеры:

- Нет.

