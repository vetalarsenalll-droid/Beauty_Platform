"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import LocationProfileForm from "./location-profile-form";
import LocationHoursForm from "./location-hours-form";
import LocationMediaForm from "./location-media-form";
import LocationBindingsForm from "./location-bindings-form";

type LocationSummary = {
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

type Hour = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ExceptionItem = {
  id: number;
  date: string;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
};

type MediaItem = {
  id: number;
  url: string;
  sortOrder: number;
  isCover: boolean;
};

type OptionItem = {
  id: number;
  label: string;
  meta?: string | null;
};

type LocationProfileTabsProps = {
  location: LocationSummary;
  hours: Hour[];
  exceptions: ExceptionItem[];
  services: OptionItem[];
  specialists: OptionItem[];
  managers: OptionItem[];
  locationPhotoItems: MediaItem[];
  workPhotoItems: MediaItem[];
  selectedServiceIds: number[];
  selectedSpecialistIds: number[];
  selectedManagerIds: number[];
};

const tabs = [
  { id: "general", label: "Общее" },
  { id: "photos", label: "Фото" },
  { id: "hours", label: "Режим работы" },
  { id: "bindings", label: "Привязки" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function LocationProfileTabs({
  location,
  hours,
  exceptions,
  services,
  specialists,
  managers,
  locationPhotoItems,
  workPhotoItems,
  selectedServiceIds,
  selectedSpecialistIds,
  selectedManagerIds,
}: LocationProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const exceptionRows = useMemo(() => {
    if (exceptions.length === 0) {
      return (
        <div className="text-sm text-[color:var(--bp-muted)]">
          Исключений нет.
        </div>
      );
    }
    return (
      <div className="grid gap-2 text-sm text-[color:var(--bp-muted)]">
        {exceptions.map((exception) => (
          <div key={exception.id}>
            {exception.date}{" "}
            {exception.isClosed
              ? "— выходной"
              : `${exception.startTime ?? "--:--"}–${exception.endTime ?? "--:--"}`}
          </div>
        ))}
      </div>
    );
  }, [exceptions]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-[color:var(--bp-ink)] bg-[color:var(--bp-surface)] text-[color:var(--bp-ink)]"
                : "border-[color:var(--bp-stroke)] text-[color:var(--bp-muted)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Основные данные</h2>
          <div className="mt-4">
            <LocationProfileForm location={location} />
          </div>
        </section>
      ) : null}

      {activeTab === "photos" ? (
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <LocationMediaForm
              locationId={location.id}
              title="Фото локации"
              type="location"
              items={locationPhotoItems}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <LocationMediaForm
              locationId={location.id}
              title="Фото работ"
              type="work"
              items={workPhotoItems}
            />
          </section>
        </div>
      ) : null}

      {activeTab === "hours" ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Режим работы</h2>
            <Link
              href="/crm/schedule"
              className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
            >
              Расписание
            </Link>
          </div>
          <div className="mt-4">
            <LocationHoursForm locationId={location.id} hours={hours} />
          </div>
          <div className="mt-6">
            <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
              Исключения
            </div>
            <div className="mt-2">{exceptionRows}</div>
          </div>
        </section>
      ) : null}

      {activeTab === "bindings" ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Привязки</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                href="/crm/services"
                className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 font-semibold"
              >
                Услуги
              </Link>
              <Link
                href="/crm/specialists"
                className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 font-semibold"
              >
                Специалисты
              </Link>
              <Link
                href="/crm/managers"
                className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 font-semibold"
              >
                Менеджеры
              </Link>
            </div>
          </div>
          <div className="mt-4">
            <LocationBindingsForm
              locationId={location.id}
              services={services}
              specialists={specialists}
              managers={managers}
              selectedServiceIds={selectedServiceIds}
              selectedSpecialistIds={selectedSpecialistIds}
              selectedManagerIds={selectedManagerIds}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
