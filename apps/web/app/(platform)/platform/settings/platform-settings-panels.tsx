"use client";

import { useMemo, useState } from "react";

type PlatformSettingsPanelsProps = {
  settings: Record<string, unknown>;
  plans: Array<{ id: number; name: string }>;
};

type BillingSettings = {
  provider: "manual" | "yookassa" | "tinkoff";
  yookassaShopId?: string;
  yookassaSecret?: string;
  yookassaWebhookSecret?: string;
  tinkoffTerminalKey?: string;
  tinkoffSecretKey?: string;
  tinkoffWebhookSecret?: string;
  sbpEnabled?: boolean;
};

type ContactsSettings = {
  supportEmail?: string;
  supportPhone?: string;
  website?: string;
};

type PlatformSubscriptionSettings = {
  trialEnabled: boolean;
  trialDays: number;
  trialPlanId: number | null;
};

const BILLING_KEY = "platform.billing";
const CONTACTS_KEY = "platform.contacts";
const PLATFORM_SUBSCRIPTION_SETTINGS_KEY = "platform.subscription";

function normalizePlatformSubscriptionSettings(raw: unknown): PlatformSubscriptionSettings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { trialEnabled: true, trialDays: 14, trialPlanId: null };
  }

  const value = raw as Record<string, unknown>;
  const trialDays = Number(value.trialDays);
  const trialPlanId = Number(value.trialPlanId);
  return {
    trialEnabled:
      typeof value.trialEnabled === "boolean" ? value.trialEnabled : true,
    trialDays: Number.isInteger(trialDays) && trialDays > 0 ? trialDays : 14,
    trialPlanId: Number.isInteger(trialPlanId) && trialPlanId > 0 ? trialPlanId : null,
  };
}

export default function PlatformSettingsPanels({
  settings,
  plans,
}: PlatformSettingsPanelsProps) {
  const initialBilling = useMemo<BillingSettings>(() => {
    const raw = settings[BILLING_KEY];
    return typeof raw === "object" && raw !== null
      ? (raw as BillingSettings)
      : { provider: "manual", sbpEnabled: false };
  }, [settings]);

  const initialContacts = useMemo<ContactsSettings>(() => {
    const raw = settings[CONTACTS_KEY];
    return typeof raw === "object" && raw !== null
      ? (raw as ContactsSettings)
      : {};
  }, [settings]);

  const initialSubscription = useMemo<PlatformSubscriptionSettings>(
    () => normalizePlatformSubscriptionSettings(settings[PLATFORM_SUBSCRIPTION_SETTINGS_KEY]),
    [settings],
  );

  const [billing, setBilling] = useState<BillingSettings>(initialBilling);
  const [contacts, setContacts] = useState<ContactsSettings>(initialContacts);
  const [subscription, setSubscription] =
    useState<PlatformSubscriptionSettings>(initialSubscription);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const publicBillingSettings = (value: BillingSettings) => ({
    provider: value.provider,
    sbpEnabled: Boolean(value.sbpEnabled),
  });

  const save = async (updates: Array<{ key: string; valueJson: unknown }>) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/platform/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setMessage(payload?.error?.message ?? "Не удалось сохранить настройки");
        return;
      }
      setMessage("Настройки сохранены");
    } catch {
      setMessage("Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  const saveSubscription = () => {
    save([
      {
        key: PLATFORM_SUBSCRIPTION_SETTINGS_KEY,
        valueJson: {
          trialEnabled: subscription.trialEnabled,
          trialDays: Math.max(1, Number(subscription.trialDays) || 14),
          trialPlanId: subscription.trialPlanId,
        },
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Подписки CRM</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Эти настройки применяются к новым CRM-аккаунтам: при регистрации можно автоматически выдать пробный период.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={subscription.trialEnabled}
              onChange={(event) =>
                setSubscription((prev) => ({
                  ...prev,
                  trialEnabled: event.target.checked,
                }))
              }
            />
            Включить пробный период
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Длительность пробного периода, дней
            <input
              type="number"
              min="1"
              value={subscription.trialDays}
              onChange={(event) =>
                setSubscription((prev) => ({
                  ...prev,
                  trialDays: Number(event.target.value),
                }))
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Тариф для пробного периода
            <select
              value={subscription.trialPlanId ?? ""}
              onChange={(event) =>
                setSubscription((prev) => ({
                  ...prev,
                  trialPlanId: event.target.value ? Number(event.target.value) : null,
                }))
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            >
              <option value="">Не выдавать тариф</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-[color:var(--bp-muted)]">
          В список попадают только тарифы с признаком “Пробный”. Если пробный тариф не выбран, новым аккаунтам будет выдаваться самый дешёвый активный пробный тариф. Если таких тарифов нет, аккаунт создастся без подписки: CRM останется доступной для оплаты, публичный сайт и онлайн-запись будут отключены.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={saveSubscription}
            disabled={saving}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold"
          >
            {saving ? "Сохранение..." : "Сохранить настройки подписок"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Платёжные настройки</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Выберите провайдера и заполните публичные параметры. Секреты хранятся только в `.env`.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Провайдер
            <select
              value={billing.provider}
              onChange={(event) =>
                setBilling((prev) => ({
                  ...prev,
                  provider: event.target.value as BillingSettings["provider"],
                }))
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            >
              <option value="manual">Ручной ввод</option>
              <option value="yookassa">ЮKassa</option>
              <option value="tinkoff">Т-Банк</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(billing.sbpEnabled)}
              onChange={(event) =>
                setBilling((prev) => ({
                  ...prev,
                  sbpEnabled: event.target.checked,
                }))
              }
            />
            Включить СБП
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-3 text-sm text-[color:var(--bp-muted)]">
          Секретные ключи платёжного провайдера хранятся только в `.env`: PAYMENT_PROVIDER,
          TBANK_TERMINAL_KEY, TBANK_PASSWORD, TBANK_API_URL. В базе остаются только несекретные настройки.
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => save([{ key: BILLING_KEY, valueJson: publicBillingSettings(billing) }])}
            disabled={saving}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold"
          >
            {saving ? "Сохранение..." : "Сохранить платёжные настройки"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Контактные данные</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Контакты для поддержки и публичной связи.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Email поддержки
            <input
              value={contacts.supportEmail ?? ""}
              onChange={(event) =>
                setContacts((prev) => ({
                  ...prev,
                  supportEmail: event.target.value,
                }))
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Телефон поддержки
            <input
              value={contacts.supportPhone ?? ""}
              onChange={(event) =>
                setContacts((prev) => ({
                  ...prev,
                  supportPhone: event.target.value,
                }))
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Сайт платформы
            <input
              value={contacts.website ?? ""}
              onChange={(event) =>
                setContacts((prev) => ({
                  ...prev,
                  website: event.target.value,
                }))
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => save([{ key: CONTACTS_KEY, valueJson: contacts }])}
            disabled={saving}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold"
          >
            {saving ? "Сохранение..." : "Сохранить контакты"}
          </button>
          {message ? (
            <span className="text-sm text-[color:var(--bp-muted)]">
              {message}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
