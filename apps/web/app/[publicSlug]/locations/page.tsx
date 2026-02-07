import { notFound } from "next/navigation";

import { loadPublicData } from "../_shared/public-data";
import { normalizeStyle, renderBlock } from "../_shared/public-render";

type PageProps = {
  params: Promise<{ publicSlug?: string }>;
};

export default async function PublicLocationsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";

  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();

  const homeBlocks = data.draft.pages?.home ?? data.draft.blocks;
  const menuBlock = homeBlocks.find((block) => block.type === "menu") ?? null;
  const pageBlocks = data.draft.pages?.locations ?? data.draft.blocks;
  const blocks = menuBlock
    ? [menuBlock, ...pageBlocks.filter((block) => block.type !== "menu")]
    : pageBlocks;
  const shadowSize = data.draft.theme.shadowSize ?? 0;
  const shadowColor = data.draft.theme.shadowColor || "rgba(17, 24, 39, 0.12)";
  const mainGradient = data.draft.theme.gradientEnabled
    ? `linear-gradient(${data.draft.theme.gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${data.draft.theme.gradientFrom}, ${data.draft.theme.gradientTo})`
    : "none";
  const blockGap = data.draft.theme.blockSpacing ?? 0;
  const contentWidthRaw = data.draft.theme.contentWidth ?? 1120;
  const contentWidth = Number.isFinite(Number(contentWidthRaw))
    ? Number(contentWidthRaw)
    : 1120;
  const themeStyle: Record<string, string> = {
    "--bp-accent": data.draft.theme.accentColor,
    "--bp-surface": data.draft.theme.surfaceColor,
    "--bp-panel": data.draft.theme.panelColor,
    "--bp-ink": data.draft.theme.textColor,
    "--bp-muted": data.draft.theme.mutedColor,
    "--bp-stroke": data.draft.theme.borderColor,
    "--site-font-heading": data.draft.theme.fontHeading,
    "--site-font-body": data.draft.theme.fontBody,
    "--site-border": data.draft.theme.borderColor,
    "--site-button": data.draft.theme.buttonColor,
    "--site-button-text": data.draft.theme.buttonTextColor,
    "--site-shadow-color": shadowColor,
    "--site-shadow-size": `${shadowSize}px`,
    "--site-radius": `${data.draft.theme.radius}px`,
    "--site-button-radius": `${data.draft.theme.buttonRadius}px`,
    "--site-gap": `${data.draft.theme.blockSpacing}px`,
    "--site-h1": `${data.draft.theme.headingSize}px`,
    "--site-h2": `${data.draft.theme.subheadingSize}px`,
    "--site-text-size": `${data.draft.theme.textSize}px`,
  };

  return (
    <main
      className="min-h-screen pb-16"
      style={{
        ...themeStyle,
        backgroundColor: data.draft.theme.gradientEnabled
          ? data.draft.theme.gradientFrom
          : data.draft.theme.surfaceColor,
        backgroundImage: mainGradient,
        color: data.draft.theme.textColor,
        fontFamily: data.draft.theme.fontBody,
      }}
    >
      <div className="mx-auto flex w-full flex-col px-6 py-12" style={{ gap: blockGap }}>
        {blocks.map((block) => {
          const style = normalizeStyle(block);
          const menuPosition =
            typeof (block.data as { position?: string })?.position === "string"
              ? (block.data as { position?: string }).position
              : null;
          const isMenuSticky = block.type === "menu" && menuPosition === "sticky";
          const blockShadowSize =
            typeof style.shadowSize === "number"
              ? style.shadowSize
              : shadowSize;
          const blockShadowColor =
            typeof style.shadowColor === "string" && style.shadowColor
              ? style.shadowColor
              : shadowColor;
          const radius =
            typeof style.radius === "number" ? style.radius : data.draft.theme.radius;
          const bg =
            typeof style.blockBg === "string" && style.blockBg
              ? style.blockBg
              : data.draft.theme.panelColor;
          const gradientEnabled = Boolean(style.gradientEnabled);
          const gradientDirection =
            style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
              ? style.gradientDirection
              : data.draft.theme.gradientDirection;
          const gradientFrom =
            typeof style.gradientFrom === "string" && style.gradientFrom
              ? style.gradientFrom
              : data.draft.theme.gradientFrom;
          const gradientTo =
            typeof style.gradientTo === "string" && style.gradientTo
              ? style.gradientTo
              : data.draft.theme.gradientTo;
          const borderColor =
            typeof style.borderColor === "string" && style.borderColor
              ? style.borderColor
              : data.draft.theme.borderColor;
          const textColor =
            typeof style.textColor === "string" && style.textColor
              ? style.textColor
              : data.draft.theme.textColor;
          const mutedColor =
            typeof style.mutedColor === "string" && style.mutedColor
              ? style.mutedColor
              : data.draft.theme.mutedColor;
          const blockWidth =
            typeof style.blockWidth === "number" ? style.blockWidth : contentWidth;
          return (
            <section
              key={block.id}
              className="border border-[color:var(--bp-stroke)] p-8"
              style={{
                position: isMenuSticky ? "sticky" : undefined,
                top: isMenuSticky ? 0 : undefined,
                zIndex: isMenuSticky ? 40 : undefined,
                borderRadius: radius,
                backgroundColor: gradientEnabled ? gradientFrom : bg,
                backgroundImage: gradientEnabled
                  ? `linear-gradient(${gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${gradientFrom}, ${gradientTo})`
                  : "none",
                borderColor,
                boxShadow:
                  blockShadowSize > 0
                    ? `0 ${blockShadowSize}px ${blockShadowSize * 2}px ${blockShadowColor}`
                    : "none",
                marginTop: typeof style.marginTop === "number" ? style.marginTop : 0,
                marginBottom:
                  typeof style.marginBottom === "number" ? style.marginBottom : 0,
                width: "100%",
                maxWidth: blockWidth,
                marginLeft: "auto",
                marginRight: "auto",
                boxSizing: "border-box",
                color: textColor,
                ["--bp-muted" as string]: mutedColor,
                ["--bp-stroke" as string]: borderColor,
                ["--site-border" as string]: borderColor,
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
                null
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
