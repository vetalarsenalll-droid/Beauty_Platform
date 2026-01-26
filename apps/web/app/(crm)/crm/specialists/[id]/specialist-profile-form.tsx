"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LevelOption = {
  id: number;
  name: string;
};

type SpecialistSummary = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  levelId: number | null;
  bio: string | null;
};

type SpecialistProfileFormProps = {
  specialist: SpecialistSummary;
  levels: LevelOption[];
};

export default function SpecialistProfileForm({
  specialist,
  levels,
}: SpecialistProfileFormProps) {
  const router = useRouter();
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch(
        `/api/v1/crm/specialists/${specialist.id}`,
        {
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
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось сохранить специалиста.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось сохранить специалиста.");
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
      <div className="grid gap-3 md:grid-cols-2">
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
        <label className="flex flex-col gap-2 text-sm">
          Уровень
          <select
            value={levelId}
            onChange={(event) => setLevelId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          >
            <option value="">Без уровня</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-2 text-sm">
        Описание
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="min-h-[110px] rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
        />
      </label>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </form>
  );
}