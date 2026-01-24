"use client";

import { useState } from "react";

type LocationItem = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  status: string;
  geo: { lat: number; lng: number } | null;
};

type LocationRowActionsProps = {
  location: LocationItem;
};

export default function LocationRowActions({
  location,
}: LocationRowActionsProps) {
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address);
  const [phone, setPhone] = useState(location.phone ?? "");
  const [status, setStatus] = useState(location.status);
  const [lat, setLat] = useState(
    location.geo?.lat !== undefined ? String(location.geo.lat) : ""
  );
  const [lng, setLng] = useState(
    location.geo?.lng !== undefined ? String(location.geo.lng) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name,
      address,
      phone: phone.trim() ? phone.trim() : null,
      status,
    };

    if (lat.trim() || lng.trim()) {
      const parsedLat = Number(lat);
      const parsedLng = Number(lng);
      if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
        setError("Координаты должны быть числом.");
        setSaving(false);
        return;
      }
      payload.geo = { lat: parsedLat, lng: parsedLng };
    }

    try {
      const response = await fetch(`/api/v1/crm/locations/${location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось обновить локацию.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось обновить локацию.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/crm/locations/${location.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось удалить локацию.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось удалить локацию.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1.2fr_1fr_0.6fr]">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Адрес
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Телефон
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Статус
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          >
            <option value="ACTIVE">Активна</option>
            <option value="INACTIVE">Неактивна</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Широта
          <input
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            placeholder="55.7558"
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Долгота
          <input
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            placeholder="37.6176"
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm text-[color:var(--bp-ink)]"
          />
        </label>
        <div className="flex items-end gap-2">
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
            Удалить
          </button>
        </div>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
