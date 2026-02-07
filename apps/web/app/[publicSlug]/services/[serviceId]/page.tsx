import { notFound } from "next/navigation";

import { loadPublicData } from "../../_shared/public-data";
import { normalizeStyle, renderBlock } from "../../_shared/public-render";

type PageProps = {
  params: Promise<{ publicSlug?: string; serviceId?: string }>;
};

export default async function PublicServicePage({ params }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";
  const serviceId = Number(resolvedParams.serviceId);
  if (!Number.isInteger(serviceId)) return notFound();

  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();

  if (!data.services.some((item) => item.id === serviceId)) return notFound();

  const homeBlocks = data.draft.pages?.home ?? data.draft.blocks;
  const menuBlock = homeBlocks.find((block) => block.type === "menu") ?? null;
  const entityBlocks =
    data.draft.entityPages?.services?.[String(serviceId)] ?? null;
  const pageBlocks = entityBlocks ?? [];
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
    "--site-surface": data.draft.theme.surfaceColor,
    "--site-panel": data.draft.theme.panelColor,
    "--site-text": data.draft.theme.textColor,
    "--site-muted": data.draft.theme.mutedColor,
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
    "--site-gradient": mainGradient,
  };

  return (
    <main
      id="public-site-root"
      data-site-theme={data.draft.theme.mode}
      className="min-h-screen pb-16"
      style={{
        ...themeStyle,
        backgroundColor: "var(--site-surface)",
        backgroundImage: "var(--site-gradient)",
        color: "var(--site-text)",
        fontFamily: "var(--site-font-body)",
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
            typeof style.shadowSize === "number" ? style.shadowSize : null;
          const blockShadowColor =
            typeof style.shadowColor === "string" && style.shadowColor
              ? style.shadowColor
              : null;
          const radius =
            typeof style.radius === "number" ? style.radius : "var(--site-radius)";
          const bg =
            typeof style.blockBg === "string" && style.blockBg
              ? style.blockBg
              : "var(--bp-panel)";
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
          const borderColorOverride =
            typeof style.borderColor === "string" && style.borderColor
              ? style.borderColor
              : null;
          const borderColor = borderColorOverride ?? "var(--bp-stroke)";
          const textColor =
            typeof style.textColor === "string" && style.textColor
              ? style.textColor
              : "var(--bp-ink)";
          const mutedColor =
            typeof style.mutedColor === "string" && style.mutedColor
              ? style.mutedColor
              : "var(--bp-muted)";
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
                  blockShadowSize !== null
                    ? `0 ${blockShadowSize}px ${blockShadowSize * 2}px ${blockShadowColor ?? "var(--site-shadow-color)"}`
                    : "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)",
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
                ...(borderColorOverride
                  ? {
                      ["--bp-stroke" as string]: borderColorOverride,
                      ["--site-border" as string]: borderColorOverride,
                    }
                  : {}),
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
                { type: "service", id: serviceId },
                data.draft.theme
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
