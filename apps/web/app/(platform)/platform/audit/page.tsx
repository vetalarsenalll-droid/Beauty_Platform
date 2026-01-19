import { requirePlatformPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function PlatformAuditPage() {
  await requirePlatformPermission("platform.audit");

  const rows = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      admin: {
        include: {
          user: true,
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Аудит
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Журнал действий администраторов
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Все критичные операции с диффами и временем выполнения.
        </p>
      </header>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
        <div className="grid grid-cols-[1.2fr_1.6fr_1fr_0.8fr] gap-3 border-b border-[color:var(--bp-stroke)] pb-3 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          <div>Актор</div>
          <div>Действие</div>
          <div>Цель</div>
          <div>Время</div>
        </div>
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-center text-[color:var(--bp-muted)]">
              Пока нет записей аудита. Действия будут появляться здесь.
            </div>
          ) : (
            rows.map((row) => {
              const actor =
                row.admin?.user?.email ??
                row.adminId ??
                "Неизвестный администратор";
              const target = row.targetId
                ? `${row.targetType} · ${row.targetId}`
                : row.targetType;
              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[1.2fr_1.6fr_1fr_0.8fr] gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
                >
                  <div className="font-semibold">{actor}</div>
                  <div>{row.action}</div>
                  <div className="text-[color:var(--bp-muted)]">{target}</div>
                  <div className="text-[color:var(--bp-muted)]">
                    {dateFormatter.format(row.createdAt)}
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
