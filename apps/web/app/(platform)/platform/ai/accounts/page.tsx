import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requirePlatformPermission } from "@/lib/auth";
import {
  addAiLedgerAdjustment,
  creditAiBalance,
  getAiAccountAccessByAccountIds,
  getAiAccessPackages,
  getAiBalanceByAccountIds,
  int,
  money,
  readCheckbox,
  readOptionalNumber,
  readOptionalPositiveInt,
  readPositiveNumber,
  readText,
  updateAiAccountAccess,
} from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";
import { AiBalanceAdjustmentForm } from "./ai-balance-adjustment-form";

async function creditAccountAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.manage");
  const accountId = readOptionalPositiveInt(formData.get("accountId"));
  const packageId = readOptionalPositiveInt(formData.get("packageId"));
  const creditRub = readPositiveNumber(formData.get("creditRub"));
  const amountRub = readPositiveNumber(formData.get("amountRub"), creditRub);
  if (!accountId || creditRub <= 0) return;
  await creditAiBalance({
    accountId,
    packageId,
    amountRub,
    creditRub,
    comment: packageId ? `AI package #${packageId}` : "Manual AI credit",
  });
  revalidatePath("/platform/ai/accounts");
  revalidatePath(`/platform/ai/accounts/${accountId}`);
  revalidatePath("/platform/ai");
}

async function updateAccountAccessAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.accounts.manage");
  const accountId = readOptionalPositiveInt(formData.get("accountId"));
  if (!accountId) return;
  await updateAiAccountAccess({
    accountId,
    aiEnabled: readCheckbox(formData.get("aiEnabled")),
    siteAssistantEnabled: readCheckbox(formData.get("siteAssistantEnabled")),
    crmAgentEnabled: readCheckbox(formData.get("crmAgentEnabled")),
    dailySpendLimitRub: readOptionalNumber(formData.get("dailySpendLimitRub")),
    monthlySpendLimitRub: readOptionalNumber(formData.get("monthlySpendLimitRub")),
    minBalanceNotifyRub: readOptionalNumber(formData.get("minBalanceNotifyRub")),
    stopWhenBalanceBelowRub: readOptionalNumber(formData.get("stopWhenBalanceBelowRub")),
  });
  revalidatePath("/platform/ai/accounts");
  revalidatePath(`/platform/ai/accounts/${accountId}`);
}

async function adjustBalanceAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.ledger.manage");
  const accountId = readOptionalPositiveInt(formData.get("accountId"));
  const direction = readText(formData.get("direction"), 20);
  const amount = readPositiveNumber(formData.get("amountRub"));
  const comment = readText(formData.get("comment"), 200) || null;
  if (!accountId || amount <= 0) return;
  const type = direction === "debit" ? "manual_debit" : direction === "bonus" ? "bonus" : "manual_credit";
  await addAiLedgerAdjustment({
    accountId,
    type,
    amountRub: type === "manual_debit" ? -amount : amount,
    comment,
  });
  revalidatePath("/platform/ai/accounts");
  revalidatePath(`/platform/ai/accounts/${accountId}`);
  revalidatePath("/platform/ai/ledger");
}

export default async function PlatformAiAccountsPage() {
  await requirePlatformPermission("platform.ai.read");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [accounts, packages, usageByAccount] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, status: true } }),
    getAiAccessPackages(true),
    prisma.aiUsage.groupBy({
      by: ["accountId"],
      where: { accountId: { not: null }, createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true, costRub: true, chargedRub: true },
      _count: { _all: true },
    }),
  ]);

  const accountIds = accounts.map((account) => account.id);
  const [balances, accessByAccount] = await Promise.all([
    getAiBalanceByAccountIds(accountIds),
    getAiAccountAccessByAccountIds(accountIds),
  ]);
  const usageMap = new Map(usageByAccount.map((row) => [row.accountId, row]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / GigaChat</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">AI-доступ по аккаунтам</h1>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
          Платформа начисляет бизнес-аккаунтам внутренний AI-баланс. Реальные токены и ключи GigaChat остаются только у платформы.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Начислить AI-баланс</h2>
        <form action={creditAccountAction} className="mt-4 grid gap-3 text-sm lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
          <select name="accountId" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none">
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} #{account.id}</option>
            ))}
          </select>
          <select name="packageId" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none">
            <option value="">Ручное начисление</option>
            {packages.map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.name}</option>
            ))}
          </select>
          <input name="amountRub" type="number" min="0" step="0.01" placeholder="Оплачено, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
          <input name="creditRub" type="number" min="1" step="0.01" placeholder="Начислить, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
          <button className="rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 font-medium text-white">Начислить</button>
        </form>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Ручная операция по AI-балансу</h2>
        <AiBalanceAdjustmentForm action={adjustBalanceAction} className="mt-4 grid gap-3 text-sm lg:grid-cols-[1.3fr_0.8fr_1fr_1fr_auto]">
          <select name="accountId" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none">
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} #{account.id}</option>
            ))}
          </select>
          <select name="direction" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none">
            <option value="credit">Начисление</option>
            <option value="bonus">Бонус</option>
            <option value="debit">Списание</option>
          </select>
          <input name="amountRub" type="number" min="0.01" step="0.01" placeholder="Сумма, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
          <input name="comment" placeholder="Комментарий" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
          <button className="rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 font-medium text-white">Провести</button>
        </AiBalanceAdjustmentForm>
        <p className="mt-2 text-xs text-[color:var(--bp-muted)]">
          Для ручного списания браузер попросит подтверждение перед отправкой операции.
        </p>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Аккаунты</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1280px] text-sm">
            <thead className="text-left text-[color:var(--bp-muted)]">
              <tr>
                <th className="py-2 pr-3">Аккаунт</th>
                <th className="py-2 pr-3">Доступ</th>
                <th className="py-2 pr-3">Лимиты</th>
                <th className="py-2 pr-3">AI-баланс</th>
                <th className="py-2 pr-3">Токены за месяц</th>
                <th className="py-2 pr-3">Себестоимость</th>
                <th className="py-2 pr-3">Списано</th>
                <th className="py-2 pr-3">Маржа</th>
                <th className="py-2 pr-3">Переходы</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const usage = usageMap.get(account.id);
                const cost = Number(usage?._sum.costRub ?? 0);
                const charged = Number(usage?._sum.chargedRub ?? 0);
                const access = accessByAccount.get(account.id);
                const aiEnabled = access?.aiEnabled ?? true;
                const siteAssistantEnabled = access?.siteAssistantEnabled ?? true;
                const crmAgentEnabled = access?.crmAgentEnabled ?? false;
                return (
                  <tr key={account.id} className="border-t border-[color:var(--bp-stroke)] align-top">
                    <td className="py-3 pr-3">
                      <div className="font-medium">{account.name}</div>
                      <div className="text-xs text-[color:var(--bp-muted)]">{account.slug} · #{account.id}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <form action={updateAccountAccessAction} className="grid min-w-[220px] gap-2">
                        <input type="hidden" name="accountId" value={account.id} />
                        <label className="flex items-center gap-2 text-xs">
                          <input name="aiEnabled" type="checkbox" defaultChecked={aiEnabled} />
                          AI включён
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input name="siteAssistantEnabled" type="checkbox" defaultChecked={siteAssistantEnabled} />
                          Site assistant
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input name="crmAgentEnabled" type="checkbox" defaultChecked={crmAgentEnabled} />
                          CRM-agent
                        </label>
                        <button className="w-fit rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 text-xs hover:border-[color:var(--bp-accent)]">
                          Сохранить
                        </button>
                      </form>
                    </td>
                    <td className="py-3 pr-3">
                      <form action={updateAccountAccessAction} className="grid min-w-[280px] grid-cols-2 gap-2">
                        <input type="hidden" name="accountId" value={account.id} />
                        <input type="hidden" name="aiEnabled" value={aiEnabled ? "true" : ""} />
                        <input type="hidden" name="siteAssistantEnabled" value={siteAssistantEnabled ? "true" : ""} />
                        <input type="hidden" name="crmAgentEnabled" value={crmAgentEnabled ? "true" : ""} />
                        <input name="dailySpendLimitRub" type="number" min="0" step="0.01" defaultValue={access?.dailySpendLimitRub?.toString() ?? ""} placeholder="День" className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-2 py-1 text-xs outline-none" />
                        <input name="monthlySpendLimitRub" type="number" min="0" step="0.01" defaultValue={access?.monthlySpendLimitRub?.toString() ?? ""} placeholder="Месяц" className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-2 py-1 text-xs outline-none" />
                        <input name="minBalanceNotifyRub" type="number" min="0" step="0.01" defaultValue={access?.minBalanceNotifyRub?.toString() ?? ""} placeholder="Warning" className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-2 py-1 text-xs outline-none" />
                        <input name="stopWhenBalanceBelowRub" type="number" min="0" step="0.01" defaultValue={access?.stopWhenBalanceBelowRub?.toString() ?? ""} placeholder="Stop below" className="rounded-lg border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-2 py-1 text-xs outline-none" />
                        <button className="col-span-2 w-fit rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 text-xs hover:border-[color:var(--bp-accent)]">
                          Сохранить лимиты
                        </button>
                      </form>
                    </td>
                    <td className="py-3 pr-3">{money(balances.get(account.id) ?? 0)} ₽</td>
                    <td className="py-3 pr-3">{int(usage?._sum.totalTokens ?? 0)}</td>
                    <td className="py-3 pr-3">{money(cost)} ₽</td>
                    <td className="py-3 pr-3">{money(charged)} ₽</td>
                    <td className="py-3 pr-3">{money(charged - cost)} ₽</td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Link className="rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 hover:border-[color:var(--bp-accent)]" href={`/platform/ai/accounts/${account.id}`}>детали</Link>
                        <Link className="rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 hover:border-[color:var(--bp-accent)]" href={`/platform/ai/usage?accountId=${account.id}`}>usage</Link>
                        <Link className="rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 hover:border-[color:var(--bp-accent)]" href={`/platform/ai/ledger?accountId=${account.id}`}>ledger</Link>
                        <Link className="rounded-lg border border-[color:var(--bp-stroke)] px-2 py-1 hover:border-[color:var(--bp-accent)]" href={`/platform/ai/usage?accountId=${account.id}#dialogs`}>диалоги</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
