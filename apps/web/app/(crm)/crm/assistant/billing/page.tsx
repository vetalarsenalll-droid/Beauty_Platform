import { revalidatePath } from "next/cache";
import { requireCrmPermission } from "@/lib/auth";
import {
  getAiAccessPackages,
  getAiAccountBalance,
  int,
  money,
  requestAiPackageInvoice,
  type AiAccessPurchaseWithInvoiceRow,
} from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

async function requestPackageAction(formData: FormData) {
  "use server";
  const session = await requireCrmPermission("crm.assistant.billing.manage");
  const packageId = Number(formData.get("packageId"));
  if (!Number.isInteger(packageId) || packageId <= 0) return;
  await requestAiPackageInvoice(session.accountId, packageId);
  revalidatePath("/crm/assistant/billing");
}

function invoiceStatusLabel(status: string | null) {
  switch (status) {
    case "DRAFT":
      return "черновик";
    case "ISSUED":
      return "выставлен";
    case "PAID":
      return "оплачен";
    case "VOID":
      return "закрыт";
    default:
      return "без счёта";
  }
}

function purchaseStatusLabel(status: string) {
  if (status === "PENDING") return "ожидает оплаты";
  if (status === "PAID") return "начислено";
  if (status === "CANCELLED") return "отменено";
  return status;
}

export default async function CrmAssistantBillingPage() {
  const session = await requireCrmPermission("crm.assistant.billing.read");
  const accountId = session.accountId;

  const [balanceRub, packages, ledger, purchases, usage] = await Promise.all([
    getAiAccountBalance(accountId),
    getAiAccessPackages(true),
    prisma.aiBalanceLedger.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.$queryRaw<AiAccessPurchaseWithInvoiceRow[]>`
      SELECT p.*, i."status" AS "invoiceStatus", i."paidAt" AS "invoicePaidAt"
      FROM "AiAccessPurchase" p
      LEFT JOIN "PlatformInvoice" i ON i."id" = p."invoiceId"
      WHERE p."accountId" = ${accountId}
      ORDER BY p."createdAt" DESC
      LIMIT 50
    `,
    prisma.aiUsage.aggregate({
      where: { accountId },
      _sum: { totalTokens: true, chargedRub: true },
    }),
  ]);

  const pendingInvoiceByPackageId = new Map(
    purchases
      .filter((purchase) => purchase.status === "PENDING" && ["DRAFT", "ISSUED"].includes(purchase.invoiceStatus ?? ""))
      .filter((purchase) => typeof purchase.packageId === "number")
      .map((purchase) => [purchase.packageId as number, purchase.invoiceId] as const),
  );
  const totalCharged = Number(usage._sum.chargedRub ?? 0);
  const totalTokens = Number(usage._sum.totalTokens ?? 0);
  const avgRubPerMillion = totalTokens > 0 ? (totalCharged / totalTokens) * 1_000_000 : 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Ассистент</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">AI-баланс</h1>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
          Аккаунт покупает AI-доступ платформы. Ключи и реальный GigaChat-пул принадлежат платформе.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric title="Текущий AI-баланс" value={`${money(balanceRub)} ₽`} hint="Внутренний баланс аккаунта" />
        <Metric title="Списано всего" value={`${money(totalCharged)} ₽`} hint={`${int(totalTokens)} токенов ассистента`} />
        <Metric title="Цена 1 млн токенов" value={`${money(avgRubPerMillion)} ₽`} hint="По фактической истории аккаунта" />
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Доступные AI-пакеты</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((pack) => {
            const pendingInvoiceId = pendingInvoiceByPackageId.get(pack.id);
            const hasPendingInvoice = pendingInvoiceId != null;
            return (
              <article key={pack.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
                <div className="text-lg font-semibold">{pack.name}</div>
                <div className="mt-2 text-2xl font-semibold">{money(pack.priceRub)} ₽</div>
                <div className="mt-2 text-sm text-[color:var(--bp-muted)]">
                  Начисляется AI-баланс: {money(pack.includedCreditRub)} ₽
                </div>
                {pack.displayTokens ? (
                  <div className="mt-1 text-sm text-[color:var(--bp-muted)]">Витринно: {int(pack.displayTokens)} токенов</div>
                ) : null}
                {pack.description ? <p className="mt-3 text-sm text-[color:var(--bp-muted)]">{pack.description}</p> : null}
                <form action={requestPackageAction} className="mt-4">
                  <input type="hidden" name="packageId" value={pack.id} />
                  <button
                    disabled={hasPendingInvoice}
                    className="w-full rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {hasPendingInvoice ? `Счёт #${pendingInvoiceId} уже выставлен` : "Выставить счёт"}
                  </button>
                </form>
                {hasPendingInvoice ? (
                  <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                    Повторный счёт по этому пакету не создаётся, пока текущий счёт не оплачен или не закрыт.
                  </div>
                ) : null}
              </article>
            );
          })}
          {!packages.length ? <div className="text-sm text-[color:var(--bp-muted)]">Пакеты пока не настроены платформой.</div> : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Покупки AI-доступа</h2>
          <div className="mt-4 grid gap-3 text-sm">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
                <div className="font-medium">{money(purchase.creditRub)} ₽ AI-баланса</div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                  Счёт #{purchase.invoiceId ?? "—"} · {invoiceStatusLabel(purchase.invoiceStatus)} · {purchaseStatusLabel(purchase.status)}
                </div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                  К оплате {money(purchase.amountRub)} ₽ · создан {purchase.createdAt.toLocaleString("ru-RU")}
                  {purchase.invoicePaidAt ? ` · оплачен ${purchase.invoicePaidAt.toLocaleString("ru-RU")}` : ""}
                </div>
                {purchase.status === "PENDING" ? (
                  <div className="mt-2 rounded-lg bg-[color:var(--bp-soft)] px-3 py-2 text-xs text-[color:var(--bp-muted)]">
                    Оплатите счёт #{purchase.invoiceId}. После отметки оплаты платформой AI-баланс начислится автоматически.
                  </div>
                ) : null}
              </div>
            ))}
            {!purchases.length ? <div className="text-[color:var(--bp-muted)]">Покупок пока нет.</div> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">История баланса</h2>
          <div className="mt-4 grid gap-3 text-sm">
            {ledger.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
                <div>
                  <div className="font-medium">{row.type}</div>
                  <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{row.comment ?? "—"} · {row.createdAt.toLocaleString("ru-RU")}</div>
                </div>
                <div className={Number(row.amountRub) < 0 ? "text-rose-600" : "text-emerald-600"}>
                  {money(row.amountRub)} ₽
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

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
      <div className="text-sm text-[color:var(--bp-muted)]">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{hint}</div>
    </article>
  );
}
