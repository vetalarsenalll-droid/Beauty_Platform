import { cookies } from "next/headers";
import { loadPublicData } from "./public-data";
import { buildBlockWrapperStyle, normalizeStyle, renderBlock } from "./public-render";

export async function renderPublicMenu(
  publicSlug: string,
  accountLinkOverride?: string | null
) {
  const data = await loadPublicData(publicSlug);
  if (!data) return null;

  const homeBlocks = data.draft.pages?.home ?? data.draft.blocks;
  const menuBlock = homeBlocks.find((block) => block.type === "menu") ?? null;
  if (!menuBlock) return null;

  const cookieStore = await cookies();
  const storedMode = cookieStore.get?.("site-theme-mode")?.value;
  const initialMode =
    storedMode === "dark" || storedMode === "light"
      ? storedMode
      : data.draft.theme.mode;
  const palette =
    initialMode === "dark"
      ? data.draft.theme.darkPalette
      : data.draft.theme.lightPalette;
  const themeForRender = { ...data.draft.theme, mode: initialMode };
  const shadowSize = palette.shadowSize ?? 0;
  const shadowColor = palette.shadowColor || "rgba(17, 24, 39, 0.12)";
  const mainGradient = palette.gradientEnabled
    ? `linear-gradient(${palette.gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${palette.gradientFrom}, ${palette.gradientTo})`
    : "none";
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

  const style = normalizeStyle(menuBlock, themeForRender);
  const menuPosition =
    typeof (menuBlock.data as { position?: string })?.position === "string"
      ? (menuBlock.data as { position?: string }).position
      : null;
  const isMenuSticky = menuBlock.type === "menu" && menuPosition === "sticky";
  const blockWidth =
    typeof style.blockWidth === "number" ? style.blockWidth : contentWidth;
  const wrapper = buildBlockWrapperStyle(style, themeForRender, blockWidth, {
    isMenuSticky,
  });

  return (
    <div
      className="w-full"
      style={{
        ...themeStyle,
        backgroundColor: "var(--site-surface)",
        backgroundImage: "var(--site-gradient)",
        color: "var(--site-text)",
        fontFamily: "var(--site-font-body)",
      }}
    >
      <div className="mx-auto flex w-full flex-col px-6 py-6">
        <section className={wrapper.className} style={wrapper.style}>
          {renderBlock(
            menuBlock,
            data.account.name,
            data.account.slug,
            data.publicSlug,
            data.branding,
            data.accountProfile,
            data.locations,
            data.services,
            data.specialists,
            data.promos,
            data.workPhotos,
            null,
            data.draft.theme,
            accountLinkOverride ?? null
          )}
        </section>
      </div>
    </div>
  );
}
