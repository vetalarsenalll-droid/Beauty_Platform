import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId, parsePublicSlugId } from "@/lib/public-slug";

type PageParams = {
  publicSlug: string;
  versionId: string;
};

export default async function PublicLegalPage({
  params,
}: {
  params: Promise<PageParams> | PageParams;
}) {
  const resolved = await Promise.resolve(params);
  const parsed = parsePublicSlugId(resolved.publicSlug);
  const versionId = Number(resolved.versionId);

  if (!parsed || !Number.isInteger(versionId)) {
    notFound();
  }

  const account = await prisma.account.findUnique({
    where: { id: parsed.id },
    select: { id: true, name: true, slug: true },
  });

  if (!account) {
    notFound();
  }

  const canonicalSlug = buildPublicSlugId(account.slug, account.id);
  if (canonicalSlug !== resolved.publicSlug) {
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

  return (
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
  );
}

