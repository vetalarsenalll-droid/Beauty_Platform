import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";
import PublicPageApprove from "./public-page-approve";

export default async function PlatformModerationPage() {
  await requirePlatformPermission("platform.moderation");

  const pages = await prisma.publicPage.findMany({
    where: { status: "DRAFT" },
    include: { account: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Модерация
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Публичные страницы к публикации
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Черновики публичных профилей, ожидающие публикации.
        </p>
      </header>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Очередь модерации</h2>
        {pages.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Нет черновиков для публикации.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {pages.map((page) => (
              <div
                key={page.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold">
                    {page.account.name}
                  </div>
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    {page.account.slug} · обновлено {page.updatedAt.toLocaleString()}
                  </div>
                </div>
                <PublicPageApprove pageId={page.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
