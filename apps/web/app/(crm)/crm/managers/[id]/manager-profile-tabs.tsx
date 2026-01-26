"use client";

import { useState } from "react";
import ManagerProfileForm from "./manager-profile-form";
import ManagerBindingsForm from "./manager-bindings-form";

type ManagerSummary = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

type LocationOption = {
  id: number;
  label: string;
  meta?: string | null;
};

type ManagerProfileTabsProps = {
  manager: ManagerSummary;
  locations: LocationOption[];
  selectedLocationIds: number[];
};

const tabs = [
  { id: "general", label: "Общее" },
  { id: "bindings", label: "Привязки" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function ManagerProfileTabs({
  manager,
  locations,
  selectedLocationIds,
}: ManagerProfileTabsProps) {
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
          <h2 className="text-lg font-semibold">Профиль менеджера</h2>
          <div className="mt-4">
            <ManagerProfileForm manager={manager} />
          </div>
        </section>
      ) : null}

      {activeTab === "bindings" ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Привязки</h2>
          <div className="mt-4">
            <ManagerBindingsForm
              managerId={manager.id}
              locations={locations}
              selectedLocationIds={selectedLocationIds}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}