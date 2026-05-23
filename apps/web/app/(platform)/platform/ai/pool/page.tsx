import Link from "next/link";
import { requirePlatformPermission } from "@/lib/auth";
import { getAiProviderPools, int, money } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

export default async function PlatformAiPoolPage() {
  await requirePlatformPermission("platform.ai.read");

  const [pools, usage] = await Promise.all([
    getAiProviderPools(),
    prisma.aiUsage.aggregate({ _sum: { totalTokens: true, costRub: true, chargedRub: true } }),
  ]);
  const activePool = pools.find((pool) => pool.isActive) ?? pools[0] ?? null;
  const totalTokens = Number(usage._sum.totalTokens ?? 0);
  const poolTokens = activePool?.packageTokens ?? Number(process.env.GIGACHAT_PACKAGE_TOKENS ?? 0);
  const poolCost = activePool ? Number(activePool.packageCostRub) : Number(process.env.GIGACHAT_PACKAGE_RUB ?? 0);
  const remaining = poolTokens > 0 ? Math.max(0, poolTokens - totalTokens) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / GigaChat</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Пул GigaChat платформы</h1>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">Это твоя закупка и себестоимость, не клиентский баланс.</p>
        </div>
        <Link href="/platform/ai/packages" className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
          Добавить закупку
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="Ключ GigaChat" value={process.env.GIGACHAT_AUTH_KEY?.trim() ? "настроен" : "не настроен"} hint="Секрет хранится в .env" />
        <Metric title="Объём пула" value={int(poolTokens)} hint={`${money(poolCost)} ₽ закупка`} />
        <Metric title="Израсходовано" value={int(totalTokens)} hint={`${money(usage._sum.costRub)} ₽ себестоимость`} />
        <Metric title="Остаток расчётно" value={int(remaining)} hint="По данным AiUsage" />
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Закупки</h2>
        <div className="mt-4 grid gap-3">
          {pools.map((pool) => (
            <div key={pool.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-semibold">{pool.provider} / {pool.model}</div>
                <div className="text-xs text-[color:var(--bp-muted)]">{pool.isActive ? "активен" : "выключен"}</div>
              </div>
              <div className="mt-2 text-[color:var(--bp-muted)]">
                {int(pool.packageTokens)} токенов за {money(pool.packageCostRub)} ₽. 1 млн токенов: {money((Number(pool.packageCostRub) / Math.max(1, pool.packageTokens)) * 1_000_000)} ₽.
              </div>
              {pool.notes ? <div className="mt-2 text-xs text-[color:var(--bp-muted)]">{pool.notes}</div> : null}
            </div>
          ))}
          {!pools.length ? <div className="text-sm text-[color:var(--bp-muted)]">В БД закупок нет, используются значения из .env.</div> : null}
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
