"use client";

import { useMemo, useState } from "react";
import ClientAppointments from "./client-appointments";
import ClientProfileForm from "./client-profile-form";
import ClientReviewForm from "./client-review-form";

type AppointmentCard = {
  id: number;
  status: string;
  statusLabel: string;
  statusTone: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string | null;
  priceLabel: string | null;
  locationName: string;
  locationAddress: string | null;
  specialistName: string | null;
  servicesLabel: string | null;
  canCancel: boolean;
  accountName?: string | null;
  accountSlug?: string | null;
  startAtIso?: string;
};

type LoyaltyTransaction = {
  id: number;
  createdAt: string;
  amount: number;
  type: string;
  accountName?: string | null;
  accountTimeZone?: string;
};

type PaymentItem = {
  id: number;
  status: string;
  amount: number;
  createdAt: string;
  provider: string | null;
  appointmentId: number | null;
  accountName?: string | null;
  accountTimeZone?: string;
};

type PaymentTransaction = {
  id: number;
  type: string;
  amount: number;
  createdAt: string;
  providerRef: string | null;
  accountName?: string | null;
  accountTimeZone?: string;
};

type DocumentAcceptance = {
  id: number;
  title: string;
  version: number;
  acceptedAt: string;
  accountName?: string | null;
  accountTimeZone?: string;
};

type ReviewItem = {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  accountName?: string | null;
  accountTimeZone?: string;
};

type ClientDashboardProps = {
  accountSlug: string | null;
  accountName: string | null;
  accountAddress: string | null;
  accountPhone: string | null;
  accountTimeZone: string;
  displayName: string;
  bookLink: string;
  upcoming: AppointmentCard[];
  history: AppointmentCard[];
  cancellationWindowHours: number | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  loyalty: {
    balance: number | null;
    transactions: LoyaltyTransaction[];
  };
  payments: {
    intents: PaymentItem[];
    transactions: PaymentTransaction[];
  };
  documents: DocumentAcceptance[];
  reviews: ReviewItem[];
  organizations: Array<{ slug: string; name: string; bookingLink: string }>;
};

type TabKey =
  | "overview"
  | "appointments"
  | "loyalty"
  | "payments"
  | "documents"
  | "reviews"
  | "profile"
  | "support";

const tabLabels: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Обзор" },
  { key: "appointments", label: "Записи" },
  { key: "loyalty", label: "Лояльность" },
  { key: "payments", label: "Оплаты" },
  { key: "documents", label: "Документы" },
  { key: "reviews", label: "Отзывы" },
  { key: "profile", label: "Профиль" },
  { key: "support", label: "Поддержка" },
];

const formatDate = (value: string, timeZone: string, withTime = false) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone,
  }).format(new Date(value));

const formatCurrency = (value: number | null) => {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
};

const daysDiff = (from: Date, to: Date) => Math.ceil((to.getTime() - from.getTime()) / 86400000);

export default function ClientDashboard(props: ClientDashboardProps) {
  const {
    accountSlug,
    accountName,
    accountAddress,
    accountPhone,
    accountTimeZone,
    displayName,
    bookLink,
    upcoming,
    history,
    cancellationWindowHours,
    profile,
    loyalty,
    payments,
    documents,
    reviews,
    organizations,
  } = props;

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(reviews);

  const nextAppointment = upcoming[0] ?? null;
  const lastVisit = history[0] ?? null;
  const latestReview = reviewItems[0] ?? null;

  const loyaltySummary = useMemo(() => {
    const balance = loyalty.balance ?? 0;
    const level = balance >= 5000 ? "Платиновый" : balance >= 2000 ? "Золотой" : "Базовый";
    return { balance, level };
  }, [loyalty.balance]);

  const smartHint = useMemo(() => {
    if (nextAppointment?.startAtIso) {
      const days = daysDiff(new Date(), new Date(nextAppointment.startAtIso));
      if (days <= 0) return "Сегодня у вас запланирован визит. При необходимости можно перенести.";
      if (days === 1) return "До визита остался 1 день. Можно заранее подтвердить запись.";
      return `До следующего визита ${days} дней. Если планы изменились — перенесите запись заранее.`;
    }
    if (lastVisit?.startAtIso) {
      const days = Math.abs(daysDiff(new Date(lastVisit.startAtIso), new Date()));
      if (days < 7) return "Вы недавно были у нас. Хотите повторить услугу позже?";
      if (days < 30) return "Прошло несколько недель с последнего визита. Предложить удобное время?";
      return "Давно не виделись. Мы можем быстро подобрать удобное время записи.";
    }
    return "Начните с первой записи — мы подскажем лучшие варианты по времени и мастерам.";
  }, [nextAppointment?.startAtIso, lastVisit?.startAtIso]);

  const handleOrgChange = (value: string) => {
    if (!value) {
      window.location.href = "/c";
      return;
    }
    window.location.href = `/c?account=${value}`;
  };

  const showOrgPicker = organizations.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[color:var(--bp-muted)]">
            Клиентский кабинет
          </div>
          <div className="mt-1 text-2xl font-semibold">{displayName}</div>
          <div className="text-sm text-[color:var(--bp-muted)]">
            {accountName || "Маркетплейс услуг"}
          </div>
        </div>
        <a
          href={bookLink}
          className="inline-flex items-center justify-center rounded-[var(--site-button-radius)] bg-[color:var(--site-client-button)] px-4 py-2 text-sm font-semibold text-[color:var(--site-client-button-text)] shadow-[var(--bp-shadow)] transition hover:opacity-90"
        >
          Записаться
        </a>
      </div>

      {showOrgPicker ? (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm">
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Организация
          </span>
          <select
            className="rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-sm"
            value={accountSlug ?? ""}
            onChange={(event) => handleOrgChange(event.target.value)}
          >
            <option value="">Все организации</option>
            {organizations.map((org) => (
              <option key={org.slug} value={org.slug}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabLabels.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              activeTab === tab.key
                ? "border-[color:var(--site-client-button)] bg-[color:var(--site-client-button)] text-[color:var(--site-client-button-text)]"
                : "border-[color:var(--bp-stroke)] text-[color:var(--bp-muted)] hover:border-[color:var(--site-client-button)] hover:text-[color:var(--site-client-button)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
              <div className="text-sm font-semibold">Следующая запись</div>
              {nextAppointment ? (
                <div className="mt-3 flex flex-col gap-2 text-sm">
                  <div className="text-lg font-semibold">{nextAppointment.dateLabel}</div>
                  <div className="text-[color:var(--bp-muted)]">{nextAppointment.timeLabel}</div>
                  <div>{nextAppointment.servicesLabel || "Услуга"}</div>
                  <div className="text-[color:var(--bp-muted)]">
                    {nextAppointment.specialistName ? `${nextAppointment.specialistName} · ` : ""}
                    {nextAppointment.locationName}
                  </div>
                  {nextAppointment.accountName ? (
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      {nextAppointment.accountName}
                    </div>
                  ) : null}
                  {nextAppointment.locationAddress ? (
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      {nextAppointment.locationAddress}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 text-sm text-[color:var(--bp-muted)]">
                  Пока нет ближайших записей.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
              <div className="text-sm font-semibold">Умные подсказки</div>
              <div className="mt-3 text-sm text-[color:var(--bp-muted)]">{smartHint}</div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
              <div className="text-sm font-semibold">Лояльность</div>
              <div className="mt-2 text-3xl font-semibold">
                {formatCurrency(loyaltySummary.balance)}
              </div>
              <div className="text-xs text-[color:var(--bp-muted)]">
                Статус: {loyaltySummary.level}
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5 text-sm">
              <div className="text-sm font-semibold">Контакты</div>
              <div className="mt-2">{accountPhone || "Контактный телефон не указан"}</div>
              {accountAddress ? (
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{accountAddress}</div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5 text-sm">
              <div className="text-sm font-semibold">Каталог организаций</div>
              <div className="mt-3 flex flex-col gap-3">
                {organizations.length > 0 ? (
                  organizations.map((org) => (
                    <div key={org.slug} className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{org.name}</div>
                      <a
                        href={org.bookingLink}
                        className="inline-flex items-center justify-center rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold text-[color:var(--bp-ink)] transition hover:border-[color:var(--site-client-button)] hover:text-[color:var(--site-client-button)]"
                      >
                        Записаться
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    Пока нет организаций, где вы были.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "appointments" ? (
        <ClientAppointments
          accountSlug={accountSlug}
          upcoming={upcoming}
          history={history}
          cancellationWindowHours={cancellationWindowHours}
        />
      ) : null}

      {activeTab === "loyalty" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
            <div className="text-sm font-semibold">Баланс бонусов</div>
            <div className="mt-2 text-3xl font-semibold">
              {formatCurrency(loyalty.balance ?? 0)}
            </div>
            <div className="text-xs text-[color:var(--bp-muted)]">
              Статус: {loyaltySummary.level}
            </div>
          </div>
          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
            <div className="text-sm font-semibold">История бонусов</div>
            <div className="mt-3 flex flex-col gap-2 text-xs text-[color:var(--bp-muted)]">
              {loyalty.transactions.length > 0 ? (
                loyalty.transactions.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between">
                    <span>
                      {formatDate(entry.createdAt, entry.accountTimeZone || accountTimeZone)}
                      {entry.accountName ? ` · ${entry.accountName}` : ""}
                    </span>
                    <span>
                      {entry.amount >= 0 ? "+" : ""}
                      {entry.amount}
                    </span>
                  </div>
                ))
              ) : (
                <div>История бонусов появится после первой записи.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "payments" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
            <div className="text-sm font-semibold">Платежи</div>
            <div className="mt-3 flex flex-col gap-3 text-sm">
              {payments.intents.length > 0 ? (
                payments.intents.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{formatCurrency(item.amount)}</div>
                      <div className="text-xs text-[color:var(--bp-muted)]">{item.status}</div>
                    </div>
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      {formatDate(item.createdAt, item.accountTimeZone || accountTimeZone, true)}
                    </div>
                    {item.accountName ? (
                      <div className="text-xs text-[color:var(--bp-muted)]">{item.accountName}</div>
                    ) : null}
                    {item.provider ? (
                      <div className="text-xs text-[color:var(--bp-muted)]">{item.provider}</div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-[color:var(--bp-muted)]">Платежей пока нет.</div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
            <div className="text-sm font-semibold">Транзакции</div>
            <div className="mt-3 flex flex-col gap-3 text-sm">
              {payments.transactions.length > 0 ? (
                payments.transactions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{formatCurrency(item.amount)}</div>
                      <div className="text-xs text-[color:var(--bp-muted)]">{item.type}</div>
                    </div>
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      {formatDate(item.createdAt, item.accountTimeZone || accountTimeZone, true)}
                    </div>
                    {item.accountName ? (
                      <div className="text-xs text-[color:var(--bp-muted)]">{item.accountName}</div>
                    ) : null}
                    {item.providerRef ? (
                      <div className="text-xs text-[color:var(--bp-muted)]">{item.providerRef}</div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-[color:var(--bp-muted)]">
                  История транзакций появится после оплат.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "documents" ? (
        <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
          <div className="text-sm font-semibold">Подписанные документы</div>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            {documents.length > 0 ? (
              documents.map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{doc.title}</div>
                    <div className="text-xs text-[color:var(--bp-muted)]">Версия {doc.version}</div>
                    {doc.accountName ? (
                      <div className="text-xs text-[color:var(--bp-muted)]">{doc.accountName}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    {formatDate(doc.acceptedAt, doc.accountTimeZone || accountTimeZone, true)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-[color:var(--bp-muted)]">Нет подписанных документов.</div>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "reviews" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
            {accountSlug ? (
              <ClientReviewForm
                accountSlug={accountSlug}
                initialRating={latestReview?.rating ?? null}
                initialComment={latestReview?.comment ?? null}
                onSaved={(payload) => {
                  setReviewItems((prev) => [
                    {
                      id: prev[0]?.id ?? Date.now(),
                      rating: payload.rating,
                      comment: payload.comment,
                      createdAt: payload.createdAt,
                      accountName: accountName ?? null,
                      accountTimeZone,
                    },
                    ...prev.slice(1),
                  ]);
                }}
              />
            ) : (
              <div className="text-sm text-[color:var(--bp-muted)]">
                Выберите организацию, чтобы оставить отзыв.
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
            <div className="text-sm font-semibold">История отзывов</div>
            <div className="mt-3 flex flex-col gap-3 text-sm">
              {reviewItems.length > 0 ? (
                reviewItems.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Оценка: {review.rating}/5</div>
                      <div className="text-xs text-[color:var(--bp-muted)]">
                        {formatDate(review.createdAt, review.accountTimeZone || accountTimeZone, true)}
                      </div>
                    </div>
                    {review.accountName ? (
                      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{review.accountName}</div>
                    ) : null}
                    {review.comment ? (
                      <div className="mt-2 text-xs text-[color:var(--bp-muted)]">{review.comment}</div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-[color:var(--bp-muted)]">Пока нет отзывов.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "profile" ? (
        accountSlug ? (
          <ClientProfileForm accountSlug={accountSlug} initialProfile={profile} />
        ) : (
          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5 text-sm text-[color:var(--bp-muted)]">
            Выберите организацию, чтобы изменить профиль клиента для этой организации.
          </div>
        )
      ) : null}

      {activeTab === "support" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5 text-sm">
            <div className="text-sm font-semibold">Поддержка</div>
            <div className="mt-2 text-[color:var(--bp-muted)]">
              Мы поможем изменить запись, ответим на вопросы и подскажем лучшие услуги.
            </div>
            <div className="mt-3">{accountPhone || "Контактный телефон не указан"}</div>
          </div>
          <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5 text-sm">
            <div className="text-sm font-semibold">Умные подсказки</div>
            <div className="mt-2 text-[color:var(--bp-muted)]">
              Система сама напомнит о повторной записи и подберёт подходящее время без лишних шагов.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
