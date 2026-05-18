import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveSiteLoaderConfig } from "@/lib/site-builder";
import { buildPublicSlugId, parsePublicSlugId } from "@/lib/public-slug";
import { generatePublicPageMetadata } from "../../_shared/seo-metadata";
import { loadPublicData } from "../../_shared/public-data";
import { renderPublicPageShell } from "../../_shared/public-page-shell";

type PageParams = {
  publicSlug: string;
  versionId: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const resolved = await params;
  return generatePublicPageMetadata(
    resolved.publicSlug ?? "",
    `legal:${resolved.versionId ?? ""}`
  );
}

export default async function PublicLegalPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const resolved = await params;
  const parsed = parsePublicSlugId(resolved.publicSlug);
  const versionId = Number(resolved.versionId);

  if (!parsed || !Number.isInteger(versionId)) {
    notFound();
  }

  const account = await prisma.account.findUnique({
    where: { id: parsed.id },
    select: { id: true, slug: true },
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
    select: { id: true },
  });

  if (!version) {
    notFound();
  }

  const data = await loadPublicData(resolved.publicSlug);
  if (!data) {
    notFound();
  }

  return renderPublicPageShell({
    data,
    pageKey: "legal",
    publicSlug: resolved.publicSlug,
    currentEntity: { type: "legalDocument", id: version.id },
    loaderConfig: resolveSiteLoaderConfig(data.draft),
  });
}
