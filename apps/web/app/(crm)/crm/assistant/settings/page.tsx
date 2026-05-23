import { revalidatePath } from "next/cache";
import { requireCrmPermission } from "@/lib/auth";
import {
  getAiAccountAccessByAccountIds,
  readCheckbox,
  readOptionalNumber,
  readText,
  updateAiAccountAccess,
} from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

async function saveAccessAction(formData: FormData) {
  "use server";
  const session = await requireCrmPermission("crm.assistant.manage");
  await updateAiAccountAccess({
    accountId: session.accountId,
    aiEnabled: readCheckbox(formData.get("aiEnabled")),
    siteAssistantEnabled: readCheckbox(formData.get("siteAssistantEnabled")),
    crmAgentEnabled: readCheckbox(formData.get("crmAgentEnabled")),
    dailySpendLimitRub: readOptionalNumber(formData.get("dailySpendLimitRub")),
    monthlySpendLimitRub: readOptionalNumber(formData.get("monthlySpendLimitRub")),
    minBalanceNotifyRub: readOptionalNumber(formData.get("minBalanceNotifyRub")),
    stopWhenBalanceBelowRub: readOptionalNumber(formData.get("stopWhenBalanceBelowRub")),
  });
  revalidatePath("/crm/assistant/settings");
}

async function savePromptAction(formData: FormData) {
  "use server";
  const session = await requireCrmPermission("crm.assistant.manage");
  const prompt = readText(formData.get("prompt"), 4000);
  const existing = await prisma.aiSetting.findFirst({
    where: { accountId: session.accountId, key: "aisha.systemPrompt" },
    select: { id: true },
    orderBy: { id: "desc" },
  });
  if (existing) {
    await prisma.aiSetting.update({ where: { id: existing.id }, data: { value: prompt } });
  } else if (prompt) {
    await prisma.aiSetting.create({ data: { accountId: session.accountId, key: "aisha.systemPrompt", value: prompt } });
  }
  revalidatePath("/crm/assistant/settings");
}

export default async function CrmAssistantSettingsPage() {
  const session = await requireCrmPermission("crm.assistant.read");
  const access = (await getAiAccountAccessByAccountIds([session.accountId])).get(session.accountId);
  const promptSetting = await prisma.aiSetting.findFirst({
    where: { accountId: session.accountId, key: "aisha.systemPrompt" },
    orderBy: { id: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Ассистент</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Настройки AI</h1>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Доступ и лимиты</h2>
        <form action={saveAccessAction} className="mt-4 grid gap-4 text-sm">
          <div className="grid gap-2 md:grid-cols-3">
            <label className="flex items-center gap-2"><input name="aiEnabled" type="checkbox" defaultChecked={access?.aiEnabled ?? true} /> AI включён</label>
            <label className="flex items-center gap-2"><input name="siteAssistantEnabled" type="checkbox" defaultChecked={access?.siteAssistantEnabled ?? true} /> Ассистент сайта</label>
            <label className="flex items-center gap-2"><input name="crmAgentEnabled" type="checkbox" defaultChecked={access?.crmAgentEnabled ?? false} /> CRM-agent</label>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input name="dailySpendLimitRub" type="number" min="0" step="0.01" defaultValue={access?.dailySpendLimitRub?.toString() ?? ""} placeholder="Лимит в день, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <input name="monthlySpendLimitRub" type="number" min="0" step="0.01" defaultValue={access?.monthlySpendLimitRub?.toString() ?? ""} placeholder="Лимит в месяц, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <input name="minBalanceNotifyRub" type="number" min="0" step="0.01" defaultValue={access?.minBalanceNotifyRub?.toString() ?? ""} placeholder="Порог предупреждения, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <input name="stopWhenBalanceBelowRub" type="number" min="0" step="0.01" defaultValue={access?.stopWhenBalanceBelowRub?.toString() ?? ""} placeholder="Остановить ниже, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
          </div>
          <button className="w-fit rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Сохранить</button>
        </form>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Prompt Aisha</h2>
        <form action={savePromptAction} className="mt-4 grid gap-3 text-sm">
          <textarea
            name="prompt"
            defaultValue={String(promptSetting?.value ?? "")}
            className="min-h-40 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none"
          />
          <button className="w-fit rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Сохранить prompt</button>
        </form>
      </section>
    </div>
  );
}
