"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CategoryOption = {
  id: number;
  name: string;
};

type ServiceSummary = {
  id: number;
  name: string;
  description: string | null;
  searchKeywords: string | null;
  synonyms: string | null;
  baseDurationMin: number;
  basePrice: string;
  isActive: boolean;
  allowMultiServiceBooking: boolean;
  bookingType: "SINGLE" | "GROUP";
  groupCapacityDefault: number | null;
  categoryId: number | null;
};

type ServiceProfileFormProps = {
  service: ServiceSummary;
  categories: CategoryOption[];
};

export default function ServiceProfileForm({
  service,
  categories,
}: ServiceProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [searchKeywords, setSearchKeywords] = useState(service.searchKeywords ?? "");
  const [synonyms, setSynonyms] = useState(service.synonyms ?? "");
  const [baseDurationMin, setBaseDurationMin] = useState(
    String(service.baseDurationMin)
  );
  const [basePrice, setBasePrice] = useState(service.basePrice);
  const [categoryId, setCategoryId] = useState(
    service.categoryId !== null ? String(service.categoryId) : ""
  );
  const [isActive, setIsActive] = useState(service.isActive);
  const [allowMultiServiceBooking, setAllowMultiServiceBooking] = useState(
    service.allowMultiServiceBooking ?? false
  );
  const [bookingType, setBookingType] = useState<"SINGLE" | "GROUP">(
    service.bookingType ?? "SINGLE"
  );
  const [groupCapacityDefault, setGroupCapacityDefault] = useState(
    service.groupCapacityDefault != null ? String(service.groupCapacityDefault) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch(`/api/v1/crm/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() ? description.trim() : null,
          searchKeywords: searchKeywords.trim() ? searchKeywords.trim() : null,
          synonyms: synonyms.trim() ? synonyms.trim() : null,
          baseDurationMin,
          basePrice,
          categoryId: categoryId ? Number(categoryId) : null,
          isActive,
          allowMultiServiceBooking,
          bookingType,
          groupCapacityDefault:
            bookingType === "GROUP" && groupCapacityDefault.trim()
              ? Number(groupCapacityDefault)
              : null,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Не удалось сохранить услугу.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось сохранить услугу.");
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
          Категория
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          >
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        Описание
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-[96px] rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Ключевые слова для поиска
          <textarea
            value={searchKeywords}
            onChange={(event) => setSearchKeywords(event.target.value)}
            className="min-h-[84px] rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например: укладка, волосы, прическа"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Синонимы услуги
          <textarea
            value={synonyms}
            onChange={(event) => setSynonyms(event.target.value)}
            className="min-h-[84px] rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            placeholder="Например: вечерняя прическа, сделать волосы"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          Длительность, мин
          <input
            value={baseDurationMin}
            onChange={(event) => setBaseDurationMin(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Базовая цена
          <input
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Статус
          <select
            value={isActive ? "active" : "inactive"}
            onChange={(event) => setIsActive(event.target.value === "active")}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          >
            <option value="active">Активна</option>
            <option value="inactive">В архиве</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm">
          Тип записи
          <select
            value={bookingType}
            onChange={(event) => setBookingType(event.target.value as "SINGLE" | "GROUP")}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
          >
            <option value="SINGLE">Одиночная</option>
            <option value="GROUP">Групповая</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Мест в группе
          <input
            value={groupCapacityDefault}
            onChange={(event) => setGroupCapacityDefault(event.target.value)}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-2 text-[color:var(--bp-ink)]"
            disabled={bookingType !== "GROUP"}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allowMultiServiceBooking}
          onChange={(event) => setAllowMultiServiceBooking(event.target.checked)}
        />
        Разрешить запись на несколько услуг
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
