import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/auth";
import { buildPublicSlugId } from "@/lib/public-slug";
import { renderPublicMenu } from "@/app/[publicSlug]/_shared/menu-render";

type PageParams = {
  versionId: string;
};

type PageSearch = {
  account?: string;
};

export default async function BookingLegalPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams> | PageParams;
  searchParams?: Promise<PageSearch> | PageSearch;
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearch = await Promise.resolve(searchParams);
  const versionId = Number(resolvedParams.versionId);
  const accountSlug = resolvedSearch?.account;

  if (!Number.isInteger(versionId) || !accountSlug) {
    notFound();
  }

  const account = await prisma.account.findUnique({
    where: { slug: accountSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!account) {
    notFound();
  }

  const version = await prisma.legalDocumentVersion.findFirst({
    where: {
      id: versionId,
      isActive: true,
      document: { accountId: account.id },
    },
    include: { document: true },
  });

  if (!version) {
    notFound();
  }

  const publicSlug = buildPublicSlugId(account.slug, account.id);
  const clientSession = await getClientSession();
  const accountLinkOverride = clientSession
    ? `/c?account=${account.slug}`
    : `/c/login?account=${account.slug}`;
  const menuNode = await renderPublicMenu(publicSlug, accountLinkOverride);

  return (
    <div className="w-full">
      {menuNode}
      <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="text-sm text-[color:var(--bp-muted)]">{account.name}</div>
      <h1 className="mt-2 text-2xl font-semibold">{version.document.title}</h1>
      {version.document.description && (
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          {version.document.description}
        </p>
      )}
      <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4 text-sm text-[color:var(--bp-ink)]">
        {version.content}
      </div>
    </div>
    </div>
  );
}
