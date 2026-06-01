import { revalidatePath } from "next/cache";
import PublicAiChatWidget from "@/components/public-ai-chat-widget";
import AiBalanceHistory, { type AiBalanceHistoryRow } from "./ai-balance-history";
import AiPackageCheckout from "./ai-package-checkout";
import AiBalanceAutoRefresh from "./ai-balance-auto-refresh";
import { requireCrmPermission } from "@/lib/auth";
import {
  getAiAccessPackages,
  getAiTokenBalancesByAccountIds,
  int,
  money,
  readText,
  type AiAccessPurchaseWithInvoiceRow,
} from "@/lib/ai-billing";
import { getAccountAiSetting, upsertAccountAiSetting } from "@/lib/ai-settings";
import { prisma } from "@/lib/prisma";

async function saveAssistantAction(formData: FormData) {
  "use server";
  const session = await requireCrmPermission("crm.assistant.site.manage");
  const accountId = session.accountId;
  await upsertAccountAiSetting(accountId, "aisha.assistantName", readText(formData.get("assistantName"), 80) || "Ассистент");
  await upsertAccountAiSetting(accountId, "aisha.systemPrompt", readText(formData.get("prompt"), 4000));
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

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export default async function CrmAssistantSitePage() {
  const session = await requireCrmPermission("crm.assistant.site.read");
  const accountId = session.accountId;

  const [
    account,
    promptSetting,
    assistantNameSetting,
    usage,
    packages,
    ledger,
    purchases,
    tokenBalances,
  ] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true, slug: true } }),
    getAccountAiSetting(accountId, "aisha.systemPrompt"),
    getAccountAiSetting(accountId, "aisha.assistantName"),
    prisma.aiUsage.aggregate({
      where: { accountId },
      _sum: { totalTokens: true, chargedRub: true },
    }),
    getAiAccessPackages(true),
    prisma.$queryRaw<
      Array<{
        id: number;
        type: string;
        amountTokens: number;
        createdAt: Date;
        comment: string | null;
        totalTokens: number | null;
        promptTokens: number | null;
        completionTokens: number | null;
        provider: string | null;
        model: string | null;
        purpose: string | null;
        actionPayload: unknown;
      }>
    >`
      SELECT
        l."id",
        l."type",
        l."amountTokens",
        l."createdAt",
        l."comment",
        u."totalTokens",
        u."promptTokens",
        u."completionTokens",
        u."provider",
        u."model",
        u."purpose",
        a."payload" AS "actionPayload"
      FROM "AiBalanceLedger" l
      LEFT JOIN "AiUsage" u ON u."id" = l."usageId"
      LEFT JOIN "AiAction" a ON a."id" = u."actionId"
      WHERE l."accountId" = ${accountId}
      ORDER BY l."createdAt" DESC
      LIMIT 100
    `,
    prisma.$queryRaw<AiAccessPurchaseWithInvoiceRow[]>`
      SELECT p.*, i."status" AS "invoiceStatus", i."paidAt" AS "invoicePaidAt"
      FROM "AiAccessPurchase" p
      LEFT JOIN "PlatformInvoice" i ON i."id" = p."invoiceId"
      WHERE p."accountId" = ${accountId}
      ORDER BY p."createdAt" DESC
      LIMIT 8
    `,
    getAiTokenBalancesByAccountIds([accountId]),
  ]);

  const assistantName = typeof assistantNameSetting === "string" && assistantNameSetting.trim() ? assistantNameSetting : "Ассистент";
  const totalTokens = Number(usage._sum.totalTokens ?? 0);
  const tokenBalance = tokenBalances.get(accountId) ?? { availableTokens: 0, purchasedTokens: 0, usedTokens: totalTokens };
  const availableTokens = tokenBalance.availableTokens;
  const historyRows: AiBalanceHistoryRow[] = ledger.map((row) => {
    const payload = jsonObject(row.actionPayload);
    const userMessage = typeof payload?.message === "string" ? payload.message : null;
    const assistantReply = typeof payload?.reply === "string" ? payload.reply : null;
    return {
      id: row.id,
      type: row.type,
      amountTokens: Number(row.amountTokens ?? 0),
      createdAtIso: row.createdAt.toISOString(),
      totalTokens: row.totalTokens,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      provider: row.provider,
      model: row.model,
      purpose: row.purpose,
      comment: row.comment,
      userMessage,
      assistantReply,
    };
  });
  const pendingInvoiceByPackageId = new Map(
    purchases
      .filter((purchase) => purchase.status === "PENDING" && ["DRAFT", "ISSUED"].includes(purchase.invoiceStatus ?? ""))
      .filter((purchase) => typeof purchase.packageId === "number")
      .map((purchase) => [purchase.packageId as number, purchase.invoiceId] as const),
  );

  return (
    <div className="flex flex-col gap-6">
      <AiBalanceAutoRefresh />
      <section className="grid items-start gap-4 2xl:grid-cols-[minmax(420px,0.85fr)_minmax(720px,1.15fr)]">
        <div className="grid gap-4">
          <form action={saveAssistantAction} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Настройки ассистента</h2>
              <button className="rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Сохранить изменения</button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Название в чате</span>
                <input name="assistantName" defaultValue={assistantName} className="h-10 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 outline-none" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Инструкции для ответов</span>
                <textarea
                  name="prompt"
                  defaultValue={typeof promptSetting === "string" ? promptSetting : ""}
                  placeholder="Например: отвечай вежливо и кратко, предлагай только активные услуги, перед записью уточняй филиал и специалиста."
                  className="h-28 w-full resize-none rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none"
                />
              </label>
            </div>
          </form>

          <article className="min-h-[360px] rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
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
                  <AiPackageCheckout
                    key={pack.id}
                    packageId={pack.id}
                    name={pack.name}
                    priceLabel={money(pack.priceRub)}
                    tokensLabel={int(pack.displayTokens ?? 0)}
                    pricePerMillionLabel={money(pricePerMillion(pack.priceRub, pack.displayTokens))}
                    description={pack.description}
                    pendingInvoiceId={pendingInvoiceId ?? null}
                  />
                );
              })}
              {!packages.length ? <div className="text-sm text-[color:var(--bp-muted)]">Пакеты пока не настроены платформой.</div> : null}
            </div>
          </article>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-2">
          <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
            <h2 className="text-lg font-semibold">Окно ассистента</h2>
            <div className="mt-4 h-[440px] overflow-hidden rounded-xl border border-[color:var(--bp-stroke)] bg-white">
              {account?.slug ? (
                <div className="relative h-full">
                  <PublicAiChatWidget
                    accountSlug={account.slug}
                    mode="inline"
                    defaultOpen
                    previewViewportWidth={390}
                    disablePageScrollOnMessages
                    refreshPageOnTurnComplete
                    className="inset-0"
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[color:var(--bp-muted)]">Аккаунт не найден.</div>
              )}
            </div>
          </article>

          <AiBalanceHistory rows={historyRows} />
        </div>
      </section>
    </div>
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
