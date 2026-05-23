import { revalidatePath } from "next/cache";
import { requirePlatformPermission } from "@/lib/auth";
import { readText } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";

const SETTING_KEYS = [
  { key: "gigachat.model", label: "GigaChat model", env: process.env.GIGACHAT_MODEL ?? "" },
  { key: "gigachat.packageTokens", label: "GigaChat package tokens", env: process.env.GIGACHAT_PACKAGE_TOKENS ?? "" },
  { key: "gigachat.packageRub", label: "GigaChat package cost, RUB", env: process.env.GIGACHAT_PACKAGE_RUB ?? "" },
  { key: "ai.balanceEnforcement", label: "AI balance enforcement", env: process.env.AI_BALANCE_ENFORCEMENT ?? "" },
  { key: "aisha.systemPrompt", label: "Global Aisha system prompt", env: "" },
] as const;

async function saveSettingsAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.manage");

  for (const item of SETTING_KEYS) {
    const value = readText(formData.get(item.key), 4000);
    const existing = await prisma.aiSetting.findFirst({
      where: { accountId: null, key: item.key },
      select: { id: true },
      orderBy: { id: "desc" },
    });
    if (existing) {
      await prisma.aiSetting.update({ where: { id: existing.id }, data: { value } });
    } else if (value) {
      await prisma.aiSetting.create({ data: { accountId: null, key: item.key, value } });
    }
  }

  revalidatePath("/platform/ai/settings");
}

export default async function PlatformAiSettingsPage() {
  await requirePlatformPermission("platform.ai.read");

  const rows = await prisma.aiSetting.findMany({
    where: { accountId: null, key: { in: SETTING_KEYS.map((item) => item.key) } },
    orderBy: { id: "desc" },
  });
  const values = new Map(rows.map((row) => [row.key, String(row.value ?? "")]));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / GigaChat</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Глобальные AI-настройки</h1>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
          Несекретные настройки можно переносить сюда из env. Секретный GIGACHAT_AUTH_KEY остаётся только в env.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <form action={saveSettingsAction} className="grid gap-4">
          {SETTING_KEYS.map((item) => {
            const current = values.get(item.key) ?? "";
            const isPrompt = item.key.includes("Prompt");
            return (
              <label key={item.key} className="grid gap-2 text-sm">
                <span className="font-medium">{item.label}</span>
                {isPrompt ? (
                  <textarea
                    name={item.key}
                    defaultValue={current}
                    placeholder={item.env ? `env: ${item.env}` : undefined}
                    className="min-h-32 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none"
                  />
                ) : (
                  <input
                    name={item.key}
                    defaultValue={current}
                    placeholder={item.env ? `env: ${item.env}` : undefined}
                    className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none"
                  />
                )}
              </label>
            );
          })}
          <button className="w-fit rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">
            Сохранить
          </button>
        </form>
      </section>
    </div>
  );
}
