"use client";

import { useEffect, useRef, useState } from "react";

type OnlineBookingFiltersProps = {
  q: string;
  period: string;
  status: string;
  pageSize: number;
};

export function OnlineBookingFilters({ q, period, status, pageSize }: OnlineBookingFiltersProps) {
  const [query, setQuery] = useState(q);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [selectedPageSize, setSelectedPageSize] = useState(String(pageSize));
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  useEffect(() => {
    setSelectedPeriod(period);
  }, [period]);

  useEffect(() => {
    setSelectedStatus(status);
  }, [status]);

  useEffect(() => {
    setSelectedPageSize(String(pageSize));
  }, [pageSize]);

  return (
    <form ref={formRef} action="/crm/analytics/online-booking" className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
        Поиск
        <div className="flex items-center gap-2">
          <input
            name="q"
            placeholder="Телефон, имя, фамилия, услуга, локация, специалист или дата"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                formRef.current?.requestSubmit();
              }
            }}
            className="h-9 w-72 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm text-[color:var(--bp-ink)] shadow-sm"
          />
          <button
            type="submit"
            className="h-9 rounded-xl bg-[color:var(--bp-accent)] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105"
          >
            Найти
          </button>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
        Период
        <select
          name="period"
          value={selectedPeriod}
          onChange={(event) => {
            setSelectedPeriod(event.target.value);
            formRef.current?.requestSubmit();
          }}
          className="h-9 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm text-[color:var(--bp-ink)] shadow-sm"
        >
          <option value="week">Неделя</option>
          <option value="month">Месяц</option>
          <option value="year">Год</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
        Записи
        <select
          name="status"
          value={selectedStatus}
          onChange={(event) => {
            setSelectedStatus(event.target.value);
            formRef.current?.requestSubmit();
          }}
          className="h-9 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm text-[color:var(--bp-ink)] shadow-sm"
        >
          <option value="all">Все</option>
          <option value="completed">Завершенные</option>
          <option value="incomplete">Незавершенные</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-[color:var(--bp-muted)]">
        Сообщений на странице
        <select
          name="pageSize"
          value={selectedPageSize}
          onChange={(event) => {
            setSelectedPageSize(event.target.value);
            formRef.current?.requestSubmit();
          }}
          className="h-9 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm text-[color:var(--bp-ink)] shadow-sm"
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </label>
    </form>
  );
}
