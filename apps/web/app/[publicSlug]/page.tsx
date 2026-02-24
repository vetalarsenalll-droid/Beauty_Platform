import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { cookies } from "next/headers";

import { loadPublicData } from "./_shared/public-data";
import { buildBlockWrapperStyle, normalizeStyle, renderBlock } from "./_shared/public-render";

type PageProps = {
  params: Promise<{ publicSlug?: string }>;
};

export default async function PublicAccountPage({ params }: PageProps) {
  const resolvedParams = await params;
  const publicSlug = resolvedParams.publicSlug ?? "";
  const data = await loadPublicData(publicSlug);
  if (!data) return notFound();
  const clientSession = await getClientSession();
  const accountLinkOverride = clientSession
    ? `/c?account=${data.account.slug}`
    : `/c/login?account=${data.account.slug}`;


  const homeBlocks = data.draft.pages?.home ?? data.draft.blocks;
  const menuBlock = homeBlocks.find((block) => block.type === "menu") ?? null;
  const blocks = menuBlock
    ? [menuBlock, ...homeBlocks.filter((block) => block.type !== "menu" && block.type !== "loader")]
    : homeBlocks.filter((block) => block.type !== "loader");
  const cookieStore = await cookies();
  const storedMode = cookieStore.get?.("site-theme-mode")?.value;
  const baseTheme = data.draft.pageThemes?.home ?? data.draft.theme;
  const initialMode =
    storedMode === "dark" || storedMode === "light" ? storedMode : baseTheme.mode;
  const palette =
    initialMode === "dark" ? baseTheme.darkPalette : baseTheme.lightPalette;
  const themeForRender = { ...baseTheme, mode: initialMode };
  const shadowSize = palette.shadowSize ?? 0;
  const shadowColor = palette.shadowColor || "rgba(17, 24, 39, 0.12)";
  const mainGradient = palette.gradientEnabled
    ? `linear-gradient(${palette.gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${palette.gradientFrom}, ${palette.gradientTo})`
    : "none";
  const blockGap = palette.blockSpacing ?? 0;
  const contentWidthRaw = palette.contentWidth ?? 1120;
  const contentWidth = Number.isFinite(Number(contentWidthRaw))
    ? Number(contentWidthRaw)
    : 1120;
  const globalBorderColor = palette.borderColor?.trim() || "transparent";
  const themeStyle: Record<string, string> = {
    "--bp-accent": palette.accentColor,
    "--bp-surface": palette.surfaceColor,
    "--bp-panel": palette.panelColor,
    "--bp-ink": palette.textColor,
    "--bp-muted": palette.mutedColor,
    "--bp-stroke": globalBorderColor,
    "--site-surface": palette.surfaceColor,
    "--site-panel": palette.panelColor,
    "--site-text": palette.textColor,
    "--site-muted": palette.mutedColor,
    "--site-font-heading": palette.fontHeading,
    "--site-font-body": palette.fontBody,
    "--site-border": globalBorderColor,
    "--site-button": palette.buttonColor,
    "--site-button-text": palette.buttonTextColor,
    "--site-shadow-color": shadowColor,
    "--site-shadow-size": `${shadowSize}px`,
    "--site-radius": `${palette.radius}px`,
    "--site-button-radius": `${palette.buttonRadius}px`,
    "--site-gap": `${palette.blockSpacing}px`,
    "--site-edge-pad": "clamp(0px, 2vw, 16px)",
    "--site-h1": `${palette.headingSize}px`,
    "--site-h2": `${palette.subheadingSize}px`,
    "--site-text-size": `${palette.textSize}px`,
    "--site-gradient": mainGradient,
  };

  return (
    <main
      id="public-site-root"
      data-site-theme={initialMode}
      className="min-h-screen pb-0"
      style={{
        ...themeStyle,
        backgroundColor: "var(--site-surface)",
        backgroundImage: "var(--site-gradient)",
        color: "var(--site-text)",
        fontFamily: "var(--site-font-body)",
      }}
    >
      <div className="flex w-full flex-col pt-0 pb-0" style={{ gap: blockGap }}>
        {blocks.map((block, index) => {
        const style = normalizeStyle(block, themeForRender);
        const menuPosition =
          typeof (block.data as { position?: string })?.position === "string"
            ? (block.data as { position?: string }).position
            : null;
        const isMenuSticky = block.type === "menu" && menuPosition === "sticky";
        const blockWidth =
          typeof style.blockWidth === "number" ? style.blockWidth : contentWidth;
        const wrapper = buildBlockWrapperStyle(style, themeForRender, blockWidth, {
          isMenuSticky,
          blockType: block.type,
        });
        const isBooking = block.type === "booking";
        const wrapperClassName = `${wrapper.className}${isBooking ? " site-block-booking" : ""}`;
        const wrapperStyle = isBooking
          ? {
              ...wrapper.style,
              borderColor: "transparent",
              backgroundColor: "transparent",
              boxShadow: "none",
            }
          : wrapper.style;
          return (
            <section
              key={block.id}
              className={wrapperClassName}
              style={wrapperStyle}
            >
              {renderBlock(
                block,
                data.account.name,
                data.account.slug,
                publicSlug,
                data.branding,
                data.accountProfile,
                data.locations,
                data.services,
                data.specialists,
                data.promos,
                data.workPhotos,
                null,
                themeForRender,
                accountLinkOverride
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

