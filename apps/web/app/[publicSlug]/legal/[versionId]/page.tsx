import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId, parsePublicSlugId } from "@/lib/public-slug";
import { generatePublicPageMetadata } from "../../_shared/seo-metadata";
import { loadPublicData } from "../../_shared/public-data";

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

  const data = await loadPublicData(resolved.publicSlug);
  const theme = data?.draft.pageThemes?.legal ?? data?.draft.theme;
  const palette =
    theme?.mode === "dark"
      ? theme.darkPalette
      : theme?.lightPalette ?? data?.draft.theme.lightPalette;
  const radius = palette?.radius ?? 16;

  return (
    <div
      className="min-h-screen px-6 py-10"
      style={{
        background: palette?.surfaceColor ?? "#f6f7f9",
        color: palette?.textColor ?? "#111827",
      }}
    >
    <div className="mx-auto max-w-3xl">
      <div className="text-sm text-[color:var(--bp-muted)]">{account.name}</div>
      <h1 className="mt-2 text-2xl font-semibold">{version.document.title}</h1>
      {version.document.description && (
        <p className="mt-2 text-sm opacity-70">
          {version.document.description}
        </p>
      )}
      <div
        className="mt-6 whitespace-pre-wrap border p-4 text-sm"
        style={{
          borderRadius: radius,
          borderColor: palette?.borderColor ?? "#e5e7eb",
          background: palette?.panelColor ?? "#ffffff",
        }}
      >
        {version.content}
      </div>
    </div>
    </div>
  );
}

