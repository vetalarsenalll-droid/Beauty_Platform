import { requirePlatformPermission } from "@/lib/auth";

type SettingCard = {
  title: string;
  text: string;
  href: string;
};

const sections: SettingCard[] = [
  {
    title: "Шаблоны уведомлений",
    text: "Email, Telegram, MAX, SMS, push и локализации.",
    href: "/platform/settings",
  },
  {
    title: "SEO и пресеты",
    text: "Глобальные шаблоны мета-тегов и структуры страниц.",
    href: "/platform/settings",
  },
  {
    title: "Конструктор профилей",
    text: "Блоки, пресеты и правила модерации.",
    href: "/platform/settings",
  },
  {
    title: "Справочники",
    text: "Причины отмен, уровни специалистов, статусы.",
    href: "/platform/settings",
  },
];

export default async function PlatformSettingsPage() {
  await requirePlatformPermission("platform.settings");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Настройки платформы
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Глобальные настройки и шаблоны
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Управляйте системными шаблонами, SEO и пресетами.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <a
            key={section.title}
            href={section.href}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)] transition hover:-translate-y-0.5 hover:border-[color:var(--bp-accent)]"
          >
            <div className="text-lg font-semibold">{section.title}</div>
            <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
              {section.text}
            </p>
          </a>
        ))}
      </section>
    </div>
  );
}
