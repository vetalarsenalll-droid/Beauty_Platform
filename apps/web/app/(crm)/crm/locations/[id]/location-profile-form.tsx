"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LocationProfileFormProps = {
  location: {
    id: number;
    name: string;
    address: string;
    phone: string | null;
    status: string;
    websiteUrl: string | null;
    instagramUrl: string | null;
    whatsappUrl: string | null;
    telegramUrl: string | null;
    maxUrl: string | null;
    vkUrl: string | null;
    viberUrl: string | null;
    pinterestUrl: string | null;
    geo: { lat: number; lng: number } | null;
  };
};

export default function LocationProfileForm({
  location,
}: LocationProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address);
  const [phone, setPhone] = useState(location.phone ?? "");
  const [status, setStatus] = useState(location.status);
  const [websiteUrl, setWebsiteUrl] = useState(location.websiteUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(location.instagramUrl ?? "");
  const [whatsappUrl, setWhatsappUrl] = useState(location.whatsappUrl ?? "");
  const [telegramUrl, setTelegramUrl] = useState(location.telegramUrl ?? "");
  const [maxUrl, setMaxUrl] = useState(location.maxUrl ?? "");
  const [vkUrl, setVkUrl] = useState(location.vkUrl ?? "");
  const [viberUrl, setViberUrl] = useState(location.viberUrl ?? "");
  const [pinterestUrl, setPinterestUrl] = useState(
    location.pinterestUrl ?? ""
  );
  const [lat, setLat] = useState(
    location.geo ? String(location.geo.lat) : ""
  );
  const [lng, setLng] = useState(
    location.geo ? String(location.geo.lng) : ""
  );
  const [clearGeo, setClearGeo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim() ? phone.trim() : null,
      status,
      websiteUrl: websiteUrl.trim() ? websiteUrl.trim() : null,
      instagramUrl: instagramUrl.trim() ? instagramUrl.trim() : null,
      whatsappUrl: whatsappUrl.trim() ? whatsappUrl.trim() : null,
      telegramUrl: telegramUrl.trim() ? telegramUrl.trim() : null,
      maxUrl: maxUrl.trim() ? maxUrl.trim() : null,
      vkUrl: vkUrl.trim() ? vkUrl.trim() : null,
      viberUrl: viberUrl.trim() ? viberUrl.trim() : null,
      pinterestUrl: pinterestUrl.trim() ? pinterestUrl.trim() : null,
    };

    if (clearGeo) {
      payload.geo = null;
    } else if (lat.trim() && lng.trim()) {
      const parsedLat = Number(lat);
      const parsedLng = Number(lng);
      if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
        setError("Широта и долгота должны быть числом.");
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
        setError(body?.error?.message ?? "Не удалось сохранить локацию.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось сохранить локацию.");
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
        <label className="flex flex-col gap-2 text-sm">
          Адрес
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            required
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Широта
          <input
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            placeholder="55.7558"
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Долгота
          <input
            value={lng}
            onChange={(event) => setLng(event.target.value)}
            placeholder="37.6176"
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
      </div>
      {location.geo ? (
        <label className="flex items-center gap-2 text-sm text-[color:var(--bp-muted)]">
          <input
            type="checkbox"
            checked={clearGeo}
            onChange={(event) => setClearGeo(event.target.checked)}
          />
          Удалить координаты
        </label>
      ) : null}
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
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Сайт
          <div className="flex items-center gap-2">
            <img
              src="/assets/socials/website.png"
              alt=""
              className="h-6 w-6"
            />
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="example.ru"
              className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            />
          </div>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Instagram
          <div className="flex items-center gap-2">
            <img
              src="/assets/socials/instagram.png"
              alt=""
              className="h-6 w-6"
            />
            <input
              value={instagramUrl}
              onChange={(event) => setInstagramUrl(event.target.value)}
              placeholder="username"
              className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            />
          </div>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          WhatsApp
          <div className="flex items-center gap-2">
            <img
              src="/assets/socials/whatsapp.png"
              alt=""
              className="h-6 w-6"
            />
            <input
              value={whatsappUrl}
              onChange={(event) => setWhatsappUrl(event.target.value)}
              placeholder="79990001122"
              className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            />
          </div>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Telegram
          <div className="flex items-center gap-2">
            <img
              src="/assets/socials/telegram.png"
              alt=""
              className="h-6 w-6"
            />
            <input
              value={telegramUrl}
              onChange={(event) => setTelegramUrl(event.target.value)}
              placeholder="username"
              className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            />
          </div>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          MAX
          <div className="flex items-center gap-2">
            <img
              src="/assets/socials/max.png"
              alt=""
              className="h-6 w-6"
            />
            <input
              value={maxUrl}
              onChange={(event) => setMaxUrl(event.target.value)}
              placeholder="username"
              className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            />
          </div>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          VK
          <div className="flex items-center gap-2">
            <img
              src="/assets/socials/vk.png"
              alt=""
              className="h-6 w-6"
            />
            <input
              value={vkUrl}
              onChange={(event) => setVkUrl(event.target.value)}
              placeholder="username"
              className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            />
          </div>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Viber
          <div className="flex items-center gap-2">
            <img
              src="/assets/socials/viber.png"
              alt=""
              className="h-6 w-6"
            />
            <input
              value={viberUrl}
              onChange={(event) => setViberUrl(event.target.value)}
              placeholder="79990001122"
              className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            />
          </div>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Pinterest
          <div className="flex items-center gap-2">
            <img
              src="/assets/socials/pinterest.png"
              alt=""
              className="h-6 w-6"
            />
            <input
              value={pinterestUrl}
              onChange={(event) => setPinterestUrl(event.target.value)}
              placeholder="username"
              className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            />
          </div>
        </label>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm font-semibold"
      >
        {saving ? "Сохраняем..." : "Сохранить"}
      </button>
    </form>
  );
}
