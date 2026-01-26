"use client";

import { useState } from "react";

type ManagerCreateFormProps = {
  onCreated?: () => void;
};

export default function ManagerCreateForm({ onCreated }: ManagerCreateFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("INVITED");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      firstName,
      lastName: lastName.trim() ? lastName.trim() : null,
      email,
      phone: phone.trim() ? phone.trim() : null,
      status,
    };

    try {
      const response = await fetch("/api/v1/crm/managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось создать менеджера.");
        return;
      }
      if (onCreated) {
        onCreated();
      } else {
        window.location.reload();
      }
    } catch {
      setError("Не удалось создать менеджера.");
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
            required
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
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Телефон
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm">
        Статус
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
        >
          <option value="INVITED">Приглашен</option>
          <option value="ACTIVE">Активен</option>
          <option value="DISABLED">В архиве</option>
        </select>
      </label>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Создание..." : "Создать менеджера"}
      </button>
    </form>
  );
}