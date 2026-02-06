import { notFound } from "next/navigation";

import { loadPublicData } from "../../_shared/public-data";
import { renderBlock } from "../../_shared/public-render";

type PageProps = {
  params: Promise<{ publicSlug?: string; specialistId?: string }>;
};

export default async function PublicSpecialistPage({ params }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";
  const specialistId = Number(resolvedParams.specialistId);
  if (!Number.isInteger(specialistId)) return notFound();

  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();

  if (!data.specialists.some((item) => item.id === specialistId)) return notFound();

  const blocks = data.draft.pages?.specialists ?? data.draft.blocks;
  const themeStyle: Record<string, string> = {
    "--bp-accent": data.draft.theme.accentColor,
    "--bp-surface": data.draft.theme.surfaceColor,
    "--bp-panel": data.draft.theme.panelColor,
    "--bp-ink": data.draft.theme.textColor,
    "--bp-muted": data.draft.theme.mutedColor,
    "--site-font-heading": data.draft.theme.fontHeading,
    "--site-font-body": data.draft.theme.fontBody,
  };

  return (
    <main
      className="min-h-screen pb-16"
      style={{
        ...themeStyle,
        backgroundColor: data.draft.theme.surfaceColor,
        color: data.draft.theme.textColor,
        fontFamily: data.draft.theme.fontBody,
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
        {blocks.map((block) => (
          <section
            key={block.id}
            className="border border-[color:var(--bp-stroke)] p-8 shadow-[var(--bp-shadow-soft)]"
            style={{
              borderRadius: data.draft.theme.radius,
              backgroundColor: data.draft.theme.panelColor,
            }}
          >
            {renderBlock(
              block,
              data.account.name,
              publicSlug,
              data.branding,
              data.accountProfile,
              data.locations,
              data.services,
              data.specialists,
              data.promos,
              data.workPhotos,
              { type: "specialist", id: specialistId }
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
