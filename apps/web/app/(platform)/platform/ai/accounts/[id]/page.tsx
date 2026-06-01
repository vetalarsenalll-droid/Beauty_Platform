import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformPermission } from "@/lib/auth";
import { getAiAccountAccessByAccountIds, getAiTokenBalancesByAccountIds, int, money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

function boolLabel(value: boolean) {
  return value ? "включено" : "выключено";
}

export default async function PlatformAiAccountDetailPage({ params }: PageProps) {
  await requirePlatformPermission("platform.ai.read");
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) notFound();

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, slug: true, status: true, createdAt: true },
  });
  if (!account) notFound();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [tokenBalances, accessByAccount, usageMonth, usageAll, ledger, dialogs] = await Promise.all([
    getAiTokenBalancesByAccountIds([account.id]),
    getAiAccountAccessByAccountIds([account.id]),
    prisma.aiUsage.aggregate({
      where: { accountId: account.id, createdAt: { gte: startOfMonth } },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costRub: true, chargedRub: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.aggregate({
      where: { accountId: account.id },
      _sum: { totalTokens: true, costRub: true, chargedRub: true },
      _count: { _all: true },
    }),
    prisma.aiBalanceLedger.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.aiThread.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        messages: { orderBy: { id: "desc" }, take: 2, select: { role: true, content: true } },
      },
    }),
  ]);

  const access = accessByAccount.get(account.id);
  const tokenBalance = tokenBalances.get(account.id) ?? { availableTokens: 0, purchasedTokens: 0, usedTokens: 0 };
  const monthCost = Number(usageMonth._sum.costRub ?? 0);
  const monthCharged = Number(usageMonth._sum.chargedRub ?? 0);
  const allCost = Number(usageAll._sum.costRub ?? 0);
  const allCharged = Number(usageAll._sum.chargedRub ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / аккаунт</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{account.name}</h1>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            {account.slug} · #{account.id} · {account.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/platform/ai/accounts" className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 hover:border-[color:var(--bp-accent)]">
            К аккаунтам
          </Link>
          <Link href={`/platform/accounts/${account.id}`} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 hover:border-[color:var(--bp-accent)]">
            Карточка аккаунта
          </Link>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Токены доступны" value={int(tokenBalance.availableTokens)} hint={`Куплено: ${int(tokenBalance.purchasedTokens)}`} />
        <Metric title="Токены за месяц" value={int(usageMonth._sum.totalTokens)} hint={`Списано с аккаунта: ${money(monthCharged)} ₽`} />
        <Metric title="Маржа за месяц" value={`${money(monthCharged - monthCost)} ₽`} hint={`Себестоимость: ${money(monthCost)} ₽`} />
        <Metric title="За всё время" value={int(tokenBalance.usedTokens)} hint={`${int(usageAll._count._all)} usage-записей`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Доступ и лимиты</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <InfoRow label="AI" value={boolLabel(access?.aiEnabled ?? true)} />
            <InfoRow label="Site assistant" value={boolLabel(access?.siteAssistantEnabled ?? true)} />
            <InfoRow label="CRM-agent" value={boolLabel(access?.crmAgentEnabled ?? false)} />
            <InfoRow label="Лимит в день" value={access?.dailyTokenLimit != null ? `${int(access.dailyTokenLimit)} токенов` : "не задан"} />
            <InfoRow label="Лимит в месяц" value={access?.monthlyTokenLimit != null ? `${int(access.monthlyTokenLimit)} токенов` : "не задан"} />
            <InfoRow label="Предупреждение" value={access?.minTokensNotify != null ? `${int(access.minTokensNotify)} токенов` : "не задано"} />
            <InfoRow label="Стоп ниже" value={access?.stopWhenTokensBelow != null ? `${int(access.stopWhenTokensBelow)} токенов` : "не задан"} />
          </dl>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Быстрые переходы</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href={`/platform/ai/usage?accountId=${account.id}`} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 hover:border-[color:var(--bp-accent)]">
              Usage
            </Link>
            <Link href={`/platform/ai/ledger?accountId=${account.id}`} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 hover:border-[color:var(--bp-accent)]">
              Ledger
            </Link>
            <Link href={`/platform/ai/usage?accountId=${account.id}#dialogs`} className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 hover:border-[color:var(--bp-accent)]">
              Диалоги
            </Link>
          </div>
          <p className="mt-4 text-sm text-[color:var(--bp-muted)]">
            Редактирование доступа и ручные операции остаются на общем списке, чтобы не дублировать формы и права.
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Внутренний ledger, ₽</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-left text-[color:var(--bp-muted)]">
                <tr>
                  <th className="py-2 pr-3">Тип</th>
                  <th className="py-2 pr-3">Токены</th>
                  <th className="py-2 pr-3">Сумма</th>
                  <th className="py-2 pr-3">Комментарий</th>
                  <th className="py-2 pr-3">Дата</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id} className="border-t border-[color:var(--bp-stroke)]">
                    <td className="py-2 pr-3">{row.type}</td>
                    <td className={row.amountTokens < 0 ? "py-2 pr-3 text-rose-600" : "py-2 pr-3 text-emerald-600"}>
                      {row.amountTokens > 0 ? "+" : ""}{int(row.amountTokens)}
                    </td>
                    <td className={Number(row.amountRub) < 0 ? "py-2 pr-3 text-rose-600" : "py-2 pr-3 text-emerald-600"}>
                      {money(row.amountRub)} ₽
                    </td>
                    <td className="py-2 pr-3">{row.comment ?? "—"}</td>
                    <td className="py-2 pr-3">{row.createdAt.toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
                {!ledger.length ? <tr><td colSpan={5} className="py-4 text-[color:var(--bp-muted)]">Движений пока нет.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Последние диалоги</h2>
          <div className="mt-4 grid gap-3 text-sm">
            {dialogs.map((thread) => (
              <div key={thread.id} className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">Диалог #{thread.id}</div>
                </div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{thread.createdAt.toLocaleString("ru-RU")}</div>
                <div className="mt-2 grid gap-1">
                  {thread.messages.slice().reverse().map((message, index) => (
                    <div key={`${thread.id}-${index}`} className="line-clamp-2 text-xs text-[color:var(--bp-muted)]">
                      {message.role}: {message.content}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!dialogs.length ? <div className="text-[color:var(--bp-muted)]">Диалогов пока нет.</div> : null}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Итоги за всё время</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <InfoTile label="Токены" value={int(usageAll._sum.totalTokens)} />
          <InfoTile label="Себестоимость" value={`${money(allCost)} ₽`} />
          <InfoTile label="Маржа" value={`${money(allCharged - allCost)} ₽`} />
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
      <div className="text-sm text-[color:var(--bp-muted)]">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{hint}</div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--bp-stroke)] pb-2 last:border-b-0 last:pb-0">
      <dt className="text-[color:var(--bp-muted)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
      <div className="text-xs text-[color:var(--bp-muted)]">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
