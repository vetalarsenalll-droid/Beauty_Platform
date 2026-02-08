import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type PageParams = {
  versionId: string;
};

export default async function PlatformLegalPage({
  params,
}: {
  params: Promise<PageParams> | PageParams;
}) {
  const resolvedParams = await Promise.resolve(params);
  const versionId = Number(resolvedParams.versionId);

  if (!Number.isInteger(versionId)) {
    notFound();
  }

  const version = await prisma.platformLegalDocumentVersion.findFirst({
    where: { id: versionId, isActive: true },
    include: { document: true },
  });

  if (!version) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="text-sm text-[color:var(--bp-muted)]">Платформа</div>
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
