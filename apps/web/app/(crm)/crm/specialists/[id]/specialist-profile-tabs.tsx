"use client";

import { useState } from "react";
import SpecialistProfileForm from "./specialist-profile-form";
import SpecialistBindingsForm from "./specialist-bindings-form";
import SpecialistMediaForm from "./specialist-media-form";

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

type OptionItem = {
  id: number;
  label: string;
  meta?: string | null;
};

type MediaItem = {
  id: number;
  url: string;
  sortOrder: number;
  isCover: boolean;
};

type SpecialistProfileTabsProps = {
  specialist: SpecialistSummary;
  levels: LevelOption[];
  services: OptionItem[];
  locations: OptionItem[];
  specialistPhotoItems: MediaItem[];
  workPhotoItems: MediaItem[];
  selectedServiceIds: number[];
  selectedLocationIds: number[];
};

const tabs = [
  { id: "general", label: "Общее" },
  { id: "photos", label: "Фото" },
  { id: "bindings", label: "Привязки" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function SpecialistProfileTabs({
  specialist,
  levels,
  services,
  locations,
  specialistPhotoItems,
  workPhotoItems,
  selectedServiceIds,
  selectedLocationIds,
}: SpecialistProfileTabsProps) {
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
          <h2 className="text-lg font-semibold">Профиль специалиста</h2>
          <div className="mt-4">
            <SpecialistProfileForm specialist={specialist} levels={levels} />
          </div>
        </section>
      ) : null}

      {activeTab === "photos" ? (
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <SpecialistMediaForm
              specialistId={specialist.id}
              title="Фото специалиста"
              type="specialist"
              items={specialistPhotoItems}
            />
          </section>
          <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <SpecialistMediaForm
              specialistId={specialist.id}
              title="Фото работ"
              type="work"
              items={workPhotoItems}
            />
          </section>
        </div>
      ) : null}

      {activeTab === "bindings" ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Привязки</h2>
          <div className="mt-4">
            <SpecialistBindingsForm
              specialistId={specialist.id}
              services={services}
              locations={locations}
              selectedServiceIds={selectedServiceIds}
              selectedLocationIds={selectedLocationIds}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
