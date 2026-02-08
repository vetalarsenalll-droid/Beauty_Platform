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
    ? [menuBlock, ...homeBlocks.filter((block) => block.type !== "menu")]
    : homeBlocks;
  const cookieStore = await cookies();
  const storedMode = cookieStore.get?.("site-theme-mode")?.value;
  const initialMode =
    storedMode === "dark" || storedMode === "light" ? storedMode : data.draft.theme.mode;
  const palette =
    initialMode === "dark" ? data.draft.theme.darkPalette : data.draft.theme.lightPalette;
  const themeForRender = { ...data.draft.theme, mode: initialMode };
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
  const themeStyle: Record<string, string> = {
    "--bp-accent": palette.accentColor,
    "--bp-surface": palette.surfaceColor,
    "--bp-panel": palette.panelColor,
    "--bp-ink": palette.textColor,
    "--bp-muted": palette.mutedColor,
    "--bp-stroke": palette.borderColor,
    "--site-surface": palette.surfaceColor,
    "--site-panel": palette.panelColor,
    "--site-text": palette.textColor,
    "--site-muted": palette.mutedColor,
    "--site-font-heading": palette.fontHeading,
    "--site-font-body": palette.fontBody,
    "--site-border": palette.borderColor,
    "--site-button": palette.buttonColor,
    "--site-button-text": palette.buttonTextColor,
    "--site-shadow-color": shadowColor,
    "--site-shadow-size": `${shadowSize}px`,
    "--site-radius": `${palette.radius}px`,
    "--site-button-radius": `${palette.buttonRadius}px`,
    "--site-gap": `${palette.blockSpacing}px`,
    "--site-h1": `${palette.headingSize}px`,
    "--site-h2": `${palette.subheadingSize}px`,
    "--site-text-size": `${palette.textSize}px`,
    "--site-gradient": mainGradient,
  };

  return (
    <main
      id="public-site-root"
      data-site-theme={initialMode}
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
          });
          const isBooking = block.type === "booking";
          const wrapperClassName = `${wrapper.className}${isBooking ? " site-block-booking" : ""}`;
          const shouldCollapseGap = isBooking && index > 0 && (style.marginTop ?? 0) === 0;
          const wrapperStyle = isBooking
            ? {
                ...wrapper.style,
                padding: 0,
                borderColor: "transparent",
                backgroundColor: "transparent",
                boxShadow: "none",
                marginTop: shouldCollapseGap ? -(blockGap ?? 0) : wrapper.style.marginTop,
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









