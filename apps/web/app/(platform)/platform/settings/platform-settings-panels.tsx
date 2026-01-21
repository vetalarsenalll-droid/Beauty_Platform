"use client";

import { useMemo, useState } from "react";

type PlatformSettingsPanelsProps = {
  settings: Record<string, unknown>;
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

const BILLING_KEY = "platform.billing";
const CONTACTS_KEY = "platform.contacts";

export default function PlatformSettingsPanels({
  settings,
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

  const [billing, setBilling] = useState<BillingSettings>(initialBilling);
  const [contacts, setContacts] = useState<ContactsSettings>(initialContacts);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Платежные настройки</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Выберите провайдера и заполните ключи доступа.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Провайдер
            <select
              value={billing.provider}
              onChange={(event) =>
                setBilling((prev) => ({
                  ...prev,
                  provider: event.target
                    .value as BillingSettings["provider"],
                }))
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
            >
              <option value="manual">Ручной ввод</option>
              <option value="yookassa">ЮKassa</option>
              <option value="tinkoff">Тинькофф</option>
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

        {billing.provider === "yookassa" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              ЮKassa Shop ID
              <input
                value={billing.yookassaShopId ?? ""}
                onChange={(event) =>
                  setBilling((prev) => ({
                    ...prev,
                    yookassaShopId: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              ЮKassa Secret Key
              <input
                value={billing.yookassaSecret ?? ""}
                onChange={(event) =>
                  setBilling((prev) => ({
                    ...prev,
                    yookassaSecret: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              ЮKassa Webhook Secret
              <input
                value={billing.yookassaWebhookSecret ?? ""}
                onChange={(event) =>
                  setBilling((prev) => ({
                    ...prev,
                    yookassaWebhookSecret: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
            </label>
          </div>
        ) : null}

        {billing.provider === "tinkoff" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              Тинькофф Terminal Key
              <input
                value={billing.tinkoffTerminalKey ?? ""}
                onChange={(event) =>
                  setBilling((prev) => ({
                    ...prev,
                    tinkoffTerminalKey: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Тинькофф Secret Key
              <input
                value={billing.tinkoffSecretKey ?? ""}
                onChange={(event) =>
                  setBilling((prev) => ({
                    ...prev,
                    tinkoffSecretKey: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Тинькофф Webhook Secret
              <input
                value={billing.tinkoffWebhookSecret ?? ""}
                onChange={(event) =>
                  setBilling((prev) => ({
                    ...prev,
                    tinkoffWebhookSecret: event.target.value,
                  }))
                }
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => save([{ key: BILLING_KEY, valueJson: billing }])}
            disabled={saving}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold"
          >
            {saving ? "Сохранение..." : "Сохранить платежные настройки"}
          </button>
        </div>
      </section>

      {/* SEO блок включим позже после полной спецификации Marketplace */}

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
