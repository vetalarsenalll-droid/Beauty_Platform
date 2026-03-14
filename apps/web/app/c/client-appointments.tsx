"use client";

import { useMemo, useState } from "react";

type AppointmentCard = {
  id: number;
  status: string;
  statusLabel: string;
  statusTone: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string | null;
  priceLabel: string | null;
  locationName: string;
  locationAddress: string | null;
  specialistName: string | null;
  servicesLabel: string | null;
  canCancel: boolean;
  accountName?: string | null;
  accountSlug?: string | null;
};

type ClientAppointmentsProps = {
  accountSlug?: string | null;
  upcoming: AppointmentCard[];
  history: AppointmentCard[];
  cancellationWindowHours: number | null;
};

const statusToneClasses: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function ClientAppointments({
  accountSlug,
  upcoming,
  history,
  cancellationWindowHours,
}: ClientAppointmentsProps) {
  const [items, setItems] = useState(upcoming);
  const [pastItems, setPastItems] = useState(history);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState(accountSlug ?? "");

  const hasAppointments = items.length > 0 || pastItems.length > 0;
  const cancelHint = useMemo(() => {
    if (cancellationWindowHours == null) return null;
    const hours = cancellationWindowHours;
    const suffix =
      hours % 10 === 1 && hours % 100 !== 11
        ? "час"
        : hours % 10 < 5 && (hours % 100 < 10 || hours % 100 >= 20)
          ? "часа"
          : "часов";
    return `Отменить запись можно не позднее чем за ${hours} ${suffix}.`;
  }, [cancellationWindowHours]);

  const orgOptions = useMemo(() => {
    const map = new Map<string, string>();
    [...items, ...pastItems].forEach((item) => {
      if (item.accountSlug && item.accountName) {
        map.set(item.accountSlug, item.accountName);
      }
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [items, pastItems]);

  const filterItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filter = (row: AppointmentCard) => {
      if (orgFilter && row.accountSlug !== orgFilter) return false;
      if (!query) return true;
      const haystack = [
        row.servicesLabel,
        row.specialistName,
        row.locationName,
        row.locationAddress,
        row.accountName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    };
    return {
      upcoming: items.filter(filter),
      history: pastItems.filter(filter),
    };
  }, [items, pastItems, search, orgFilter]);

  const handleCancel = async (appointmentId: number, itemAccountSlug?: string | null) => {
    const confirmed = window.confirm("Отменить эту запись?");
    if (!confirmed) return;
    setError(null);
    setLoadingId(appointmentId);
    try {
      const slug = itemAccountSlug || accountSlug || "";
      const query = slug ? `?account=${encodeURIComponent(slug)}` : "";
      const response = await fetch(`/api/v1/client/appointments/${appointmentId}${query}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? "Не удалось отменить запись.");
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === appointmentId
            ? { ...item, status: "CANCELLED", statusLabel: "Отменено", statusTone: "neutral", canCancel: false }
            : item
        )
      );
      setPastItems((prev) =>
        prev.map((item) =>
          item.id === appointmentId
            ? { ...item, status: "CANCELLED", statusLabel: "Отменено", statusTone: "neutral", canCancel: false }
            : item
        )
      );
    } finally {
      setLoadingId(null);
    }
  };

  const renderCard = (item: AppointmentCard) => (
    <div
      key={item.id}
      className="flex flex-col gap-3 rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{item.dateLabel}</div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            statusToneClasses[item.statusTone] ?? statusToneClasses.neutral
          }`}
        >
          {item.statusLabel}
        </span>
      </div>
      <div className="text-sm text-[color:var(--bp-muted)]">{item.timeLabel}</div>
      <div className="text-sm font-medium">{item.servicesLabel || "Услуга"}</div>
      <div className="text-sm text-[color:var(--bp-muted)]">
        {item.specialistName ? `${item.specialistName} · ` : ""}
        {item.locationName}
      </div>
      {item.accountName ? (
        <div className="text-xs text-[color:var(--bp-muted)]">{item.accountName}</div>
      ) : null}
      {item.locationAddress ? (
        <div className="text-xs text-[color:var(--bp-muted)]">{item.locationAddress}</div>
      ) : null}
      <div className="flex flex-wrap gap-3 text-xs text-[color:var(--bp-muted)]">
        {item.durationLabel ? <span>{item.durationLabel}</span> : null}
        {item.priceLabel ? <span>{item.priceLabel}</span> : null}
      </div>
      {item.canCancel ? (
        <button
          type="button"
          disabled={loadingId === item.id}
          onClick={() => handleCancel(item.id, item.accountSlug)}
          className="mt-2 inline-flex w-fit items-center justify-center rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] px-4 py-2 text-xs font-semibold text-[color:var(--bp-ink)] transition hover:border-[color:var(--site-client-button)] hover:text-[color:var(--site-client-button)] disabled:opacity-60"
        >
          {loadingId === item.id ? "Отмена..." : "Отменить запись"}
        </button>
      ) : null}
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Мои записи</h2>
        {cancelHint ? (
          <div className="text-xs text-[color:var(--bp-muted)]">{cancelHint}</div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по услуге, мастеру или адресу"
          className="w-full rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--site-client-button)] md:w-[320px]"
        />
        {orgOptions.length > 1 ? (
          <select
            className="rounded-[var(--site-button-radius)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-sm"
            value={orgFilter}
            onChange={(event) => setOrgFilter(event.target.value)}
          >
            <option value="">Все организации</option>
            {orgOptions.map((org) => (
              <option key={org.slug} value={org.slug}>
                {org.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {!hasAppointments ? (
        <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-4 text-sm text-[color:var(--bp-muted)]">
          У вас пока нет записей.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filterItems.upcoming.map(renderCard)}
          {filterItems.upcoming.length === 0 ? (
            <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-4 text-sm text-[color:var(--bp-muted)]">
              Нет ближайших записей.
            </div>
          ) : null}
        </div>
      )}

      {filterItems.history.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="text-sm font-semibold text-[color:var(--bp-muted)]">Прошлые записи</div>
          <div className="grid gap-4 md:grid-cols-2">
            {filterItems.history.map(renderCard)}
          </div>
        </div>
      ) : null}
    </section>
  );
}
