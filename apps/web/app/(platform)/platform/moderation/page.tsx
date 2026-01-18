import { requirePlatformPermission } from "@/lib/auth";

type ModerationItem = {
  title: string;
  type: string;
  status: string;
  submittedBy: string;
};

const queue: ModerationItem[] = [
  {
    title: "Beauty Studio One",
    type: "Профиль",
    status: "На проверке",
    submittedBy: "admin@beauty.local",
  },
  {
    title: "Отзыв клиента",
    type: "Отзыв",
    status: "Новый",
    submittedBy: "client@domain.ru",
  },
  {
    title: "Галерея работ",
    type: "Медиа",
    status: "Новый",
    submittedBy: "studio@domain.ru",
  },
];

export default async function PlatformModerationPage() {
  await requirePlatformPermission("platform.moderation");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Модерация
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Контент и публичные профили
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Очередь проверок отзывов, медиа и публичных страниц.
        </p>
      </header>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
        <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Очередь модерации
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {queue.map((item) => (
            <div
              key={`${item.title}-${item.type}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  {item.type} · {item.submittedBy}
                </div>
              </div>
              <div className="text-xs font-semibold text-[color:var(--bp-ink)]">
                {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
