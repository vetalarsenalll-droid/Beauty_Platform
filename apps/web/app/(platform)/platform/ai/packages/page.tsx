import { revalidatePath } from "next/cache";
import { requirePlatformPermission } from "@/lib/auth";
import {
  archiveAiAccessPackage,
  createAiAccessPackage,
  createAiProviderPool,
  getArchivedAiAccessPackages,
  getAiAccessPackages,
  getAiProviderPools,
  int,
  money,
  readCheckbox,
  readOptionalPositiveInt,
  readPositiveNumber,
  readText,
  restoreAiAccessPackage,
  updateAiAccessPackage,
} from "@/lib/ai-billing";

async function createPackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const code = readText(formData.get("code"), 64).toLowerCase();
  const name = readText(formData.get("name"), 120);
  const priceRub = readPositiveNumber(formData.get("priceRub"));
  const includedCreditRub = readPositiveNumber(formData.get("includedCreditRub"), priceRub);
  const displayTokens = readOptionalPositiveInt(formData.get("displayTokens"));
  const description = readText(formData.get("description"), 240) || null;
  if (!code || !name || priceRub <= 0 || includedCreditRub <= 0) return;
  await createAiAccessPackage({ code, name, priceRub, includedCreditRub, displayTokens, description });
  revalidatePath("/platform/ai/packages");
}

async function updatePackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const id = readOptionalPositiveInt(formData.get("id"));
  const name = readText(formData.get("name"), 120);
  const priceRub = readPositiveNumber(formData.get("priceRub"));
  const includedCreditRub = readPositiveNumber(formData.get("includedCreditRub"));
  const displayTokens = readOptionalPositiveInt(formData.get("displayTokens"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const description = readText(formData.get("description"), 240) || null;
  if (!id || !name || priceRub <= 0 || includedCreditRub <= 0) return;
  await updateAiAccessPackage({
    id,
    name,
    priceRub,
    includedCreditRub,
    displayTokens,
    sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
    isActive: readCheckbox(formData.get("isActive")),
    description,
  });
  revalidatePath("/platform/ai/packages");
  revalidatePath("/crm/assistant/billing");
}

async function archivePackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const id = readOptionalPositiveInt(formData.get("id"));
  if (!id) return;
  await archiveAiAccessPackage(id);
  revalidatePath("/platform/ai/packages");
  revalidatePath("/crm/assistant/billing");
}

async function restorePackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const id = readOptionalPositiveInt(formData.get("id"));
  if (!id) return;
  await restoreAiAccessPackage(id);
  revalidatePath("/platform/ai/packages");
  revalidatePath("/crm/assistant/billing");
}

async function createPoolAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.manage");
  const provider = readText(formData.get("provider"), 40) || "gigachat";
  const model = readText(formData.get("model"), 80) || "GigaChat";
  const packageTokens = readOptionalPositiveInt(formData.get("packageTokens")) ?? 0;
  const packageCostRub = readPositiveNumber(formData.get("packageCostRub"));
  const notes = readText(formData.get("notes"), 240) || null;
  if (packageTokens <= 0 || packageCostRub <= 0) return;
  await createAiProviderPool({ provider, model, packageTokens, packageCostRub, notes });
  revalidatePath("/platform/ai/packages");
  revalidatePath("/platform/ai");
}

export default async function PlatformAiPackagesPage() {
  await requirePlatformPermission("platform.ai.read");
  const [packages, archivedPackages, pools] = await Promise.all([
    getAiAccessPackages(false),
    getArchivedAiAccessPackages(),
    getAiProviderPools(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / GigaChat</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Пакеты и пул провайдера</h1>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
          Пул провайдера описывает закупку у Сбера. Пакеты AI-доступа описывают, что покупают бизнес-аккаунты у платформы.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Добавить AI-пакет</h2>
          <form action={createPackageAction} className="mt-4 grid gap-3 text-sm">
            <input name="code" placeholder="code, например ai_start" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <input name="name" placeholder="Название пакета" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="priceRub" type="number" min="1" step="0.01" placeholder="Цена для салона, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="includedCreditRub" type="number" min="1" step="0.01" placeholder="AI-баланс к начислению, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            </div>
            <input name="displayTokens" type="number" min="1" step="1" placeholder="Витринные токены, необязательно" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <textarea name="description" placeholder="Описание" className="min-h-20 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <button className="w-fit rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Создать пакет</button>
          </form>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Добавить закупку GigaChat</h2>
          <form action={createPoolAction} className="mt-4 grid gap-3 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <input name="provider" defaultValue="gigachat" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="model" defaultValue={process.env.GIGACHAT_MODEL || "GigaChat"} className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="packageTokens" type="number" min="1" step="1" placeholder="Куплено токенов у Сбера" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="packageCostRub" type="number" min="1" step="0.01" placeholder="Стоимость закупки, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            </div>
            <textarea name="notes" placeholder="Комментарий" className="min-h-20 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <button className="w-fit rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Сохранить пул</button>
          </form>
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">AI-пакеты для бизнес-аккаунтов</h2>
        <div className="mt-4 grid gap-3">
          {packages.map((pack) => (
            <form key={pack.id} action={updatePackageAction} className="grid gap-3 rounded-2xl border border-[color:var(--bp-stroke)] p-4 text-sm xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.4fr_0.5fr_auto]">
              <input type="hidden" name="id" value={pack.id} />
              <label className="grid gap-1">
                <span className="text-xs text-[color:var(--bp-muted)]">{pack.code}</span>
                <input name="name" defaultValue={pack.name} className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              </label>
              <input name="priceRub" type="number" min="1" step="0.01" defaultValue={pack.priceRub.toString()} className="self-end rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="includedCreditRub" type="number" min="1" step="0.01" defaultValue={pack.includedCreditRub.toString()} className="self-end rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="displayTokens" type="number" min="1" step="1" defaultValue={pack.displayTokens ?? ""} placeholder="tokens" className="self-end rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="sortOrder" type="number" step="1" defaultValue={pack.sortOrder} className="self-end rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <label className="flex items-center gap-2 self-end pb-2 text-xs">
                <input name="isActive" type="checkbox" defaultChecked={pack.isActive} />
                активен
              </label>
              <div className="flex items-end gap-2">
                <button className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:border-[color:var(--bp-accent)]">Сохранить</button>
                <button
                  form={`archive-ai-package-${pack.id}`}
                  className="rounded-xl border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:border-rose-400"
                >
                  Архив
                </button>
              </div>
              <textarea name="description" defaultValue={pack.description ?? ""} placeholder="Описание" className="xl:col-span-7 min-h-16 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            </form>
          ))}
          {packages.map((pack) => (
            <form key={`archive-${pack.id}`} id={`archive-ai-package-${pack.id}`} action={archivePackageAction}>
              <input type="hidden" name="id" value={pack.id} />
            </form>
          ))}
          {!packages.length ? <div className="text-sm text-[color:var(--bp-muted)]">Пакеты пока не созданы.</div> : null}
        </div>
      </section>

      {archivedPackages.length ? (
        <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Архив AI-пакетов</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-[color:var(--bp-muted)]">
                <tr>
                  <th className="py-2 pr-3">Пакет</th>
                  <th className="py-2 pr-3">Цена</th>
                  <th className="py-2 pr-3">AI-баланс</th>
                  <th className="py-2 pr-3">Архивирован</th>
                  <th className="py-2 pr-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {archivedPackages.map((pack) => (
                  <tr key={pack.id} className="border-t border-[color:var(--bp-stroke)]">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{pack.name}</div>
                      <div className="text-xs text-[color:var(--bp-muted)]">{pack.code} · #{pack.id}</div>
                    </td>
                    <td className="py-2 pr-3">{money(pack.priceRub)} ₽</td>
                    <td className="py-2 pr-3">{money(pack.includedCreditRub)} ₽</td>
                    <td className="py-2 pr-3">{pack.archivedAt?.toLocaleString("ru-RU") ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <form action={restorePackageAction}>
                        <input type="hidden" name="id" value={pack.id} />
                        <button className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-1.5 text-xs hover:border-[color:var(--bp-accent)]">
                          Вернуть
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Закупки GigaChat</h2>
        <div className="mt-4 grid gap-3">
          {pools.map((pool) => (
            <div key={pool.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4 text-sm">
              <div className="font-medium">{pool.provider} / {pool.model}</div>
              <div className="mt-1 text-[color:var(--bp-muted)]">
                {int(pool.packageTokens)} токенов за {money(pool.packageCostRub)} ₽. Себестоимость 1 млн токенов: {money((Number(pool.packageCostRub) / Math.max(1, pool.packageTokens)) * 1_000_000)} ₽.
              </div>
            </div>
          ))}
          {!pools.length ? <div className="text-sm text-[color:var(--bp-muted)]">Пулы пока не добавлены. До этого используются значения из `.env`.</div> : null}
        </div>
      </section>
    </div>
  );
}
