import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import TemplateCreateForm from "./template-create-form";
import TemplateRow from "./template-row";
import PlatformSettingsPanels from "./platform-settings-panels";

export default async function PlatformSettingsPage() {
  await requirePlatformPermission("platform.settings");

  const [settings, templates] = await Promise.all([
    prisma.platformSetting.findMany({ orderBy: { key: "asc" } }),
    prisma.templateLibrary.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const settingsMap = settings.reduce<Record<string, unknown>>(
    (acc, item) => {
      acc[item.key] = item.valueJson;
      return acc;
    },
    {}
  );

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

      <PlatformSettingsPanels settings={settingsMap} />

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Новый шаблон</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Создайте уведомление, SEO пресет или пресет конструктора.
        </p>
        <div className="mt-4">
          <TemplateCreateForm />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Библиотека шаблонов</h2>
        {templates.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Шаблоны пока не созданы.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                id={template.id}
                name={template.name}
                type={template.type}
                description={template.description}
                contentJson={template.contentJson}
                isActive={template.isActive}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
