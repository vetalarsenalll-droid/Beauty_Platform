import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { getAiAccountAccessByAccountIds, readText } from "@/lib/ai-billing";
import { getAccountAiSetting, upsertAccountAiSetting } from "@/lib/ai-settings";
import { prisma } from "@/lib/prisma";

function readIdList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function parseIdSet(value: unknown) {
  return Array.isArray(value)
    ? new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))
    : null;
}

async function saveSiteAssistantAction(formData: FormData) {
  "use server";
  const session = await requireCrmPermission("crm.assistant.site.manage");
  const accountId = session.accountId;
  await upsertAccountAiSetting(accountId, "aisha.assistantName", readText(formData.get("assistantName"), 80) || "Ассистент");
  await upsertAccountAiSetting(accountId, "aisha.systemPrompt", readText(formData.get("prompt"), 4000));
  await upsertAccountAiSetting(accountId, "aisha.enabledLocationIds", readIdList(formData, "locationId"));
  await upsertAccountAiSetting(accountId, "aisha.enabledServiceIds", readIdList(formData, "serviceId"));
  await upsertAccountAiSetting(accountId, "aisha.enabledSpecialistIds", readIdList(formData, "specialistId"));
  revalidatePath("/crm/assistant/site");
}

export default async function CrmAssistantSitePage() {
  const session = await requireCrmPermission("crm.assistant.site.read");
  const accountId = session.accountId;

  const [
    access,
    account,
    locations,
    services,
    specialists,
    promptSetting,
    assistantNameSetting,
    enabledLocationIdsSetting,
    enabledServiceIdsSetting,
    enabledSpecialistIdsSetting,
    errors,
  ] = await Promise.all([
    getAiAccountAccessByAccountIds([accountId]).then((map) => map.get(accountId)),
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true, slug: true } }),
    prisma.location.findMany({ where: { accountId, status: "ACTIVE" }, orderBy: { name: "asc" }, take: 80, select: { id: true, name: true } }),
    prisma.service.findMany({ where: { accountId, isActive: true }, orderBy: { name: "asc" }, take: 120, select: { id: true, name: true } }),
    prisma.specialistProfile.findMany({
      where: { accountId, isPublic: true },
      orderBy: { id: "asc" },
      take: 120,
      select: { id: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
    }),
    getAccountAiSetting(accountId, "aisha.systemPrompt"),
    getAccountAiSetting(accountId, "aisha.assistantName"),
    getAccountAiSetting(accountId, "aisha.enabledLocationIds"),
    getAccountAiSetting(accountId, "aisha.enabledServiceIds"),
    getAccountAiSetting(accountId, "aisha.enabledSpecialistIds"),
    prisma.$queryRaw<Array<{ id: number; level: string; message: string; data: unknown; createdAt: Date }>>`
      SELECT l."id", l."level", l."message", l."data", l."createdAt"
      FROM "AiLog" l
      LEFT JOIN "AiAction" a ON a."id" = l."actionId"
      LEFT JOIN "AiThread" t ON t."id" = a."threadId"
      WHERE l."level" IN ('ERROR', 'WARN', 'error', 'warn')
        AND (
          t."accountId" = ${accountId}
          OR l."data"->>'accountId' = ${String(accountId)}
        )
      ORDER BY l."createdAt" DESC
      LIMIT 20
    `,
  ]);

  const enabledLocationIds = parseIdSet(enabledLocationIdsSetting);
  const enabledServiceIds = parseIdSet(enabledServiceIdsSetting);
  const enabledSpecialistIds = parseIdSet(enabledSpecialistIdsSetting);
  const assistantName = typeof assistantNameSetting === "string" && assistantNameSetting.trim() ? assistantNameSetting : "Ассистент";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Ассистент</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Aisha на сайте</h1>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            {account?.name ?? "Аккаунт"} · ассистент сайта {access?.siteAssistantEnabled ? "включён" : "выключен"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {account?.slug ? (
            <Link href={`/${account.slug}/assistant`} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
              Тестовый чат
            </Link>
          ) : null}
          <Link href="/crm/assistant/settings" className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
            Лимиты
          </Link>
        </div>
      </header>

      <form action={saveSiteAssistantAction} className="grid gap-6">
        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <h2 className="text-lg font-semibold">Ассистент</h2>
            <label className="mt-4 grid gap-2 text-sm">
              <span className="font-medium">Имя</span>
              <input name="assistantName" defaultValue={assistantName} className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            </label>
            <div className="mt-4 grid gap-2 text-sm text-[color:var(--bp-muted)]">
              <div>Аккаунт: {account?.slug ?? accountId}</div>
              <div>AI: {access?.aiEnabled ? "включён" : "выключен"}</div>
              <div>Site assistant: {access?.siteAssistantEnabled ? "включён" : "выключен"}</div>
            </div>
          </article>

          <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)] xl:col-span-2">
            <h2 className="text-lg font-semibold">Prompt</h2>
            <textarea
              name="prompt"
              defaultValue={typeof promptSetting === "string" ? promptSetting : ""}
              className="mt-4 min-h-48 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 text-sm outline-none"
            />
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Dictionary title="Локации" name="locationId" items={locations.map((item) => ({ id: item.id, label: `#${item.id} ${item.name}` }))} enabledIds={enabledLocationIds} />
          <Dictionary title="Услуги" name="serviceId" items={services.map((item) => ({ id: item.id, label: `#${item.id} ${item.name}` }))} enabledIds={enabledServiceIds} />
          <Dictionary
            title="Специалисты"
            name="specialistId"
            items={specialists.map((item) => ({
              id: item.id,
              label: `#${item.id} ${[item.user.profile?.firstName, item.user.profile?.lastName].filter(Boolean).join(" ") || item.user.email || item.id}`,
            }))}
            enabledIds={enabledSpecialistIds}
          />
        </section>

        <button className="w-fit rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Сохранить настройки сайта</button>
      </form>

      {account?.slug ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Тестовый чат</h2>
            <Link href={`/${account.slug}/assistant`} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
              Открыть отдельно
            </Link>
          </div>
          <div className="mt-4 h-[680px] overflow-hidden rounded-xl border border-[color:var(--bp-stroke)] bg-white">
            <iframe
              src={`/${account.slug}/assistant`}
              title="Тестовый чат Aisha"
              className="h-full w-full"
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Последние ошибки</h2>
        <div className="mt-4 grid gap-3 text-sm">
          {errors.map((log) => (
            <div key={log.id} className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
              <div className="font-medium">{log.level}</div>
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{log.createdAt.toLocaleString("ru-RU")}</div>
              <div className="mt-2 break-words text-xs text-[color:var(--bp-muted)]">{log.message}</div>
            </div>
          ))}
          {!errors.length ? <div className="text-[color:var(--bp-muted)]">Ошибок пока нет.</div> : null}
        </div>
      </section>
    </div>
  );
}

function Dictionary({
  title,
  name,
  items,
  enabledIds,
}: {
  title: string;
  name: string;
  items: Array<{ id: number; label: string }>;
  enabledIds: Set<number> | null;
}) {
  return (
    <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 grid max-h-72 gap-2 overflow-auto pr-1 text-sm">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--bp-stroke)] px-3 py-2">
            <input name={name} type="checkbox" value={item.id} defaultChecked={!enabledIds || enabledIds.has(item.id)} />
            <span>{item.label}</span>
          </label>
        ))}
        {!items.length ? <span className="text-sm text-[color:var(--bp-muted)]">Нет активных записей.</span> : null}
      </div>
    </article>
  );
}
