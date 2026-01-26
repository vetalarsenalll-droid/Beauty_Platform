"use client";

import Link from "next/link";

type ManagerItem = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

type ManagerRowActionsProps = {
  manager: ManagerItem;
};

export default function ManagerRowActions({ manager }: ManagerRowActionsProps) {
  const fullName = [manager.firstName, manager.lastName].filter(Boolean).join(" ");

  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="text-base font-semibold text-[color:var(--bp-ink)]">
            {fullName || manager.email || "Без имени"}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--bp-muted)]">
            {manager.phone ? <span>{manager.phone}</span> : null}
            <span>
              {manager.status === "ACTIVE"
                ? "Активен"
                : manager.status === "INVITED"
                  ? "Приглашен"
                  : "В архиве"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/crm/managers/${manager.id}`}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Профиль
          </Link>
        </div>
      </div>
    </div>
  );
}