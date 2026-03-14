"use client";

import { useState } from "react";

type ClientProfileFormProps = {
  accountSlug: string;
  initialProfile: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
};

export default function ClientProfileForm({
  accountSlug,
  initialProfile,
}: ClientProfileFormProps) {
  const [firstName, setFirstName] = useState(initialProfile.firstName ?? "");
  const [lastName, setLastName] = useState(initialProfile.lastName ?? "");
  const [phone, setPhone] = useState(initialProfile.phone ?? "");
  const [email, setEmail] = useState(initialProfile.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const response = await fetch(
        `/api/v1/client/profile?account=${encodeURIComponent(accountSlug)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, phone, email }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "Не удалось обновить профиль.");
        return;
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-5">
      <div className="text-lg font-semibold">Профиль</div>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-medium">
          Имя
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
          />
        </label>
        <label className="text-sm font-medium">
          Фамилия
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
          />
        </label>
        <label className="text-sm font-medium">
          Телефон
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
          />
        </label>
        <label className="text-sm font-medium">
          Эл. почта
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)]"
          />
        </label>
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {saved ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            Профиль обновлён.
          </div>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="mt-2 inline-flex items-center justify-center rounded-[var(--site-button-radius)] bg-[color:var(--site-client-button)] px-4 py-2 text-sm font-semibold text-[color:var(--site-client-button-text)] shadow-[var(--bp-shadow)] transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
    </section>
  );
}
