"use client";

import Link from "next/link";

type ClientItem = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

type ClientRowActionsProps = {
  client: ClientItem;
};

function formatName(client: ClientItem) {
  const fullName = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  if (fullName) return fullName;
  return client.phone || client.email || "Без имени";
}

export default function ClientRowActions({ client }: ClientRowActionsProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-[color:var(--bp-ink)]">
            {formatName(client)}
          </div>
          <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
            {client.phone || "Телефон не указан"}
            {client.email ? ` · ${client.email}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/crm/clients/${client.id}`}
            className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Профиль
          </Link>
        </div>
      </div>
    </div>
  );
}
