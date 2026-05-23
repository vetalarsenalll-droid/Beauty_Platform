import Link from "next/link";
import { requirePlatformPermission } from "@/lib/auth";
import { money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(raw: Record<string, string | string[] | undefined>, key: string) {
  const value = raw[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlatformAiLedgerPage({ searchParams }: PageProps) {
  await requirePlatformPermission("platform.ai.ledger.manage");
  const rawParams = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const accountIdRaw = Number(pickParam(rawParams, "accountId"));
  const accountId = Number.isInteger(accountIdRaw) && accountIdRaw > 0 ? accountIdRaw : null;

  const rows = await prisma.aiBalanceLedger.findMany({
    where: accountId ? { accountId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / GigaChat</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Глобальный ledger AI-баланса</h1>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Покупки, ручные начисления и usage-списания{accountId ? ` аккаунта #${accountId}` : " всех аккаунтов"}.
          </p>
        </div>
        {accountId ? (
          <Link href="/platform/ai/ledger" className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
            Все аккаунты
          </Link>
        ) : null}
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-[color:var(--bp-muted)]">
              <tr>
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Аккаунт</th>
                <th className="py-2 pr-3">Тип</th>
                <th className="py-2 pr-3">Сумма</th>
                <th className="py-2 pr-3">Usage</th>
                <th className="py-2 pr-3">Комментарий</th>
                <th className="py-2 pr-3">Дата</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[color:var(--bp-stroke)]">
                  <td className="py-2 pr-3">#{row.id}</td>
                  <td className="py-2 pr-3">{row.accountId}</td>
                  <td className="py-2 pr-3">{row.type}</td>
                  <td className={Number(row.amountRub) < 0 ? "py-2 pr-3 text-rose-600" : "py-2 pr-3 text-emerald-600"}>
                    {money(row.amountRub)} ₽
                  </td>
                  <td className="py-2 pr-3">{row.usageId ? `#${row.usageId}` : "—"}</td>
                  <td className="py-2 pr-3">{row.comment ?? "—"}</td>
                  <td className="py-2 pr-3">{row.createdAt.toLocaleString("ru-RU")}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr><td colSpan={7} className="py-4 text-[color:var(--bp-muted)]">Движений AI-баланса пока нет.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
