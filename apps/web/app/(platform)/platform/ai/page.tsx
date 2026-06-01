import Link from "next/link";
import { requirePlatformPermission } from "@/lib/auth";
import { int, money } from "@/lib/ai-billing";
import { getGigaChatBalance } from "@/lib/gigachat";
import { prisma } from "@/lib/prisma";

export default async function PlatformAiPage() {
  await requirePlatformPermission("platform.ai.read");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [usageAll, usageMonth, aiAppointments, gigachatBalance] = await Promise.all([
    prisma.aiUsage.aggregate({
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costRub: true, chargedRub: true },
    }),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true, costRub: true, chargedRub: true },
    }),
    prisma.appointment.count({ where: { source: "ai_assistant" } }),
    getGigaChatBalance(),
  ]);

  const costAll = Number(usageAll._sum.costRub ?? 0);
  const chargedAll = Number(usageAll._sum.chargedRub ?? 0);
  const modelName = process.env.GIGACHAT_MODEL?.trim() || "GigaChat";
  const balanceModelName = modelName.toLowerCase().includes("lite") ? "GigaChat" : modelName;
  const balanceItem =
    gigachatBalance.items.find((item) => item.model.toLowerCase() === balanceModelName.toLowerCase()) ??
    gigachatBalance.items.find((item) => item.model.toLowerCase().includes(balanceModelName.toLowerCase())) ??
    gigachatBalance.items.find((item) => item.model.toLowerCase() === "gigachat") ??
    gigachatBalance.items[0] ??
    null;
  const providerTotalTokens = balanceItem?.totalTokens ?? null;
  const providerRemainingTokens = balanceItem?.remainingTokens ?? 0;
  const poolSpentPct = providerTotalTokens ? Math.min(100, (Math.max(0, providerTotalTokens - providerRemainingTokens) / providerTotalTokens) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / GigaChat</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">GigaChat токены и экономика AI</h1>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
            Бизнес-аккаунты покупают токены платформы. Баланс GigaChat читается через API Сбера, если ключ даёт доступ к методу баланса.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/platform/ai/packages" className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
            Пакеты
          </Link>
          <Link href="/platform/ai/accounts" className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm hover:border-[color:var(--bp-accent)]">
            Аккаунты
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Metric title="Осталось в GigaChat" value={providerRemainingTokens > 0 ? int(providerRemainingTokens) : "—"} hint={balanceItem ? balanceItem.model : "Баланс GigaChat недоступен"} />
        <Metric title="Себестоимость" value={`${money(costAll)} ₽`} hint={`За месяц: ${money(usageMonth._sum.costRub)} ₽`} />
        <Metric title="Списано с аккаунтов" value={`${money(chargedAll)} ₽`} hint={`За месяц: ${money(usageMonth._sum.chargedRub)} ₽`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)] xl:col-span-2">
          <h2 className="text-lg font-semibold">Текущий баланс GigaChat</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[color:var(--bp-muted)]">Активный провайдер</span>
              <span className="font-medium">{balanceItem?.model ?? modelName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[color:var(--bp-muted)]">GigaChat ключ</span>
              <span className="font-medium">{process.env.GIGACHAT_AUTH_KEY?.trim() ? "настроен" : "не настроен"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[color:var(--bp-muted)]">Остаток в GigaChat</span>
              <span className="font-medium">{providerRemainingTokens > 0 ? `${int(providerRemainingTokens)} токенов` : "не удалось получить"}</span>
            </div>
            {providerTotalTokens ? (
              <div className="h-2 rounded-full bg-[color:var(--bp-soft)]">
                <div className="h-2 rounded-full bg-[color:var(--bp-accent)]" style={{ width: `${poolSpentPct}%` }} />
              </div>
            ) : null}
            <div className="text-xs text-[color:var(--bp-muted)]">
              {gigachatBalance.ok ? "Баланс получен напрямую из GigaChat API." : `Не удалось получить баланс GigaChat: ${gigachatBalance.error ?? "неизвестная ошибка"}.`}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">AI-записи</h2>
          <div className="mt-3 text-3xl font-semibold">{int(aiAppointments)}</div>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Записи с источником <span className="font-mono">ai_assistant</span>. Средняя себестоимость записи: {money(aiAppointments ? costAll / aiAppointments : 0)} ₽.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Разделы</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <NavCard href="/platform/ai/packages" title="Пакеты AI-доступа" text="Что покупают бизнес-аккаунты внутри платформы." />
          <NavCard href="/platform/ai/accounts" title="Начисления аккаунтам" text="Баланс, ручные пополнения, расход и маржа по аккаунтам." />
          <NavCard href="/platform/billing" title="Счета и оплаты" text="Текущая система выставления счетов платформы." />
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
    <Link href={href} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4 transition hover:border-[color:var(--bp-accent)]">
      <div className="font-semibold">{title}</div>
      <div className="mt-2 text-sm text-[color:var(--bp-muted)]">{text}</div>
    </Link>
  );
}
