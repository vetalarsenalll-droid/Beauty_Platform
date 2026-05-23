import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { getAiAccountBalance, int, money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

export default async function CrmAssistantPage() {
  const session = await requireCrmPermission("crm.assistant.read");
  const accountId = session.accountId;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [balanceRub, usageMonth, threadsMonth, aiAppointmentsMonth, latestLogs] = await Promise.all([
    getAiAccountBalance(accountId),
    prisma.aiUsage.aggregate({
      where: { accountId, createdAt: { gte: startOfMonth } },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costRub: true, chargedRub: true },
      _count: { _all: true },
    }),
    prisma.aiThread.count({ where: { accountId, createdAt: { gte: startOfMonth } } }),
    prisma.appointment.count({ where: { accountId, source: "ai_assistant", createdAt: { gte: startOfMonth } } }),
    prisma.aiLog.findMany({
      where: { action: { is: { thread: { is: { accountId } } } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { action: true },
    }),
  ]);

  const charged = Number(usageMonth._sum.chargedRub ?? 0);
  const totalTokens = Number(usageMonth._sum.totalTokens ?? 0);
  const avgDialogRub = threadsMonth ? charged / threadsMonth : 0;
  const avgBookingRub = aiAppointmentsMonth ? charged / aiAppointmentsMonth : 0;
  const estimatedDialogsLeft = avgDialogRub > 0 ? Math.floor(balanceRub / avgDialogRub) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Ассистент</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">AI-инфраструктура аккаунта</h1>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
            Баланс, расход, записи и диалоги ассистента. Здесь отображается внутренний AI-доступ платформы, а не прямой аккаунт GigaChat.
          </p>
        </div>
        <Link href="/crm/assistant/billing" className="rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">
          Пополнить AI-баланс
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="AI-баланс" value={`${money(balanceRub)} ₽`} hint={estimatedDialogsLeft == null ? "Накопится после первых диалогов" : `Примерно ${int(estimatedDialogsLeft)} диалогов`} />
        <Metric title="Расход за месяц" value={`${money(charged)} ₽`} hint={`${int(totalTokens)} токенов`} />
        <Metric title="Диалоги за месяц" value={int(threadsMonth)} hint={`Средняя стоимость: ${money(avgDialogRub)} ₽`} />
        <Metric title="AI-записи за месяц" value={int(aiAppointmentsMonth)} hint={`Средняя стоимость: ${money(avgBookingRub)} ₽`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <NavCard href="/crm/assistant/billing" title="AI-баланс" text="Пакеты, пополнения и списания за использование ассистента." />
        <NavCard href="/crm/assistant/dialogs" title="Диалоги" text="История разговоров, статусы записи, debug trace и расход по диалогам." />
        <NavCard href="/crm/assistant/analytics" title="Аналитика Aisha" text="Текущий полный отчёт по качеству диалогов и конверсии в запись." />
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Последние AI-события</h2>
        <div className="mt-4 grid gap-3">
          {latestLogs.map((log) => (
            <div key={log.id} className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3 text-sm">
              <div className="font-medium">{log.message}</div>
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                {log.level} · {log.createdAt.toLocaleString("ru-RU")}
              </div>
            </div>
          ))}
          {!latestLogs.length ? <div className="text-sm text-[color:var(--bp-muted)]">AI-событий пока нет.</div> : null}
        </div>
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

function NavCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)] transition hover:border-[color:var(--bp-accent)]">
      <div className="font-semibold">{title}</div>
      <div className="mt-2 text-sm text-[color:var(--bp-muted)]">{text}</div>
    </Link>
  );
}
