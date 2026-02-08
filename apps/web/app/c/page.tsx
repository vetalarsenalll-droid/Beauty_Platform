import { requireClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { renderPublicMenu } from "@/app/[publicSlug]/_shared/menu-render";
import LogoutButton from "./logout-button";

type ClientHomeProps = {
  searchParams?: Promise<{ account?: string }> | { account?: string };
};

export default async function ClientHome({ searchParams }: ClientHomeProps) {
  const session = await requireClientSession();
  const resolvedParams = await Promise.resolve(searchParams ?? {});
  const accountSlugParam = resolvedParams?.account?.trim();

  const primaryClient = session.clients[0] ?? null;
  const fullName = `${primaryClient?.firstName ?? ""} ${primaryClient?.lastName ?? ""}`.trim();
  const displayName =
    fullName ||
    primaryClient?.phone ||
    primaryClient?.email ||
    session.email ||
    "Клиент";

  const accountSlug = accountSlugParam || primaryClient?.accountSlug || null;
  let menuNode: JSX.Element | null = null;
  if (accountSlug) {
    const account = await prisma.account.findUnique({
      where: { slug: accountSlug },
      select: { id: true, slug: true },
    });
    if (account) {
      const publicSlug = buildPublicSlugId(account.slug, account.id);
      menuNode = await renderPublicMenu(
        publicSlug,
        `/c?account=${account.slug}`
      );
    }
  }

  return (
    <>
      {menuNode}
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {"Личный кабинет"}
        </h1>
        <LogoutButton />
      </div>
      <div className="text-[color:var(--bp-muted)]">{displayName}</div>
      {session.clients.length > 0 ? (
        <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
          <div className="text-sm font-semibold">{"Ваши салоны"}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {session.clients.map((client) => {
              const name = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
              const label =
                name ||
                client.phone ||
                client.email ||
                `Клиент #${client.clientId}`;
              return (
                <a
                  key={client.clientId}
                  href={`/c?account=${client.accountSlug}`}
                  className="rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm transition hover:-translate-y-[1px] hover:shadow-sm"
                >
                  <div className="font-semibold">{client.accountName}</div>
                  <div className="text-xs text-[color:var(--bp-muted)]">{label}</div>
                </a>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-sm text-[color:var(--bp-muted)]">
          {"Пока нет салонов, где вы записывались."}
        </div>
      )}
      </main>
    </>
  );
}
