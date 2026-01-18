import { requirePlatformPermission } from "@/lib/auth";

type AuditRow = {
  actor: string;
  action: string;
  target: string;
  time: string;
};

const rows: AuditRow[] = [
  {
    actor: "admin@beauty.local",
    action: "Изменил настройки платформы",
    target: "SEO presets",
    time: "сегодня, 10:12",
  },
  {
    actor: "moderator@beauty.local",
    action: "Одобрил отзыв",
    target: "Beauty Studio One",
    time: "сегодня, 09:50",
  },
  {
    actor: "admin@beauty.local",
    action: "Обновил тариф",
    target: "Pro",
    time: "вчера, 18:21",
  },
];

export default async function PlatformAuditPage() {
  await requirePlatformPermission("platform.audit");

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
          {rows.map((row, index) => (
            <div
              key={`${row.actor}-${index}`}
              className="grid grid-cols-[1.2fr_1.6fr_1fr_0.8fr] gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
            >
              <div className="font-semibold">{row.actor}</div>
              <div>{row.action}</div>
              <div className="text-[color:var(--bp-muted)]">{row.target}</div>
              <div className="text-[color:var(--bp-muted)]">{row.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
