"use client";

import Link from "next/link";

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: string;
  isActive: boolean;
  categoryName: string | null;
  bookingType: "SINGLE" | "GROUP";
  groupCapacityDefault: number | null;
};

type ServiceRowActionsProps = {
  service: ServiceItem;
};

export default function ServiceRowActions({ service }: ServiceRowActionsProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-base font-semibold text-[color:var(--bp-ink)]">
            {service.name}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--bp-muted)]">
            <span>{service.baseDurationMin} мин</span>
            <span>{service.basePrice} ₽</span>
            <span>{service.isActive ? "Активна" : "В архиве"}</span>
            <span>{service.bookingType === "GROUP" ? "Группа" : "Одиночная"}</span>
            {service.bookingType === "GROUP" && service.groupCapacityDefault ? (
              <span>{service.groupCapacityDefault} мест</span>
            ) : null}
            {service.categoryName ? <span>{service.categoryName}</span> : null}
          </div>
          {service.description ? (
            <div className="text-xs text-[color:var(--bp-muted)]">
              {service.description}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/crm/services/${service.id}`}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Профиль
          </Link>
        </div>
      </div>
    </div>
  );
}
