"use client";

import { useState } from "react";
import ServiceProfileForm from "./service-profile-form";
import ServiceMediaForm from "./service-media-form";
import ServiceLevelsForm from "./service-variants-form";
import ServiceBindingsForm from "./service-bindings-form";

type ServiceSummary = {
  id: number;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: string;
  isActive: boolean;
  categoryId: number | null;
};

type CategoryOption = {
  id: number;
  name: string;
};

type LevelConfigItem = {
  levelId: number;
  levelName: string;
  durationMin: number | null;
  price: string | null;
};

type LevelOption = {
  id: number;
  name: string;
  rank: number;
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

type ServiceProfileTabsProps = {
  service: ServiceSummary;
  categories: CategoryOption[];
  levelConfigs: LevelConfigItem[];
  levelOptions: LevelOption[];
  locations: OptionItem[];
  specialists: OptionItem[];
  servicePhotoItems: MediaItem[];
  workPhotoItems: MediaItem[];
  selectedLocationIds: number[];
  selectedSpecialistIds: number[];
};

const tabs = [
  { id: "general", label: "Общее" },
  { id: "photos", label: "Фото" },
  { id: "levels", label: "Уровни специалистов" },
  { id: "bindings", label: "Привязки" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function ServiceProfileTabs({
  service,
  categories,
  levelConfigs,
  levelOptions,
  locations,
  specialists,
  servicePhotoItems,
  workPhotoItems,
  selectedLocationIds,
  selectedSpecialistIds,
}: ServiceProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("general");

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
          <h2 className="text-lg font-semibold">Общие настройки</h2>
          <div className="mt-4">
            <ServiceProfileForm service={service} categories={categories} />
          </div>
        </section>
      ) : null}

      {activeTab === "photos" ? (
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <ServiceMediaForm
              serviceId={service.id}
              title="Фото услуги"
              type="service"
              items={servicePhotoItems}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <ServiceMediaForm
              serviceId={service.id}
              title="Фото работ"
              type="work"
              items={workPhotoItems}
            />
          </section>
        </div>
      ) : null}

      {activeTab === "levels" ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Уровни специалистов</h2>
          <div className="mt-4">
            <ServiceLevelsForm
              serviceId={service.id}
              levelConfigs={levelConfigs}
              levelOptions={levelOptions}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "bindings" ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Привязки</h2>
          <div className="mt-4">
            <ServiceBindingsForm
              serviceId={service.id}
              locations={locations}
              specialists={specialists}
              selectedLocationIds={selectedLocationIds}
              selectedSpecialistIds={selectedSpecialistIds}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
