import { cookies } from "next/headers";
import type { CSSProperties, ReactNode } from "react";
import {
  resolveSiteLoaderConfig,
  type SiteBlock,
  type SiteLoaderConfig,
} from "@/lib/site-builder";
import { loadPublicData } from "./public-data";
import { buildBlockWrapperStyle, normalizeStyle, renderBlock } from "./public-render";

export type PublicMenuFrame = {
  initialMode: "light" | "dark";
  blockGap: number;
  themeStyle: Record<string, string>;
  menuNode: ReactNode;
  clientPageBlock: SiteBlock | null;
  loaderConfig: SiteLoaderConfig | null;
};

export async function renderPublicMenuFrame(
  publicSlug: string,
  accountLinkOverride?: string | null
) {
  const data = await loadPublicData(publicSlug);
  if (!data) return null;
  const loaderConfig = resolveSiteLoaderConfig(data.draft);

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
    "--site-radius-light": `${data.draft.theme.lightPalette.radius}px`,
    "--site-radius-dark": `${data.draft.theme.darkPalette.radius}px`,
    "--site-button-radius-light": `${data.draft.theme.lightPalette.buttonRadius}px`,
    "--site-button-radius-dark": `${data.draft.theme.darkPalette.buttonRadius}px`,
    "--site-gap": `${palette.blockSpacing}px`,
    "--site-edge-pad": "clamp(0px, 2vw, 16px)",
    "--site-h1": `${palette.headingSize}px`,
    "--site-h2": `${palette.subheadingSize}px`,
    "--site-text-size": `${palette.textSize}px`,
    "--site-client-content-width": `${contentWidth}px`,
    "--site-client-auth-width": `${palette.clientAuthWidth}px`,
    "--site-client-card-bg": palette.clientCardBg,
    "--site-client-button": palette.clientButtonColor,
    "--site-client-button-text": palette.clientButtonTextColor,
    "--site-client-card-bg-light": data.draft.theme.lightPalette.clientCardBg,
    "--site-client-card-bg-dark": data.draft.theme.darkPalette.clientCardBg,
    "--site-client-button-light": data.draft.theme.lightPalette.clientButtonColor,
    "--site-client-button-dark": data.draft.theme.darkPalette.clientButtonColor,
    "--site-client-button-text-light": data.draft.theme.lightPalette.clientButtonTextColor,
    "--site-client-button-text-dark": data.draft.theme.darkPalette.clientButtonTextColor,
    "--site-gradient": mainGradient,
  };
  const blockGap = palette.blockSpacing ?? 0;

  const style = normalizeStyle(menuBlock, themeForRender);
  const clientPageBlock = (data.draft.pages?.client ?? [])[0] ?? null;
  if (clientPageBlock) {
    const clientStyle = normalizeStyle(clientPageBlock, themeForRender);
    const clientBgLight = clientStyle.blockBgLightResolved || data.draft.theme.lightPalette.clientCardBg;
    const clientBgDark = clientStyle.blockBgDarkResolved || data.draft.theme.darkPalette.clientCardBg;
    const clientButtonLight =
      clientStyle.buttonColorLightResolved || data.draft.theme.lightPalette.clientButtonColor;
    const clientButtonDark =
      clientStyle.buttonColorDarkResolved || data.draft.theme.darkPalette.clientButtonColor;
    const clientButtonTextLight =
      clientStyle.buttonTextColorLightResolved ||
      data.draft.theme.lightPalette.clientButtonTextColor;
    const clientButtonTextDark =
      clientStyle.buttonTextColorDarkResolved ||
      data.draft.theme.darkPalette.clientButtonTextColor;
    const clientBg =
      themeForRender.mode === "dark"
        ? clientBgDark
        : clientBgLight;
    const clientButton =
      themeForRender.mode === "dark"
        ? clientButtonDark
        : clientButtonLight;
    const clientButtonText =
      themeForRender.mode === "dark"
        ? clientButtonTextDark
        : clientButtonTextLight;
    if (clientStyle.useCustomWidth && clientStyle.blockWidth) {
      themeStyle["--site-client-content-width"] = `${clientStyle.blockWidth}px`;
    }
    if (clientBg) {
      themeStyle["--site-client-card-bg"] = clientBg;
    }
    if (clientButton) {
      themeStyle["--site-client-button"] = clientButton;
    }
    if (clientButtonText) {
      themeStyle["--site-client-button-text"] = clientButtonText;
    }
    if (Number.isFinite(clientStyle.radius)) {
      themeStyle["--site-radius"] = `${clientStyle.radius}px`;
      themeStyle["--site-radius-light"] = `${clientStyle.radius}px`;
      themeStyle["--site-radius-dark"] = `${clientStyle.radius}px`;
    }
    if (Number.isFinite(clientStyle.buttonRadius)) {
      themeStyle["--site-button-radius"] = `${clientStyle.buttonRadius}px`;
      themeStyle["--site-button-radius-light"] = `${clientStyle.buttonRadius}px`;
      themeStyle["--site-button-radius-dark"] = `${clientStyle.buttonRadius}px`;
    }
    themeStyle["--site-client-card-bg-light"] = clientBgLight;
    themeStyle["--site-client-card-bg-dark"] = clientBgDark;
    themeStyle["--site-client-button-light"] = clientButtonLight;
    themeStyle["--site-client-button-dark"] = clientButtonDark;
    themeStyle["--site-client-button-text-light"] = clientButtonTextLight;
    themeStyle["--site-client-button-text-dark"] = clientButtonTextDark;
  }
  const menuPosition =
    typeof (menuBlock.data as { position?: string })?.position === "string"
      ? (menuBlock.data as { position?: string }).position
      : null;
  const isMenuSticky = menuBlock.type === "menu" && menuPosition === "sticky";
  const blockWidth =
    typeof style.blockWidth === "number" ? style.blockWidth : contentWidth;
  const wrapper = buildBlockWrapperStyle(style, themeForRender, blockWidth, {
    isMenuSticky,
    blockType: menuBlock.type,
  });

  return {
    initialMode,
    blockGap,
    themeStyle,
    clientPageBlock,
    loaderConfig,
    menuNode: (
      <section className={wrapper.className} style={wrapper.style as CSSProperties}>
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
          themeForRender,
          accountLinkOverride ?? undefined
        )}
      </section>
    ),
  } satisfies PublicMenuFrame;
}

export async function renderPublicMenu(
  publicSlug: string,
  accountLinkOverride?: string | null
) {
  const frame = await renderPublicMenuFrame(publicSlug, accountLinkOverride);
  if (!frame) return null;

  return (
    <div
      id="public-site-root"
      data-site-theme={frame.initialMode}
      className="flex w-full flex-col pt-0 pb-12"
      style={{
        ...frame.themeStyle,
        backgroundColor: "var(--site-surface)",
        backgroundImage: "var(--site-gradient)",
        color: "var(--site-text)",
        fontFamily: "var(--site-font-body)",
        gap: frame.blockGap,
      }}
    >
      {frame.menuNode}
    </div>
  );
}



