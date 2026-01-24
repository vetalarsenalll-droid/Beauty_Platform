"use client";

import { useState } from "react";

type LevelOption = {
  id: number;
  name: string;
};

type SpecialistItem = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  levelId: number | null;
  bio: string | null;
};

type SpecialistRowActionsProps = {
  specialist: SpecialistItem;
  levels: LevelOption[];
};

export default function SpecialistRowActions({
  specialist,
  levels,
}: SpecialistRowActionsProps) {
  const [firstName, setFirstName] = useState(specialist.firstName ?? "");
  const [lastName, setLastName] = useState(specialist.lastName ?? "");
  const [email, setEmail] = useState(specialist.email ?? "");
  const [phone, setPhone] = useState(specialist.phone ?? "");
  const [status, setStatus] = useState(specialist.status);
  const [levelId, setLevelId] = useState(
    specialist.levelId !== null ? String(specialist.levelId) : ""
  );
  const [bio, setBio] = useState(specialist.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/specialists/${specialist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName: lastName.trim() ? lastName.trim() : null,
          email,
          phone: phone.trim() ? phone.trim() : null,
          status,
          levelId: levelId ? Number(levelId) : null,
          bio: bio.trim() ? bio.trim() : null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось обновить сотрудника.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось обновить сотрудника.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/specialists/${specialist.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось отключить сотрудника.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось отключить сотрудника.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Имя
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Фамилия
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Телефон
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Уровень
          <select
            value={levelId}
            onChange={(event) => setLevelId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          >
            <option value="">Без уровня</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Статус
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          >
            <option value="INVITED">Приглашен</option>
            <option value="ACTIVE">Активен</option>
            <option value="DISABLED">Отключен</option>
          </select>
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
        Описание
        <input
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
        >
          {saving ? "..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={saving}
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs text-red-600"
        >
          Отключить
        </button>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
