import Link from "next/link";
import { requirePlatformPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

type AuditRow = {
  id: number;
  adminId: number;
  action: string;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  diffJson: Record<string, unknown> | null;
  createdAt: Date;
  admin: { user: { email: string } | null } | null;
};

function parseId(value: string | null) {
  if (!value) return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
}

export default async function PlatformAuditPage() {
  await requirePlatformPermission("platform.audit");

  const rows = (await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      admin: {
        include: {
          user: true,
        },
      },
    },
  })) as AuditRow[];

  const accountIds = rows
    .filter((row) => row.targetType === "account")
    .map((row) => parseId(row.targetId))
    .filter((id): id is number => id !== null);

  const planIds = rows
    .filter((row) => row.targetType === "plan")
    .map((row) => parseId(row.targetId))
    .filter((id): id is number => id !== null);

  const featureIds = rows
    .filter((row) => row.targetType === "platform_plan_feature")
    .map((row) => parseId(row.targetId))
    .filter((id): id is number => id !== null);

  const limitIds = rows
    .filter((row) => row.targetType === "platform_limit")
    .map((row) => parseId(row.targetId))
    .filter((id): id is number => id !== null);

  const [accounts, plans, features, limits] = await Promise.all([
    accountIds.length
      ? prisma.account.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    planIds.length
      ? prisma.platformPlan.findMany({
          where: { id: { in: planIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    featureIds.length
      ? prisma.platformPlanFeature.findMany({
          where: { id: { in: featureIds } },
          include: { plan: true },
        })
      : Promise.resolve([]),
    limitIds.length
      ? prisma.platformLimit.findMany({
          where: { id: { in: limitIds } },
          include: { account: true },
        })
      : Promise.resolve([]),
  ]);

  const accountMap = new Map(accounts.map((item) => [item.id, item.name]));
  const planMap = new Map(plans.map((item) => [item.id, item.name]));
  const limitLabels: Record<string, string> = {
    "limit.locations": "Локации",
    "limit.services": "Услуги",
    "limit.specialists": "Специалисты",
    "limit.staff": "Сотрудники",
    "limit.clients": "Клиенты",
  };

  const featureMap = new Map(
    features.map((item) => [
      item.id,
      `Лимит тарифа: ${item.plan?.name ?? "Без тарифа"} · ${
        limitLabels[item.key] ?? item.key
      }`,
    ])
  );
  const limitMap = new Map(
    limits.map((item) => [
      item.id,
      `Лимит аккаунта: ${item.account?.name ?? "Без аккаунта"} · ${
        limitLabels[item.key] ?? item.key
      }`,
    ])
  );

  const targetLabel = (row: AuditRow) => {
    const parsedId = parseId(row.targetId);
    if (row.targetType === "account" && parsedId) {
      return accountMap.get(parsedId) ?? `Аккаунт #${parsedId}`;
    }
    if (row.targetType === "plan" && parsedId) {
      return planMap.get(parsedId) ?? `Тариф #${parsedId}`;
    }
    if (row.targetType === "platform_plan_feature" && parsedId) {
      return featureMap.get(parsedId) ?? `Лимит тарифа #${parsedId}`;
    }
    if (row.targetType === "platform_limit" && parsedId) {
      return limitMap.get(parsedId) ?? `Лимит аккаунта #${parsedId}`;
    }
    if (row.targetId) {
      return `${row.targetType} #${row.targetId}`;
    }
    return row.targetType;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Аудит
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          История изменений платформы
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Кто и что изменил, когда и в каком объекте.
        </p>
      </header>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
        <div className="grid grid-cols-[1.2fr_1.6fr_1.2fr_0.8fr_0.6fr] gap-3 border-b border-[color:var(--bp-stroke)] pb-3 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          <div>Администратор</div>
          <div>Действие</div>
          <div>Объект</div>
          <div>Время</div>
          <div>Детали</div>
        </div>
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-center text-[color:var(--bp-muted)]">
              Записей пока нет.
            </div>
          ) : (
            rows.map((row) => {
              const actor =
                row.admin?.user?.email ??
                row.adminId ??
                "Неизвестный администратор";
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[1.2fr_1.6fr_1.2fr_0.8fr_0.6fr] gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
                >
                  <div className="font-semibold">{actor}</div>
                  <div>{row.action}</div>
                  <div className="text-[color:var(--bp-muted)]">
                    {targetLabel(row)}
                  </div>
                  <div className="text-[color:var(--bp-muted)]">
                    {dateFormatter.format(row.createdAt)}
                  </div>
                  <div>
                    <Link
                      href={`/platform/audit/${row.id}`}
                      className="rounded-2xl border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                    >
                      Подробно
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
