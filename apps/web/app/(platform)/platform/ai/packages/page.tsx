import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requirePlatformPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  archiveAiAccessPackage,
  createAiAccessPackage,
  deleteUnusedAiAccessPackage,
  getArchivedAiAccessPackages,
  getAiAccessPackages,
  int,
  money,
  readCheckbox,
  readOptionalPositiveInt,
  readPositiveNumber,
  readText,
  restoreAiAccessPackage,
  updateAiAccessPackage,
} from "@/lib/ai-billing";

function pricePerMillion(priceRub: unknown, tokens: unknown) {
  const price = Number(priceRub ?? 0);
  const tokenCount = Number(tokens ?? 0);
  return price > 0 && tokenCount > 0 ? (price / tokenCount) * 1_000_000 : 0;
}

async function createPackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const code = `ai_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const name = readText(formData.get("name"), 120);
  const priceRub = readPositiveNumber(formData.get("priceRub"));
  const displayTokens = readOptionalPositiveInt(formData.get("displayTokens"));
  const description = readText(formData.get("description"), 240) || null;
  if (!code || !name || priceRub <= 0 || !displayTokens) return;
  await createAiAccessPackage({ code, name, priceRub, includedCreditRub: priceRub, displayTokens, description });
  revalidatePath("/platform/ai/packages");
  revalidatePath("/crm/assistant/site");
}

function LabeledInput({
  label,
  name,
  type,
  step,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  step: string;
  defaultValue: string | number;
}) {
  return (
    <label className="grid gap-1 self-end">
      <span className="text-xs text-[color:var(--bp-muted)]">{label}</span>
      <input name={name} type={type} min="1" step={step} defaultValue={defaultValue} className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
    </label>
  );
}

async function updatePackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const id = readOptionalPositiveInt(formData.get("id"));
  const name = readText(formData.get("name"), 120);
  const priceRub = readPositiveNumber(formData.get("priceRub"));
  const displayTokens = readOptionalPositiveInt(formData.get("displayTokens"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const description = readText(formData.get("description"), 240) || null;
  if (!id || !name || priceRub <= 0 || !displayTokens) return;
  await updateAiAccessPackage({
    id,
    name,
    priceRub,
    includedCreditRub: priceRub,
    displayTokens,
    sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
    isActive: readCheckbox(formData.get("isActive")),
    description,
  });
  revalidatePath("/platform/ai/packages");
  revalidatePath("/crm/assistant/billing");
  revalidatePath("/crm/assistant/site");
}

async function archivePackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const id = readOptionalPositiveInt(formData.get("id"));
  if (!id) return;
  await archiveAiAccessPackage(id);
  revalidatePath("/platform/ai/packages");
  revalidatePath("/crm/assistant/billing");
  revalidatePath("/crm/assistant/site");
}

async function deletePackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const id = readOptionalPositiveInt(formData.get("id"));
  if (!id) return;
  await deleteUnusedAiAccessPackage(id);
  revalidatePath("/platform/ai/packages");
  revalidatePath("/crm/assistant/site");
}

async function restorePackageAction(formData: FormData) {
  "use server";
  await requirePlatformPermission("platform.ai.packages.manage");
  const id = readOptionalPositiveInt(formData.get("id"));
  if (!id) return;
  await restoreAiAccessPackage(id);
  revalidatePath("/platform/ai/packages");
  revalidatePath("/crm/assistant/billing");
  revalidatePath("/crm/assistant/site");
}

export default async function PlatformAiPackagesPage() {
  await requirePlatformPermission("platform.ai.read");
  const [packages, archivedPackages, purchaseCountRows] = await Promise.all([
    getAiAccessPackages(false),
    getArchivedAiAccessPackages(),
    prisma.$queryRaw<Array<{ packageId: number | null; count: bigint | number }>>`
      SELECT "packageId", COUNT(*) AS "count"
      FROM "AiAccessPurchase"
      WHERE "packageId" IS NOT NULL
      GROUP BY "packageId"
    `,
  ]);
  const purchaseCountByPackageId = new Map(
    purchaseCountRows
      .filter((row) => row.packageId != null)
      .map((row) => [row.packageId as number, Number(row.count)] as const),
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">AI / GigaChat</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Пакеты AI и учет GigaChat</h1>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--bp-muted)]">
          Здесь настраивается только то, что покупает бизнес-аккаунт внутри платформы. Реальные токены GigaChat покупаются и отображаются в кабинете Сбера.
        </p>
      </header>

      <section className="grid gap-4">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Добавить пакет для аккаунтов</h2>
          <form action={createPackageAction} className="mt-4 grid gap-3 text-sm">
            <input name="name" placeholder="Название пакета" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="priceRub" type="number" min="1" step="0.01" placeholder="Цена пакета, ₽" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <input name="displayTokens" type="number" min="1" step="1" placeholder="Токенов в пакете" className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            </div>
            <textarea name="description" placeholder="Описание" className="min-h-20 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            <button className="w-fit rounded-xl bg-[color:var(--bp-accent)] px-4 py-2 text-sm font-medium text-white">Создать пакет</button>
          </form>
        </article>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">AI-пакеты для бизнес-аккаунтов</h2>
        <div className="mt-4 grid gap-3">
          {packages.map((pack) => (
            <form key={pack.id} action={updatePackageAction} className="grid gap-3 rounded-2xl border border-[color:var(--bp-stroke)] p-4 text-sm xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.5fr_auto]">
              <input type="hidden" name="id" value={pack.id} />
              <label className="grid gap-1">
                <span className="text-xs text-[color:var(--bp-muted)]">Пакет #{pack.id}</span>
                <input name="name" defaultValue={pack.name} className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              </label>
              <LabeledInput label="Цена пакета, ₽" name="priceRub" type="number" step="0.01" defaultValue={pack.priceRub.toString()} />
              <LabeledInput label="Токенов" name="displayTokens" type="number" step="1" defaultValue={pack.displayTokens ?? ""} />
              <div className="self-end rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2">
                <div className="text-xs text-[color:var(--bp-muted)]">Цена 1 млн токенов</div>
                <div className="font-medium">{money(pricePerMillion(pack.priceRub, pack.displayTokens))} ₽</div>
              </div>
              <input name="sortOrder" type="number" step="1" defaultValue={pack.sortOrder} className="self-end rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
              <label className="flex items-center gap-2 self-end pb-2 text-xs">
                <input name="isActive" type="checkbox" defaultChecked={pack.isActive} />
                активен
              </label>
              <div className="flex items-end gap-2">
                <button className="rounded-xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm hover:border-[color:var(--bp-accent)]">Сохранить</button>
                {purchaseCountByPackageId.get(pack.id) ? (
                  <button
                    form={`archive-ai-package-${pack.id}`}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:border-rose-400"
                  >
                    Архив
                  </button>
                ) : (
                  <button
                    form={`delete-ai-package-${pack.id}`}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-sm text-rose-700 hover:border-rose-400"
                  >
                    Удалить
                  </button>
                )}
              </div>
              <textarea name="description" defaultValue={pack.description ?? ""} placeholder="Описание" className="xl:col-span-6 min-h-16 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] px-3 py-2 outline-none" />
            </form>
          ))}
          {packages.map((pack) => (
            <form key={`archive-${pack.id}`} id={`archive-ai-package-${pack.id}`} action={archivePackageAction}>
              <input type="hidden" name="id" value={pack.id} />
            </form>
          ))}
          {packages.map((pack) => (
            <form key={`delete-${pack.id}`} id={`delete-ai-package-${pack.id}`} action={deletePackageAction}>
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
                  <th className="py-2 pr-3">Токены</th>
                  <th className="py-2 pr-3">Цена 1 млн</th>
                  <th className="py-2 pr-3">Архивирован</th>
                  <th className="py-2 pr-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {archivedPackages.map((pack) => (
                  <tr key={pack.id} className="border-t border-[color:var(--bp-stroke)]">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{pack.name}</div>
                      <div className="text-xs text-[color:var(--bp-muted)]">Пакет #{pack.id}</div>
                    </td>
                    <td className="py-2 pr-3">{money(pack.priceRub)} ₽</td>
                    <td className="py-2 pr-3">{pack.displayTokens ? int(pack.displayTokens) : "—"}</td>
                    <td className="py-2 pr-3">{money(pricePerMillion(pack.priceRub, pack.displayTokens))} ₽</td>
                    <td className="py-2 pr-3">{pack.archivedAt?.toLocaleString("ru-RU") ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <form action={restorePackageAction}>
                          <input type="hidden" name="id" value={pack.id} />
                          <button className="rounded-xl border border-[color:var(--bp-stroke)] px-3 py-1.5 text-xs hover:border-[color:var(--bp-accent)]">
                            Вернуть
                          </button>
                        </form>
                        {!purchaseCountByPackageId.get(pack.id) ? (
                          <form action={deletePackageAction}>
                            <input type="hidden" name="id" value={pack.id} />
                            <button className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs text-rose-700 hover:border-rose-400">
                              Удалить
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
