import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import { renderPublicMenu } from "@/app/[publicSlug]/_shared/menu-render";
import ClientRegisterPage from "./register-client";

type PageProps = {
  searchParams?: Promise<{ account?: string }> | { account?: string };
};

export default async function ClientRegisterPageWrapper({ searchParams }: PageProps) {
  const resolved = await Promise.resolve(searchParams ?? {});
  const accountSlug = resolved?.account?.trim();

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
        `/c/register?account=${account.slug}`
      );
    }
  }

  return (
    <>
      {menuNode}
      <ClientRegisterPage />
    </>
  );
}
