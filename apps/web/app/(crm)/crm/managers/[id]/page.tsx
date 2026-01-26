import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ManagerProfileTabs from "./manager-profile-tabs";
import ManagerProfileActions from "./manager-profile-actions";

export default async function ManagerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCrmPermission("crm.specialists.read");
  const { id } = await params;
  const managerId = Number(id);

  if (!Number.isInteger(managerId)) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
        <p className="text-sm text-[color:var(--bp-muted)]">
          Некорректный идентификатор менеджера.
        </p>
      </div>
    );
  }

  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      accountId: session.accountId,
      userId: managerId,
      role: { name: "MANAGER" },
    },
    include: { user: { include: { profile: true } }, role: true },
  });

  if (!assignment) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
        <p className="text-sm text-[color:var(--bp-muted)]">
          Менеджер не найден.
        </p>
        <div className="mt-4">
          <Link
            href="/crm/managers"
            className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold"
          >
            Назад к менеджерам
          </Link>
        </div>
      </div>
    );
  }

  const [locations, managerLocations] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: session.accountId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.locationManager.findMany({
      where: { accountId: session.accountId, userId: assignment.user.id },
      select: { locationId: true },
    }),
  ]);

  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: location.name,
    meta: location.address ?? null,
  }));

  const profile = assignment.user.profile;
  const fullName = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/crm/managers"
            className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Менеджеры
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Профиль менеджера
          </span>
          <ManagerProfileActions managerId={assignment.user.id} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {fullName || assignment.user.email || "Без имени"}
            </h1>
            <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs font-semibold text-[color:var(--bp-muted)]">
              {assignment.user.status === "ACTIVE"
                ? "Активен"
                : assignment.user.status === "INVITED"
                  ? "Приглашен"
                  : "В архиве"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--bp-muted)]">
            {assignment.user.email ? <span>{assignment.user.email}</span> : null}
            {assignment.user.phone ? <span>{assignment.user.phone}</span> : null}
          </div>
        </div>
      </header>

      <ManagerProfileTabs
        manager={{
          id: assignment.user.id,
          firstName: profile?.firstName ?? null,
          lastName: profile?.lastName ?? null,
          email: assignment.user.email,
          phone: assignment.user.phone,
          status: assignment.user.status,
        }}
        locations={locationOptions}
        selectedLocationIds={managerLocations.map((item) => item.locationId)}
      />
    </div>
  );
}