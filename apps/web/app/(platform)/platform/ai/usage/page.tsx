import Link from "next/link";
import { requirePlatformPermission } from "@/lib/auth";
import { int, money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(raw: Record<string, string | string[] | undefined>, key: string) {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlatformAiUsagePage({ searchParams }: PageProps) {
  await requirePlatformPermission("platform.ai.usage.read");
  const rawParams = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const accountIdRaw = Number(pickParam(rawParams, "accountId"));
  const accountId = Number.isInteger(accountIdRaw) && accountIdRaw > 0 ? accountIdRaw : null;
  const where = accountId ? { accountId } : undefined;

  const [rows, byPurpose, dialogs] = await Promise.all([
    prisma.aiUsage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        accountId: true,
        threadId: true,
        provider: true,
        model: true,
        purpose: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costRub: true,
        chargedRub: true,
        createdAt: true,
      },
    }),
    prisma.aiUsage.groupBy({
      by: ["purpose"],
      where,
      _sum: { totalTokens: true, costRub: true, chargedRub: true },
      _count: { _all: true },
      orderBy: { _sum: { totalTokens: "desc" } },
    }),
    accountId
      ? prisma.aiThread.findMany({
          where: { accountId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            createdAt: true,
            messages: { orderBy: { id: "desc" }, take: 2, select: { role: true, content: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / GigaChat</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Глобальный AI-расход</h1>
          {accountId ? <p className="mt-2 text-sm text-[color:var(--bp-muted)]">Фильтр по аккаунту #{accountId}</p> : null}
        </div>
        {accountId ? (
          <Link href="/platform/ai/usage" className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
            Все аккаунты
          </Link>
        ) : null}
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {byPurpose.map((item) => {
          const cost = Number(item._sum.costRub ?? 0);
          const charged = Number(item._sum.chargedRub ?? 0);
          return (
            <article key={item.purpose} className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
              <div className="font-semibold">{item.purpose}</div>
              <div className="mt-2 text-sm text-[color:var(--bp-muted)]">{int(item._sum.totalTokens)} токенов</div>
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">Маржа: {money(charged - cost)} ₽</div>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Последние списания usage</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="text-left text-[color:var(--bp-muted)]">
              <tr>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Аккаунт</th>
                <th className="py-2 pr-3">Диалог</th>
                <th className="py-2 pr-3">Purpose</th>
                <th className="py-2 pr-3">Модель</th>
                <th className="py-2 pr-3">Prompt</th>
                <th className="py-2 pr-3">Completion</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Себестоимость</th>
                <th className="py-2 pr-3">Списано</th>
                <th className="py-2 pr-3">Дата</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[color:var(--bp-stroke)]">
                  <td className="py-2 pr-3">#{row.id}</td>
                  <td className="py-2 pr-3">{row.accountId ?? "—"}</td>
                  <td className="py-2 pr-3">{row.threadId ? `#${row.threadId}` : "—"}</td>
                  <td className="py-2 pr-3">{row.purpose}</td>
                  <td className="py-2 pr-3">{row.provider}/{row.model}</td>
                  <td className="py-2 pr-3">{int(row.promptTokens)}</td>
                  <td className="py-2 pr-3">{int(row.completionTokens)}</td>
                  <td className="py-2 pr-3">{int(row.totalTokens)}</td>
                  <td className="py-2 pr-3">{money(row.costRub)} ₽</td>
                  <td className="py-2 pr-3">{money(row.chargedRub)} ₽</td>
                  <td className="py-2 pr-3">{row.createdAt.toLocaleString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {accountId ? (
        <section id="dialogs" className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Последние диалоги аккаунта</h2>
          <div className="mt-4 grid gap-3 text-sm">
            {dialogs.map((thread) => (
              <div key={thread.id} className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-3">
                <div className="font-medium">Диалог #{thread.id}</div>
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
        </section>
      ) : null}
    </div>
  );
}
