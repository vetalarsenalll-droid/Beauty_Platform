"use client";

import { useCallback, useState } from "react";
import LocationAddressField, {
  findAddressGeo,
  type LocationGeo,
} from "./location-address-field";

export default function LocationCreateForm() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [geo, setGeo] = useState<LocationGeo | null>(null);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeoChange = useCallback((nextGeo: LocationGeo | null) => {
    setGeo(nextGeo);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const resolvedGeo = geo ?? (await findAddressGeo(address));
    if (!resolvedGeo) {
      setError("Выберите адрес из подсказок, чтобы мы определили координаты.");
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      address: address.trim(),
      description: description.trim() ? description.trim() : null,
      phone: phone.trim() ? phone.trim() : null,
      status,
    };

    payload.geo = { lat: resolvedGeo.lat, lng: resolvedGeo.lng };

    try {
      const response = await fetch("/api/v1/crm/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось создать локацию.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Не удалось создать локацию.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
        <LocationAddressField
          value={address}
          onChange={setAddress}
          onGeoChange={handleGeoChange}
        />
      </div>
      <label className="flex flex-col gap-2 text-sm">
        Описание
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
        />
      </label>
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
          Статус
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          >
            <option value="ACTIVE">Активна</option>
            <option value="INACTIVE">Неактивна</option>
          </select>
        </label>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Сохраняем..." : "Создать локацию"}
      </button>
    </form>
  );
}
