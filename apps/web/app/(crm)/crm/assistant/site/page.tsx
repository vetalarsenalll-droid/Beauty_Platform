import { revalidatePath } from "next/cache";
import PublicAiChatWidget from "@/components/public-ai-chat-widget";
import { requireCrmPermission } from "@/lib/auth";
import {
  getAiAccessPackages,
  getAiAccountAccessByAccountIds,
  getAiAccountBalance,
  int,
  money,
  readCheckbox,
  readOptionalNumber,
  readText,
  requestAiPackageInvoice,
  updateAiAccountAccess,
  type AiAccessPurchaseWithInvoiceRow,
} from "@/lib/ai-billing";
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

async function saveAssistantAction(formData: FormData) {
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

async function saveAccessAction(formData: FormData) {
  "use server";
  const session = await requireCrmPermission("crm.assistant.manage");
  const access = (await getAiAccountAccessByAccountIds([session.accountId])).get(session.accountId);
  await updateAiAccountAccess({
    accountId: session.accountId,
    aiEnabled: readCheckbox(formData.get("aiEnabled")),
    siteAssistantEnabled: readCheckbox(formData.get("siteAssistantEnabled")),
    crmAgentEnabled: access?.crmAgentEnabled ?? false,
    dailySpendLimitRub: readOptionalNumber(formData.get("dailySpendLimitRub")),
    monthlySpendLimitRub: readOptionalNumber(formData.get("monthlySpendLimitRub")),
    minBalanceNotifyRub: readOptionalNumber(formData.get("minBalanceNotifyRub")),
    stopWhenBalanceBelowRub: readOptionalNumber(formData.get("stopWhenBalanceBelowRub")),
  });
  revalidatePath("/crm/assistant/site");
}

async function requestPackageAction(formData: FormData) {
  "use server";
  const session = await requireCrmPermission("crm.assistant.billing.manage");
  const packageId = Number(formData.get("packageId"));
  if (!Number.isInteger(packageId) || packageId <= 0) return;
  await requestAiPackageInvoice(session.accountId, packageId);
  revalidatePath("/crm/assistant/site");
}

function pricePerToken(priceRub: unknown, tokens: unknown) {
  const price = Number(priceRub ?? 0);
  const tokenCount = Number(tokens ?? 0);
  return price > 0 && tokenCount > 0 ? price / tokenCount : 0;
}

function pricePerMillion(priceRub: unknown, tokens: unknown) {
  return pricePerToken(priceRub, tokens) * 1_000_000;
}

function bestTokenRate(packages: Array<{ priceRub: unknown; displayTokens: number | null }>) {
  return packages.reduce((best, pack) => {
    const rate = pricePerToken(pack.priceRub, pack.displayTokens);
    if (!rate) return best;
    return !best || rate < best ? rate : best;
  }, 0);
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
    balanceRub,
    usage,
    packages,
    ledger,
    purchases,
    purchasedTokenRows,
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
    getAiAccountBalance(accountId),
    prisma.aiUsage.aggregate({
      where: { accountId },
      _sum: { totalTokens: true, chargedRub: true },
    }),
    getAiAccessPackages(true),
    prisma.$queryRaw<Array<{ id: number; type: string; amountRub: unknown; createdAt: Date; totalTokens: number | null }>>`
      SELECT l."id", l."type", l."amountRub", l."createdAt", u."totalTokens"
      FROM "AiBalanceLedger" l
      LEFT JOIN "AiUsage" u ON u."id" = l."usageId"
      WHERE l."accountId" = ${accountId}
      ORDER BY l."createdAt" DESC
      LIMIT 8
    `,
    prisma.$queryRaw<AiAccessPurchaseWithInvoiceRow[]>`
      SELECT p.*, i."status" AS "invoiceStatus", i."paidAt" AS "invoicePaidAt"
      FROM "AiAccessPurchase" p
      LEFT JOIN "PlatformInvoice" i ON i."id" = p."invoiceId"
      WHERE p."accountId" = ${accountId}
      ORDER BY p."createdAt" DESC
      LIMIT 8
    `,
    prisma.$queryRaw<Array<{ tokens: bigint | number | null }>>`
      SELECT COALESCE(SUM(pkg."displayTokens"), 0) AS "tokens"
      FROM "AiAccessPurchase" p
      JOIN "AiAccessPackage" pkg ON pkg."id" = p."packageId"
      WHERE p."accountId" = ${accountId}
        AND p."status" = 'PAID'
        AND pkg."displayTokens" IS NOT NULL
    `,
  ]);

  const enabledLocationIds = parseIdSet(enabledLocationIdsSetting);
  const enabledServiceIds = parseIdSet(enabledServiceIdsSetting);
  const enabledSpecialistIds = parseIdSet(enabledSpecialistIdsSetting);
  const assistantName = typeof assistantNameSetting === "string" && assistantNameSetting.trim() ? assistantNameSetting : "Ассистент";
  const isAiEnabled = access?.aiEnabled ?? true;
  const isSiteAssistantEnabled = access?.siteAssistantEnabled ?? true;
  const totalTokens = Number(usage._sum.totalTokens ?? 0);
  const fallbackTokenRate = bestTokenRate(packages);
  const purchasedTokens = Number(purchasedTokenRows[0]?.tokens ?? 0);
  const fallbackTokens = purchasedTokens > 0 || !fallbackTokenRate ? 0 : Math.floor(balanceRub / fallbackTokenRate);
  const availableTokens = Math.max(0, purchasedTokens + fallbackTokens - totalTokens);
  const pendingInvoiceByPackageId = new Map(
    purchases
      .filter((purchase) => purchase.status === "PENDING" && ["DRAFT", "ISSUED"].includes(purchase.invoiceStatus ?? ""))
      .filter((purchase) => typeof purchase.packageId === "number")
      .map((purchase) => [purchase.packageId as number, purchase.invoiceId] as const),
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Ассистент</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Ассистент сайта</h1>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          {account?.name ?? "Аккаунт"} · чат, настройки, баланс и лимиты в одном месте
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="grid gap-4">
          <form action={saveAssistantAction} className="grid gap-4">
            <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
              <h2 className="text-lg font-semibold">Настройки ассистента</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Название в чате</span>
                  <input name="assistantName" defaultValue={assistantName} className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
                </label>
                <div className="grid gap-2 text-sm">
                  <StatusRow label="AI-доступ" value={isAiEnabled ? "включён" : "выключен"} tone={isAiEnabled ? "ok" : "danger"} />
                  <StatusRow label="Ассистент сайта" value={isSiteAssistantEnabled ? "включён" : "выключен"} tone={isSiteAssistantEnabled ? "ok" : "danger"} />
                </div>
              </div>
              <label className="mt-4 grid gap-2 text-sm">
                <span className="font-medium">Инструкции для ответов</span>
                <textarea
                  name="prompt"
                  defaultValue={typeof promptSetting === "string" ? promptSetting : ""}
                  placeholder="Например: отвечай вежливо и кратко, предлагай только активные услуги, перед записью уточняй филиал и специалиста."
                  className="min-h-36 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none"
                />
              </label>
            </article>

            <section className="grid gap-4 xl:grid-cols-3">
              <Dictionary title="Где принимает" name="locationId" items={locations.map((item) => ({ id: item.id, label: item.name }))} enabledIds={enabledLocationIds} />
              <Dictionary title="Какие услуги предлагает" name="serviceId" items={services.map((item) => ({ id: item.id, label: item.name }))} enabledIds={enabledServiceIds} />
              <Dictionary
                title="К кому может записывать"
                name="specialistId"
                items={specialists.map((item) => ({
                  id: item.id,
                  label: [item.user.profile?.firstName, item.user.profile?.lastName].filter(Boolean).join(" ") || item.user.email || `Специалист #${item.id}`,
                }))}
                enabledIds={enabledSpecialistIds}
              />
            </section>

            <button className="w-fit rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Сохранить настройки ассистента</button>
          </form>
        </div>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Окно ассистента</h2>
          <div className="mt-4 h-[620px] overflow-hidden rounded-xl border border-[color:var(--bp-stroke)] bg-white">
            {account?.slug ? (
              <div className="relative h-full">
                <PublicAiChatWidget
                  accountSlug={account.slug}
                  mode="inline"
                  defaultOpen
                  previewViewportWidth={390}
                  disablePageScrollOnMessages
                  className="inset-0"
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[color:var(--bp-muted)]">Аккаунт не найден.</div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-4">
          <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <h2 className="text-lg font-semibold">Токены ассистента</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Metric title="Доступно" value={int(availableTokens)} hint="токенов осталось" />
              <Metric title="Использовано" value={int(totalTokens)} hint="токенов списано" />
              <Metric title="Пакеты" value={String(packages.length)} hint="Доступны для покупки" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {packages.map((pack) => {
                const pendingInvoiceId = pendingInvoiceByPackageId.get(pack.id);
                return (
                  <form key={pack.id} action={requestPackageAction} className="rounded-xl border border-[color:var(--bp-stroke)] p-4">
                    <input type="hidden" name="packageId" value={pack.id} />
                    <div className="font-medium">{pack.name}</div>
                    <div className="mt-2 text-2xl font-semibold">{money(pack.priceRub)} ₽</div>
                    <div className="mt-1 text-sm text-[color:var(--bp-muted)]">{int(pack.displayTokens ?? 0)} токенов</div>
                    <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{money(pricePerMillion(pack.priceRub, pack.displayTokens))} ₽ за 1 млн токенов</div>
                    {pack.description ? <div className="mt-2 text-xs text-[color:var(--bp-muted)]">{pack.description}</div> : null}
                    <button
                      disabled={pendingInvoiceId != null}
                      className="mt-4 w-full rounded-xl bg-[color:var(--bp-accent)] px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {pendingInvoiceId ? `Счёт #${pendingInvoiceId}` : "Купить"}
                    </button>
                    {pendingInvoiceId ? (
                      <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                        Ожидает подтверждения оплаты администратором платформы.
                      </div>
                    ) : null}
                  </form>
                );
              })}
              {!packages.length ? <div className="text-sm text-[color:var(--bp-muted)]">Пакеты пока не настроены платформой.</div> : null}
            </div>
          </article>

          <form action={saveAccessAction} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <h2 className="text-lg font-semibold">Доступ и лимиты</h2>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <label className="flex items-center gap-2"><input name="aiEnabled" type="checkbox" defaultChecked={isAiEnabled} /> AI включён</label>
              <label className="flex items-center gap-2"><input name="siteAssistantEnabled" type="checkbox" defaultChecked={isSiteAssistantEnabled} /> Ассистент сайта включён</label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input name="dailySpendLimitRub" type="number" min="0" step="0.01" defaultValue={access?.dailySpendLimitRub?.toString() ?? ""} placeholder="Лимит в день, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="monthlySpendLimitRub" type="number" min="0" step="0.01" defaultValue={access?.monthlySpendLimitRub?.toString() ?? ""} placeholder="Лимит в месяц, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="minBalanceNotifyRub" type="number" min="0" step="0.01" defaultValue={access?.minBalanceNotifyRub?.toString() ?? ""} placeholder="Предупредить ниже, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="stopWhenBalanceBelowRub" type="number" min="0" step="0.01" defaultValue={access?.stopWhenBalanceBelowRub?.toString() ?? ""} placeholder="Остановить ниже, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            </div>
            <button className="mt-4 rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Сохранить доступ и лимиты</button>
          </form>
        </div>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">История баланса</h2>
          <div className="mt-4 grid gap-3 text-sm">
            {ledger.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
                <div>
                  <div className="font-medium">{ledgerTypeLabel(row.type)}</div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{row.createdAt.toLocaleString("ru-RU")}</div>
                </div>
                <div className={row.type === "usage" ? "text-rose-600" : "text-emerald-600"}>
                  {ledgerAmountLabel(row.type, row.totalTokens)}
                </div>
              </div>
            ))}
            {!ledger.length ? <div className="text-[color:var(--bp-muted)]">Движений баланса пока нет.</div> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function ledgerTypeLabel(type: string) {
  if (type === "usage") return "Расход ассистента";
  if (type === "purchase") return "Покупка пакета";
  if (type === "manual_credit") return "Пополнение";
  if (type === "manual_debit") return "Корректировка";
  if (type === "bonus") return "Бонус";
  return "Операция";
}

function ledgerAmountLabel(type: string, totalTokens: number | null) {
  if (type === "usage") return `-${int(totalTokens ?? 0)} токенов`;
  if (type === "purchase") return "пакет токенов";
  if (type === "bonus") return "бонусные токены";
  return "корректировка";
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

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <article className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-4 py-3">
      <div className="text-xs text-[color:var(--bp-muted)]">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{hint}</div>
    </article>
  );
}

function StatusRow({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "ok" | "danger";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] text-[color:var(--bp-muted)]";

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[color:var(--bp-muted)]">{label}</span>
      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}
