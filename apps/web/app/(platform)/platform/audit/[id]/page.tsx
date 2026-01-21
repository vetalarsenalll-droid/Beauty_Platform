import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "full",
  timeStyle: "long",
});

const limitLabels: Record<string, string> = {
  "limit.locations": "Локации",
  "limit.services": "Услуги",
  "limit.specialists": "Специалисты",
  "limit.staff": "Сотрудники",
  "limit.clients": "Клиенты",
};

const fieldLabels: Record<string, string> = {
  name: "Название",
  slug: "Публичная ссылка",
  timeZone: "Часовой пояс",
  status: "Статус",
  planId: "Тариф",
  key: "Лимит",
  value: "Значение",
  valueInt: "Значение",
  valueJson: "Значение",
  code: "Код",
  currency: "Валюта",
  isActive: "Активен",
  priceMonthly: "Цена в месяц",
  description: "Описание",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Активен",
  SUSPENDED: "Приостановлен",
  ARCHIVED: "Архив",
};

const currencyLabels: Record<string, string> = {
  RUB: "₽ (RUB)",
  USD: "$ (USD)",
  EUR: "€ (EUR)",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

function parseId(value: string | null) {
  if (!value) return null;
  const num = Number(value);
  return Number.isInteger(num) ? num : null;
}

export default async function AuditDetailPage({ params }: PageProps) {
  await requirePlatformPermission("platform.audit");
  const { id } = await params;
  const auditId = Number(id);
  if (!Number.isInteger(auditId)) notFound();

  const row = await prisma.platformAuditLog.findUnique({
    where: { id: auditId },
    include: { admin: { include: { user: true } } },
  });

  if (!row) notFound();

  let targetTitle = row.targetType;
  const parsedTargetId = parseId(row.targetId);

  if (row.targetType === "account" && parsedTargetId) {
    const account = await prisma.account.findUnique({
      where: { id: parsedTargetId },
      select: { name: true },
    });
    targetTitle = account
      ? `Аккаунт: ${account.name}`
      : `Аккаунт #${parsedTargetId}`;
  } else if (row.targetType === "plan" && parsedTargetId) {
    const plan = await prisma.platformPlan.findUnique({
      where: { id: parsedTargetId },
      select: { name: true },
    });
    targetTitle = plan ? `Тариф: ${plan.name}` : `Тариф #${parsedTargetId}`;
  } else if (row.targetType === "platform_plan_feature" && parsedTargetId) {
    const feature = await prisma.platformPlanFeature.findUnique({
      where: { id: parsedTargetId },
      include: { plan: true },
    });
    if (feature) {
      const label = limitLabels[feature.key] ?? feature.key;
      targetTitle = `Лимит тарифа: ${feature.plan?.name ?? "Без тарифа"} · ${label}`;
    } else {
      targetTitle = `Лимит тарифа #${parsedTargetId}`;
    }
  } else if (row.targetType === "platform_limit" && parsedTargetId) {
    const limit = await prisma.platformLimit.findUnique({
      where: { id: parsedTargetId },
      include: { account: true },
    });
    if (limit) {
      const label = limitLabels[limit.key] ?? limit.key;
      targetTitle = `Лимит аккаунта: ${limit.account?.name ?? "Без аккаунта"} · ${label}`;
    } else {
      targetTitle = `Лимит аккаунта #${parsedTargetId}`;
    }
  } else if (row.targetId) {
    targetTitle = `${row.targetType} #${row.targetId}`;
  }

  const actor =
    row.admin?.user?.email ?? row.adminId ?? "Неизвестный администратор";

  const diffEntries =
    row.diffJson && typeof row.diffJson === "object"
      ? Object.entries(row.diffJson as Record<string, unknown>)
      : [];

  const planIds = diffEntries
    .filter(([key, value]) => key === "planId" && Number(value))
    .map(([, value]) => Number(value));

  const planNames = planIds.length
    ? await prisma.platformPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true },
      })
    : [];

  const planMap = new Map(planNames.map((item) => [item.id, item.name]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Подробный аудит
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {row.action}
          </h1>
          <p className="text-[color:var(--bp-muted)]">{targetTitle}</p>
        </div>
        <Link
          href="/platform/audit"
          className="rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-1 text-xs"
        >
          Назад к списку
        </Link>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Контекст изменений</h2>
        <div className="mt-4 grid gap-2 text-sm">
          <div>
            <span className="text-[color:var(--bp-muted)]">Кто:</span> {actor}
          </div>
          <div>
            <span className="text-[color:var(--bp-muted)]">Когда:</span>{" "}
            {dateFormatter.format(row.createdAt)}
          </div>
          <div>
            <span className="text-[color:var(--bp-muted)]">IP:</span>{" "}
            {row.ipAddress ?? "—"}
          </div>
          <div>
            <span className="text-[color:var(--bp-muted)]">Объект:</span>{" "}
            {targetTitle}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Что изменилось</h2>
        {diffEntries.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Данных об изменениях нет.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {diffEntries.map(([key, value]) => (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2"
              >
                <div className="font-medium">
                  {limitLabels[key] ?? fieldLabels[key] ?? key}
                </div>
                <div className="text-[color:var(--bp-muted)]">
                  {key === "planId"
                    ? planMap.get(Number(value)) ?? (value ?? "Без тарифа")
                    : key === "key" && typeof value === "string"
                      ? limitLabels[value] ?? value
                      : key === "status" && typeof value === "string"
                        ? statusLabels[value] ?? value
                        : key === "currency" && typeof value === "string"
                          ? currencyLabels[value] ?? value
                          : key === "isActive"
                            ? value
                              ? "Да"
                              : "Нет"
                            : value === null
                              ? "Нет"
                              : typeof value === "string"
                                ? value
                                : JSON.stringify(value)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
