"use client";

import { useState } from "react";

export default function ClientCreateForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/v1/crm/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось создать клиента.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось создать клиента.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Имя
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Фамилия
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Телефон
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Создание..." : "Создать клиента"}
      </button>
    </form>
  );
}
