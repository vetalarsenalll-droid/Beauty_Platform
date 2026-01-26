"use client";

import Link from "next/link";

type LocationItem = {
  id: number;
  name: string;
};

type LocationRowActionsProps = {
  location: LocationItem;
};

export default function LocationRowActions({
  location,
}: LocationRowActionsProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-base font-semibold text-[color:var(--bp-ink)]">
          {location.name}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/crm/locations/${location.id}`}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Профиль
          </Link>
        </div>
      </div>
    </div>
  );
}
