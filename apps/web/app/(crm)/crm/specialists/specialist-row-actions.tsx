"use client";

import Link from "next/link";

type SpecialistItem = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  levelName: string | null;
};

type SpecialistRowActionsProps = {
  specialist: SpecialistItem;
};

export default function SpecialistRowActions({
  specialist,
}: SpecialistRowActionsProps) {
  const fullName = [specialist.firstName, specialist.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-base font-semibold text-[color:var(--bp-ink)]">
            {fullName || specialist.email || "Без имени"}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--bp-muted)]">
            {specialist.levelName ? <span>{specialist.levelName}</span> : null}
            {specialist.phone ? <span>{specialist.phone}</span> : null}
            <span>
              {specialist.status === "ACTIVE"
                ? "Активен"
                : specialist.status === "INVITED"
                  ? "Приглашен"
                  : "В архиве"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/crm/specialists/${specialist.id}`}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Профиль
          </Link>
        </div>
      </div>
    </div>
  );
}