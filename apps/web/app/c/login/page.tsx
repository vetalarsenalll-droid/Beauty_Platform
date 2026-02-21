import type { CSSProperties, ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import {
  renderPublicMenuFrame,
  type PublicMenuFrame,
} from "@/app/[publicSlug]/_shared/menu-render";
import ClientLoginPage from "./login-client";

type PageProps = {
  searchParams?: Promise<{ account?: string }> | { account?: string };
};

export default async function ClientLoginPageWrapper({ searchParams }: PageProps) {
  const resolved = await Promise.resolve(searchParams ?? {});
  let accountSlug = resolved?.account?.trim();
  if (!accountSlug) {
    const fallbackAccount = await prisma.account.findFirst({
      orderBy: { id: "asc" },
      select: { slug: true },
    });
    accountSlug = fallbackAccount?.slug ?? undefined;
  }

  let menuNode: ReactNode = null;
  let themeFrame: PublicMenuFrame | null = null;
  if (accountSlug) {
    const account = await prisma.account.findUnique({
      where: { slug: accountSlug },
      select: { id: true, slug: true },
    });
    if (account) {
      const publicSlug = buildPublicSlugId(account.slug, account.id);
      themeFrame = await renderPublicMenuFrame(
        publicSlug,
        `/c/login?account=${account.slug}`
      );
      menuNode = themeFrame?.menuNode ?? null;
    }
  }

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
        className="flex w-full flex-col pt-0 pb-12"
        style={themeFrame ? { gap: themeFrame.blockGap } : undefined}
      >
        {menuNode}
        <ClientLoginPage initialAccountSlug={accountSlug ?? ""} />
      </div>
    </main>
  );
}
