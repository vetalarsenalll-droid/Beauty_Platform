"use client";

import { useState } from "react";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

type BookingSettings = {
  slotStepMinutes: number;
  requireDeposit: boolean;
  requirePaymentToConfirm: boolean;
  cancellationWindowHours: number | null;
  rescheduleWindowHours: number | null;
  holdTtlMinutes: number | null;
  defaultReminderHours: number | null;
};

type LegalDoc = {
  id?: number;
  key: string;
  title: string;
  description?: string | null;
  isRequired: boolean;
  sortOrder: number;
  content: string;
  versionId?: number | null;
  version?: number | null;
};

type AccountProfile = {
  description: string;
  phone: string;
  email: string;
  address: string;
  websiteUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
  telegramUrl: string;
  maxUrl: string;
  vkUrl: string;
  viberUrl: string;
  pinterestUrl: string;
};

type SettingsClientProps = {
  initialBooking: BookingSettings;
  initialLegalDocs: LegalDoc[];
  initialProfile: AccountProfile;
};

const tabs = [
  { key: "booking", label: "Бронирование" },
  { key: "legal", label: "Документы" },
  { key: "profile", label: "Профиль аккаунта" },
];

export default function SettingsClient({
  initialBooking,
  initialLegalDocs,
  initialProfile,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState("booking");
  const [booking, setBooking] = useState(initialBooking);
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>(initialLegalDocs);
  const [profile, setProfile] = useState<AccountProfile>(initialProfile);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const saveBooking = async () => {
    setSaving("booking");
    setMessage(null);
    const response = await fetch("/api/v1/crm/settings/booking", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
    if (response.ok) {
      const data = await response.json();
      setBooking(data.data);
      setMessage("Настройки бронирования сохранены.");
    } else {
      setMessage("Не удалось сохранить настройки.");
    }
    setSaving(null);
  };

  const saveLegal = async () => {
    setSaving("legal");
    setMessage(null);
    const payload = {
      documents: legalDocs.map((doc, index) => ({
        ...doc,
        key: doc.key || slugify(doc.title || `doc-${index + 1}`),
        sortOrder: doc.sortOrder ?? index,
      })),
    };
    const response = await fetch("/api/v1/crm/settings/legal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const data = await response.json();
      setLegalDocs(data.data);
      setMessage("Документы сохранены.");
    } else {
      setMessage("Не удалось сохранить документы.");
    }
    setSaving(null);
  };

  const saveProfile = async () => {
    setSaving("profile");
    setMessage(null);
    const response = await fetch("/api/v1/crm/settings/account-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (response.ok) {
      const data = await response.json();
      setProfile(data.data);
      setMessage("Профиль аккаунта сохранен.");
    } else {
      setMessage("Не удалось сохранить профиль.");
    }
    setSaving(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeTab === tab.key
                ? "bg-[color:var(--bp-ink)] text-white"
                : "border border-[color:var(--bp-stroke)] bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {activeTab === "booking" && (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Политики записи</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Шаг слота (мин)
              <input
                type="number"
                min={5}
                step={5}
                value={booking.slotStepMinutes}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    slotStepMinutes: Number(e.target.value),
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Время удержания слота (мин)
              <input
                type="number"
                min={1}
                value={booking.holdTtlMinutes ?? ""}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    holdTtlMinutes: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Окно отмены (часы)
              <input
                type="number"
                min={0}
                value={booking.cancellationWindowHours ?? ""}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    cancellationWindowHours: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Окно переноса (часы)
              <input
                type="number"
                min={0}
                value={booking.rescheduleWindowHours ?? ""}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    rescheduleWindowHours: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Напоминание по умолчанию (часы)
              <input
                type="number"
                min={0}
                value={booking.defaultReminderHours ?? ""}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    defaultReminderHours: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={booking.requireDeposit}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    requireDeposit: e.target.checked,
                  }))
                }
              />
              Требовать депозит
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={booking.requirePaymentToConfirm}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    requirePaymentToConfirm: e.target.checked,
                  }))
                }
              />
              Подтверждать запись только после оплаты
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveBooking}
              className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
              disabled={saving === "booking"}
            >
              {saving === "booking" ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "legal" && (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Документы и согласия</h2>
            <button
              type="button"
              onClick={() =>
                setLegalDocs((prev) => [
                  ...prev,
                  {
                    key: "",
                    title: "",
                    description: "",
                    isRequired: true,
                    sortOrder: prev.length,
                    content: "",
                  },
                ])
              }
              className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-sm"
            >
              Добавить документ
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {legalDocs.map((doc, index) => (
              <div
                key={`${doc.key}-${index}`}
                className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    Название
                    <input
                      value={doc.title}
                      onChange={(e) =>
                        setLegalDocs((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, title: e.target.value } : item
                          )
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
                    />
                  </label>
                </div>

                <label className="mt-3 text-sm block">
                  Описание
                  <input
                    value={doc.description ?? ""}
                    onChange={(e) =>
                      setLegalDocs((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, description: e.target.value }
                            : item
                        )
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
                  />
                </label>

                <div className="mt-3 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={doc.isRequired}
                      onChange={(e) =>
                        setLegalDocs((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, isRequired: e.target.checked }
                              : item
                          )
                        )
                      }
                    />
                    Обязательный
                  </label>

                  <label className="text-sm">
                    Порядок
                    <input
                      type="number"
                      min={0}
                      value={doc.sortOrder}
                      onChange={(e) =>
                        setLegalDocs((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, sortOrder: Number(e.target.value) }
                              : item
                          )
                        )
                      }
                      className="ml-2 w-20 rounded-xl border border-[color:var(--bp-stroke)] px-2 py-1"
                    />
                  </label>
                </div>

                <label className="mt-3 text-sm block">
                  Текст документа
                  <textarea
                    value={doc.content}
                    onChange={(e) =>
                      setLegalDocs((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, content: e.target.value } : item
                        )
                      )
                    }
                    rows={6}
                    className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveLegal}
              className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
              disabled={saving === "legal"}
            >
              {saving === "legal" ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </section>
      )}

      {activeTab === "profile" && (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Профиль аккаунта</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              Описание
              <textarea
                value={profile.description}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={4}
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Телефон
              <input
                value={profile.phone}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, phone: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Email
              <input
                value={profile.email}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, email: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm md:col-span-2">
              Адрес
              <input
                value={profile.address}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, address: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Сайт
              <input
                value={profile.websiteUrl}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, websiteUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Instagram
              <input
                value={profile.instagramUrl}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, instagramUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              WhatsApp
              <input
                value={profile.whatsappUrl}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, whatsappUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Telegram
              <input
                value={profile.telegramUrl}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, telegramUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              MAX
              <input
                value={profile.maxUrl}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, maxUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              VK
              <input
                value={profile.vkUrl}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, vkUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Viber
              <input
                value={profile.viberUrl}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, viberUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Pinterest
              <input
                value={profile.pinterestUrl}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, pinterestUrl: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-white px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveProfile}
              className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
              disabled={saving === "profile"}
            >
              {saving === "profile" ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
