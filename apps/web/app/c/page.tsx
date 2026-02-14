import type { CSSProperties, ReactNode } from "react";
import { requireClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import {
  renderPublicMenuFrame,
  type PublicMenuFrame,
} from "@/app/[publicSlug]/_shared/menu-render";
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
  let menuNode: ReactNode = null;
  let themeFrame: PublicMenuFrame | null = null;
  let clientPageData: Record<string, unknown> | null = null;

  if (accountSlug) {
    const account = await prisma.account.findUnique({
      where: { slug: accountSlug },
      select: { id: true, slug: true },
    });
    if (account) {
      const publicSlug = buildPublicSlugId(account.slug, account.id);
      themeFrame = await renderPublicMenuFrame(publicSlug, `/c?account=${account.slug}`);
      menuNode = themeFrame?.menuNode ?? null;
      clientPageData =
        themeFrame?.clientPageBlock &&
        typeof themeFrame.clientPageBlock.data === "object" &&
        themeFrame.clientPageBlock.data
          ? (themeFrame.clientPageBlock.data as Record<string, unknown>)
          : null;
    }
  }

  const clientTitle = (clientPageData?.title as string) || "Личный кабинет";
  const clientSalonsTitle = (clientPageData?.salonsTitle as string) || "Ваши салоны";
  const clientEmptyText =
    (clientPageData?.emptyText as string) || "Пока нет салонов, где вы записывались.";

  const pageStyle = themeFrame
    ? ({
        ...themeFrame.themeStyle,
        backgroundColor: "var(--site-surface)",
        backgroundImage: "var(--site-gradient)",
        color: "var(--site-text)",
        fontFamily: "var(--site-font-body)",
        "--bp-paper": "var(--site-client-card-bg)",
        "--bp-panel": "var(--site-client-card-bg)",
        "--bp-surface": "var(--site-surface)",
        "--bp-stroke": "var(--site-border)",
        "--bp-ink": "var(--site-text)",
        "--bp-muted": "var(--site-muted)",
        "--bp-accent": "var(--site-client-button)",
        "--bp-accent-strong": "var(--site-client-button)",
        "--site-button-text": "var(--site-client-button-text)",
        "--bp-shadow":
          "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)",
      } as CSSProperties)
    : undefined;

  return (
    <main
      id={themeFrame ? "public-site-root" : undefined}
      data-site-theme={themeFrame?.initialMode}
      className="min-h-screen pb-16"
      style={pageStyle}
    >
      <div
        className="mx-auto flex w-full flex-col px-6 py-12"
        style={themeFrame ? { gap: themeFrame.blockGap } : undefined}
      >
        {menuNode}
        <section
          className="mx-auto flex w-full flex-col gap-6 rounded-[var(--site-radius)] border border-[color:var(--site-border)] bg-[color:var(--site-client-card-bg)] px-6 py-10 md:px-8"
          style={{
            maxWidth: "var(--site-client-content-width)",
            boxShadow:
              "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{clientTitle}</h1>
            <LogoutButton accountSlug={accountSlug} />
          </div>
          <div className="text-[color:var(--bp-muted)]">{displayName}</div>

          {session.clients.length > 0 ? (
            <div className="rounded-3xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
              <div className="text-sm font-semibold">{clientSalonsTitle}</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {session.clients.map((client) => {
                  const name = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
                  const label =
                    name || client.phone || client.email || `Клиент #${client.clientId}`;
                  return (
                    <a
                      key={client.clientId}
                      href={`/c?account=${client.accountSlug}`}
                      className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--site-client-card-bg)] px-4 py-3 text-sm transition hover:-translate-y-[1px] hover:shadow-sm"
                    >
                      <div className="font-semibold">{client.accountName}</div>
                      <div className="text-xs text-[color:var(--bp-muted)]">{label}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[color:var(--bp-muted)]">{clientEmptyText}</div>
          )}
        </section>
      </div>
    </main>
  );
}
