import type { CSSProperties, ReactNode } from "react";
import type {
  SiteBlock,
  SiteLoaderConfig,
  SitePageKey,
  SiteTheme,
} from "@/lib/site-builder";
import type { PublicSiteData } from "@/features/site-builder/shared/site-data";
import {
  buildBlockWrapperStyle,
  normalizeStyle,
  renderBlock,
  type CurrentEntity,
} from "./public-render";
import { resolveCoverBackgroundVisual } from "@/features/site-builder/shared/background-visuals";

type PublicPageShellLayout = {
  rootTag?: "main" | "div";
  rootClassName?: string;
  useInnerColumn?: boolean;
  innerClassName?: string;
};

type RenderPublicPageShellParams = {
  data: PublicSiteData;
  pageKey: SitePageKey;
  publicSlug: string;
  accountLinkOverride?: string | null;
  currentEntity?: CurrentEntity;
  loaderConfig?: SiteLoaderConfig | null;
  includeCoverBackground?: boolean;
  layout?: PublicPageShellLayout;
};

const resolveBlocksForPage = (
  data: PublicSiteData,
  pageKey: SitePageKey,
  currentEntity: CurrentEntity
) => {
  const entityPageKey =
    currentEntity?.type === "location"
      ? "locations"
      : currentEntity?.type === "service"
        ? "services"
        : currentEntity?.type === "specialist"
          ? "specialists"
          : currentEntity?.type === "promo"
            ? "promos"
            : null;
  const homeBlocks = data.draft.pages?.home ?? data.draft.blocks;
  const menuBlock = homeBlocks.find((block) => block.type === "menu") ?? null;
  const shouldShowSharedMenu =
    menuBlock &&
    (menuBlock.data as { showOnAllPages?: boolean }).showOnAllPages !== false;
  const sharedMenuBlock = pageKey === "home" || !shouldShowSharedMenu ? null : menuBlock;
  const entityId = currentEntity ? String(currentEntity.id) : null;
  const entityBlocks = entityId && entityPageKey
    ? data.draft.entityPages?.[entityPageKey]?.[entityId] ?? null
    : null;
  const pageBlocks: SiteBlock[] =
    pageKey === "home"
      ? homeBlocks
      : entityBlocks ?? data.draft.pages?.[pageKey] ?? data.draft.blocks;

  return sharedMenuBlock
    ? [
        sharedMenuBlock,
        ...pageBlocks.filter(
          (block) =>
            block.type !== "menu" &&
            block.type !== "loader" &&
            block.type !== "aisha"
        ),
      ]
    : pageBlocks.filter(
        (block) => block.type !== "loader" && block.type !== "aisha"
      );
};

const buildThemeStyle = (
  palette: SiteTheme["lightPalette"] | SiteTheme["darkPalette"]
) => {
  const shadowSize = palette.shadowSize ?? 0;
  const shadowColor = palette.shadowColor || "rgba(17, 24, 39, 0.12)";
  const mainGradient = palette.gradientEnabled
    ? `linear-gradient(${palette.gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${palette.gradientFrom}, ${palette.gradientTo})`
    : "none";
  const globalBorderColor = palette.borderColor?.trim() || "transparent";

  return {
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
  } satisfies Record<string, string>;
};

export function renderPublicPageShell({
  data,
  pageKey,
  publicSlug,
  accountLinkOverride,
  currentEntity = null,
  loaderConfig = null,
  includeCoverBackground = false,
  layout,
}: RenderPublicPageShellParams): ReactNode {
  const globalTheme = data.draft.theme;
  const pageTheme = pageKey === "home" ? null : data.draft.pageThemes?.[pageKey];
  const baseTheme = pageTheme
    ? {
        ...globalTheme,
        ...pageTheme,
        lightPalette: { ...globalTheme.lightPalette, ...pageTheme.lightPalette },
        darkPalette: { ...globalTheme.darkPalette, ...pageTheme.darkPalette },
      }
    : globalTheme;
  const initialMode = globalTheme.mode;
  const palette =
    initialMode === "dark" ? baseTheme.darkPalette : baseTheme.lightPalette;
  const themeForRender = { ...baseTheme, mode: initialMode };
  const blockGap = palette.blockSpacing ?? 0;
  const contentWidthRaw = palette.contentWidth ?? 1120;
  const contentWidth = Number.isFinite(Number(contentWidthRaw))
    ? Number(contentWidthRaw)
    : 1120;
  const blocks = resolveBlocksForPage(data, pageKey, currentEntity);
  const themeStyle = buildThemeStyle(palette);
  const content = blocks.map((block) => {
    let style = normalizeStyle(block, themeForRender);
    if (block.type === "menu") {
      const menuData = (block.data ?? {}) as Record<string, unknown>;
      const readColor = (key: string) => {
        const value = menuData[key];
        return typeof value === "string" ? value.trim() : "";
      };
      const menuBlockLight = readColor("menuBlockBackgroundFrom");
      const menuBlockDark = readColor("menuBlockBackgroundFromDark");
      const menuSectionLight = readColor("menuSectionBackgroundFrom");
      const menuSectionDark = readColor("menuSectionBackgroundFromDark");
      style = {
        ...style,
        blockBgLightResolved: menuBlockLight || style.blockBgLightResolved,
        blockBgDarkResolved: menuBlockDark || style.blockBgDarkResolved,
        sectionBgLightResolved: menuSectionLight || style.sectionBgLightResolved,
        sectionBgDarkResolved: menuSectionDark || style.sectionBgDarkResolved,
      };
    }
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
      coverBackground:
        includeCoverBackground && block.type === "cover"
          ? resolveCoverBackgroundVisual(
              (block.data ?? null) as Record<string, unknown> | null,
              (themeForRender.mode === "dark"
                ? style.sectionBgDarkResolved
                : style.sectionBgLightResolved) || palette.panelColor
            )
          : undefined,
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
      <section key={block.id} className={wrapperClassName} style={wrapperStyle}>
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
          currentEntity,
          themeForRender,
          accountLinkOverride ?? undefined,
          loaderConfig
        )}
      </section>
    );
  });

  const RootTag = layout?.rootTag ?? "main";
  const rootClassName =
    layout?.rootClassName ?? "flex min-h-screen w-full flex-col pb-0";
  const useInnerColumn = layout?.useInnerColumn ?? false;
  const innerClassName = layout?.innerClassName ?? "flex w-full flex-col pt-0 pb-0";
  const rootStyle: CSSProperties = {
    ...themeStyle,
    backgroundColor: "var(--site-surface)",
    backgroundImage: "var(--site-gradient)",
    color: "var(--site-text)",
    fontFamily: "var(--site-font-body)",
    gap: blockGap,
  };

  return (
    <RootTag id="public-site-root" data-site-theme={initialMode} className={rootClassName} style={rootStyle}>
      {useInnerColumn ? (
        <div className={innerClassName} style={{ gap: blockGap }}>
          {content}
        </div>
      ) : (
        content
      )}
    </RootTag>
  );
}
