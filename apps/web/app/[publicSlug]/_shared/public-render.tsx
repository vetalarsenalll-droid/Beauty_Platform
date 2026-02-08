import Link from "next/link";
import { buildBookingLink } from "@/lib/booking-links";
import MenuSearch from "@/components/menu-search";
import SiteThemeToggle from "@/components/site-theme-toggle";
import type { CSSProperties } from "react";
import type { SiteBlock, SiteTheme } from "@/lib/site-builder";
import type {
  AccountProfile,
  Branding,
  LocationItem,
  PromoItem,
  ServiceItem,
  SpecialistItem,
  WorkPhotos,
} from "./public-data";

export type CurrentEntity =
  | { type: "location" | "service" | "specialist" | "promo"; id: number }
  | null;

const PAGE_LABELS = {
  home: "Главная",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  promos: "Промо/скидки",
} as const;

type PageKey = keyof typeof PAGE_LABELS;

const SOCIAL_ICONS: Record<string, string> = {
  website: "/assets/socials/website.png",
  instagram: "/assets/socials/instagram.png",
  whatsapp: "/assets/socials/whatsapp.png",
  telegram: "/assets/socials/telegram.png",
  max: "/assets/socials/max.png",
  vk: "/assets/socials/vk.png",
  viber: "/assets/socials/viber.png",
  pinterest: "/assets/socials/pinterest.png",
  facebook: "/assets/socials/Facebook_black.png",
  tiktok: "/assets/socials/TikTok_black.png",
  youtube: "/assets/socials/YouTube_black.png",
  twitter: "/assets/socials/Twitter_black.png",
  dzen: "/assets/socials/Dzen_black.png",
  ok: "/assets/socials/Ok_black.png",
};

const SOCIAL_LABELS: Record<string, string> = {
  website: "Сайт",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  max: "MAX",
  vk: "VK",
  viber: "Viber",
  pinterest: "Pinterest",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "Twitter",
  dzen: "Дзен",
  ok: "Одноклассники",
};

type BlockStyle = {
  marginTop?: number;
  marginBottom?: number;
  blockWidth?: number | null;
  useCustomWidth?: boolean;
  radius?: number | null;
  buttonRadius?: number | null;
  blockBg?: string;
  blockBgLight?: string;
  blockBgDark?: string;
  borderColor?: string;
  borderColorLight?: string;
  borderColorDark?: string;
  buttonColor?: string;
  buttonColorLight?: string;
  buttonColorDark?: string;
  buttonTextColor?: string;
  buttonTextColorLight?: string;
  buttonTextColorDark?: string;
  textColor?: string;
  textColorLight?: string;
  textColorDark?: string;
  mutedColor?: string;
  mutedColorLight?: string;
  mutedColorDark?: string;
  shadowColor?: string;
  shadowSize?: number | null;
  gradientEnabled?: boolean;
  gradientDirection?: "vertical" | "horizontal";
  gradientFrom?: string;
  gradientTo?: string;
  textAlign?: "left" | "center" | "right";
  fontHeading?: string;
  fontBody?: string;
  headingSize?: number | null;
  subheadingSize?: number | null;
  textSize?: number | null;
  blockBgLightResolved?: string;
  blockBgDarkResolved?: string;
  borderColorLightResolved?: string;
  borderColorDarkResolved?: string;
  buttonColorLightResolved?: string;
  buttonColorDarkResolved?: string;
  buttonTextColorLightResolved?: string;
  buttonTextColorDarkResolved?: string;
  textColorLightResolved?: string;
  textColorDarkResolved?: string;
  mutedColorLightResolved?: string;
  mutedColorDarkResolved?: string;
  gradientEnabledLight?: boolean;
  gradientEnabledDark?: boolean;
  gradientFromLightResolved?: string;
  gradientToLightResolved?: string;
  gradientFromDarkResolved?: string;
  gradientToDarkResolved?: string;
  gradientDirectionLight?: "vertical" | "horizontal";
  gradientDirectionDark?: "vertical" | "horizontal";
};

export function normalizeStyle(block: SiteBlock, theme: SiteTheme): BlockStyle {
  const style = (block.data.style as Record<string, unknown>) ?? {};
  const numOrNull = (value?: number | string | null) => {
    const parsed =
      typeof value === "string" ? Number(value) : (value as number | null | undefined);
    return Number.isFinite(parsed) ? (parsed as number) : null;
  };
  const readColor = (key: string) =>
    typeof style[key] === "string" ? (style[key] as string) : "";
  const resolveColor = (lightKey: string, darkKey: string, legacyKey: string) => {
    const light = readColor(lightKey) || readColor(legacyKey);
    const dark = readColor(darkKey);
    return theme.mode === "dark" ? dark || "" : light || "";
  };
  const resolvePair = (
    lightKey: string,
    darkKey: string,
    legacyKey: string,
    lightFallback: string,
    darkFallback: string
  ) => {
    const lightRaw = readColor(lightKey) || readColor(legacyKey);
    const darkRaw = readColor(darkKey);
    const lightResolved =
      lightRaw.toLowerCase() === "transparent" ? "transparent" : lightRaw || lightFallback;
    const darkResolved =
      darkRaw.toLowerCase() === "transparent" ? "transparent" : darkRaw || darkFallback;
    return { lightResolved, darkResolved };
  };
  const useCustomWidth = style.useCustomWidth === true;
  const blockBgPair = resolvePair(
    "blockBgLight",
    "blockBgDark",
    "blockBg",
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
  );
  const borderPair = resolvePair(
    "borderColorLight",
    "borderColorDark",
    "borderColor",
    theme.lightPalette.borderColor,
    theme.darkPalette.borderColor
  );
  const buttonPair = resolvePair(
    "buttonColorLight",
    "buttonColorDark",
    "buttonColor",
    theme.lightPalette.buttonColor,
    theme.darkPalette.buttonColor
  );
  const buttonTextPair = resolvePair(
    "buttonTextColorLight",
    "buttonTextColorDark",
    "buttonTextColor",
    theme.lightPalette.buttonTextColor,
    theme.darkPalette.buttonTextColor
  );
  const textPair = resolvePair(
    "textColorLight",
    "textColorDark",
    "textColor",
    theme.lightPalette.textColor,
    theme.darkPalette.textColor
  );
  const mutedPair = resolvePair(
    "mutedColorLight",
    "mutedColorDark",
    "mutedColor",
    theme.lightPalette.mutedColor,
    theme.darkPalette.mutedColor
  );
  const gradientEnabledLight =
    typeof style.gradientEnabledLight === "boolean"
      ? (style.gradientEnabledLight as boolean)
      : Boolean(style.gradientEnabled);
  const gradientEnabledDark =
    typeof style.gradientEnabledDark === "boolean"
      ? (style.gradientEnabledDark as boolean)
      : false;
  const gradientDirectionLight =
    style.gradientDirectionLight === "horizontal" || style.gradientDirectionLight === "vertical"
      ? (style.gradientDirectionLight as "horizontal" | "vertical")
      : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
        ? (style.gradientDirection as "horizontal" | "vertical")
        : "vertical";
  const gradientDirectionDark =
    style.gradientDirectionDark === "horizontal" || style.gradientDirectionDark === "vertical"
      ? (style.gradientDirectionDark as "horizontal" | "vertical")
      : "vertical";
  const gradientFromLightResolved =
    (style.gradientFromLight as string) ||
    (style.gradientFrom as string) ||
    theme.lightPalette.gradientFrom;
  const gradientToLightResolved =
    (style.gradientToLight as string) ||
    (style.gradientTo as string) ||
    theme.lightPalette.gradientTo;
  const gradientFromDarkResolved =
    (style.gradientFromDark as string) || theme.darkPalette.gradientFrom;
  const gradientToDarkResolved =
    (style.gradientToDark as string) || theme.darkPalette.gradientTo;

  return {
    marginTop: Number.isFinite(style.marginTop as number)
      ? (style.marginTop as number)
      : 0,
    marginBottom: Number.isFinite(style.marginBottom as number)
      ? (style.marginBottom as number)
      : 0,
    blockWidth: useCustomWidth ? numOrNull(style.blockWidth as number) : null,
    useCustomWidth,
    radius: numOrNull(style.radius as number),
    buttonRadius: numOrNull(style.buttonRadius as number),
    blockBg: resolveColor("blockBgLight", "blockBgDark", "blockBg"),
    borderColor: resolveColor("borderColorLight", "borderColorDark", "borderColor"),
    buttonColor: resolveColor("buttonColorLight", "buttonColorDark", "buttonColor"),
    buttonTextColor: resolveColor(
      "buttonTextColorLight",
      "buttonTextColorDark",
      "buttonTextColor"
    ),
    textColor: resolveColor("textColorLight", "textColorDark", "textColor"),
    mutedColor: resolveColor("mutedColorLight", "mutedColorDark", "mutedColor"),
    blockBgLightResolved: blockBgPair.lightResolved,
    blockBgDarkResolved: blockBgPair.darkResolved,
    borderColorLightResolved: borderPair.lightResolved,
    borderColorDarkResolved: borderPair.darkResolved,
    buttonColorLightResolved: buttonPair.lightResolved,
    buttonColorDarkResolved: buttonPair.darkResolved,
    buttonTextColorLightResolved: buttonTextPair.lightResolved,
    buttonTextColorDarkResolved: buttonTextPair.darkResolved,
    textColorLightResolved: textPair.lightResolved,
    textColorDarkResolved: textPair.darkResolved,
    mutedColorLightResolved: mutedPair.lightResolved,
    mutedColorDarkResolved: mutedPair.darkResolved,
    gradientEnabledLight,
    gradientEnabledDark,
    gradientFromLightResolved,
    gradientToLightResolved,
    gradientFromDarkResolved,
    gradientToDarkResolved,
    gradientDirectionLight,
    gradientDirectionDark,
    shadowColor: readColor("shadowColor"),
    shadowSize: numOrNull(style.shadowSize as number),
    gradientEnabled: Boolean(style.gradientEnabled),
    gradientDirection:
      style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
        ? (style.gradientDirection as "horizontal" | "vertical")
        : "vertical",
    gradientFrom: (style.gradientFrom as string) ?? "",
    gradientTo: (style.gradientTo as string) ?? "",
    textAlign: (style.textAlign as "left" | "center" | "right") ?? "left",
    fontHeading: (style.fontHeading as string) ?? "",
    fontBody: (style.fontBody as string) ?? "",
    headingSize: numOrNull(style.headingSize as number),
    subheadingSize: numOrNull(style.subheadingSize as number),
    textSize: numOrNull(style.textSize as number),
  };
}

export function renderBlock(
  block: SiteBlock,
  accountName: string,
  publicSlug: string,
  branding: Branding,
  profile: AccountProfile,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  promos: PromoItem[],
  workPhotos: WorkPhotos,
  current: CurrentEntity,
  theme: SiteTheme
) {
  switch (block.type) {
    case "cover":
      return renderCover(
        block,
        accountName,
        publicSlug,
        branding,
        locations,
        services,
        specialists,
        theme
      );
    case "menu":
      return renderMenu(
        block,
        accountName,
        publicSlug,
        branding,
        profile,
        locations,
        services,
        specialists,
        promos,
        theme
      );
    case "about":
      return renderAbout(block, accountName, profile, theme);
    case "locations":
      return renderLocations(block, publicSlug, locations, current, theme);
    case "services":
      return renderServices(block, publicSlug, services, current, theme);
    case "specialists":
      return renderSpecialists(block, publicSlug, specialists, current, theme);
    case "promos":
      return renderPromos(block, publicSlug, promos, current, theme);
    case "works":
      return renderWorks(block, workPhotos);
    case "reviews":
      return renderReviews(block);
    case "contacts":
      return renderContacts(block, accountName, profile, locations);
    default:
      return null;
  }
}

function resolveEntities<T extends { id: number }>(
  mode: string,
  ids: number[],
  items: T[]
) {
  if (mode === "selected" && ids.length > 0) {
    const set = new Set(ids);
    return items.filter((item) => set.has(item.id));
  }
  return items;
}

function renderCover(
  block: SiteBlock,
  accountName: string,
  publicSlug: string,
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const title = (data.title as string) || accountName;
  const subtitle = (data.subtitle as string) || "";
  const description = (data.description as string) || "";
  const align = (data.align as string) === "center" ? "center" : "left";
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Р—Р°РїРёСЃР°С‚СЊСЃСЏ";
  const imageSource = (data.imageSource as { type?: string; id?: number; url?: string }) ?? {
    type: "account",
  };
  const imageUrl = resolveCoverImage(imageSource, branding, locations, services, specialists);

  return (
    <div className={`grid gap-6 ${imageUrl ? "md:grid-cols-[1.2fr_1fr]" : ""}`}>
      <div className={align === "center" ? "text-center" : "text-left"}>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Сайт {accountName}
        </div>
        <h1
          className="mt-3 text-3xl font-semibold"
          style={{ fontFamily: "var(--site-font-heading)" }}
        >
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-lg text-[color:var(--bp-muted)]">{subtitle}</p>}
        {description && <p className="mt-3 text-sm text-[color:var(--bp-muted)]">{description}</p>}
        {showButton && publicSlug && (
          <Link
            href={buildBookingLink({ publicSlug })}
            className="mt-5 inline-flex rounded-full px-5 py-2 text-sm font-semibold"
            style={buttonStyle(style)}
          >
            {buttonText}
          </Link>
        )}
      </div>
      {imageUrl && (
        <div className="overflow-hidden rounded-3xl border border-[color:var(--bp-stroke)]">
          <img src={imageUrl} alt="" className="h-56 w-full object-cover" />
        </div>
      )}
    </div>
  );
}

  function headingStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontHeading || "var(--site-font-heading)",
      fontSize: style.headingSize ? `${style.headingSize}px` : "var(--site-h1)",
      textAlign: style.textAlign ?? "left",
      color: "var(--block-text, var(--bp-ink))",
    } as const;
  }

  function subheadingStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontBody || "var(--site-font-body)",
      fontSize: style.subheadingSize ? `${style.subheadingSize}px` : "var(--site-h2)",
      textAlign: style.textAlign ?? "left",
      color: "var(--block-muted, var(--bp-muted))",
    } as const;
  }

  function textStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontBody || "var(--site-font-body)",
      fontSize: style.textSize ? `${style.textSize}px` : "var(--site-text-size)",
      textAlign: style.textAlign ?? "left",
      color: "var(--block-muted, var(--bp-muted))",
    } as const;
  }

  function buttonStyle(style: BlockStyle) {
    return {
      backgroundColor: "var(--block-button, var(--site-button))",
      color: "var(--block-button-text, var(--site-button-text))",
      borderRadius: style.buttonRadius !== null ? style.buttonRadius : "var(--site-button-radius)",
    } as const;
  }

  export function buildBlockWrapperStyle(
    style: BlockStyle,
    theme: SiteTheme,
    blockWidth: number,
    options: { isMenuSticky: boolean }
  ) {
    const blockShadowSize = typeof style.shadowSize === "number" ? style.shadowSize : null;
    const blockShadowColor =
      typeof style.shadowColor === "string" && style.shadowColor
        ? style.shadowColor
        : null;
    const radius = typeof style.radius === "number" ? style.radius : "var(--site-radius)";
    const lightGradient = style.gradientEnabledLight
      ? `linear-gradient(${style.gradientDirectionLight === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromLightResolved}, ${style.gradientToLightResolved})`
      : "none";
    const darkGradient = style.gradientEnabledDark
      ? `linear-gradient(${style.gradientDirectionDark === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromDarkResolved}, ${style.gradientToDarkResolved})`
      : "none";
    const borderColorOverride =
      typeof style.borderColor === "string" && style.borderColor ? style.borderColor : null;
    return {
      className: "site-block border border-[color:var(--bp-stroke)] p-8",
      style: {
        position: options.isMenuSticky ? "sticky" : undefined,
        top: options.isMenuSticky ? 0 : undefined,
        zIndex: options.isMenuSticky ? 40 : undefined,
        borderRadius: radius,
        backgroundColor: "var(--block-bg)",
        backgroundImage: "var(--block-gradient)",
        borderColor: "var(--block-border)",
        boxShadow:
          blockShadowSize !== null
            ? `0 ${blockShadowSize}px ${blockShadowSize * 2}px ${blockShadowColor ?? "var(--site-shadow-color)"}`
            : "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)",
        marginTop: typeof style.marginTop === "number" ? style.marginTop : 0,
        marginBottom: typeof style.marginBottom === "number" ? style.marginBottom : 0,
        width: "100%",
        maxWidth: blockWidth,
        marginLeft: "auto",
        marginRight: "auto",
        boxSizing: "border-box",
        color: "var(--block-text)",
        ["--bp-ink" as string]: "var(--block-text)",
        ["--bp-muted" as string]: "var(--block-muted)",
        ["--block-bg-light" as string]: style.blockBgLightResolved,
        ["--block-bg-dark" as string]: style.blockBgDarkResolved,
        ["--block-border-light" as string]: style.borderColorLightResolved,
        ["--block-border-dark" as string]: style.borderColorDarkResolved,
        ["--block-text-light" as string]: style.textColorLightResolved,
        ["--block-text-dark" as string]: style.textColorDarkResolved,
        ["--block-muted-light" as string]: style.mutedColorLightResolved,
        ["--block-muted-dark" as string]: style.mutedColorDarkResolved,
        ["--block-button-light" as string]: style.buttonColorLightResolved,
        ["--block-button-dark" as string]: style.buttonColorDarkResolved,
        ["--block-button-text-light" as string]: style.buttonTextColorLightResolved,
        ["--block-button-text-dark" as string]: style.buttonTextColorDarkResolved,
        ["--block-gradient-light" as string]: lightGradient,
        ["--block-gradient-dark" as string]: darkGradient,
        ...(borderColorOverride
          ? {
              ["--bp-stroke" as string]: "var(--block-border)",
              ["--site-border" as string]: "var(--block-border)",
            }
          : {}),
        } as CSSProperties,
      };
  }

function renderMenu(
  block: SiteBlock,
  accountName: string,
  publicSlug: string,
  branding: Branding,
  profile: AccountProfile,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  promos: PromoItem[],
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const menuItems = Array.isArray(data.menuItems)
    ? (data.menuItems as PageKey[]).filter((item) => item in PAGE_LABELS)
    : (Object.keys(PAGE_LABELS) as PageKey[]);
  const showLogo = data.showLogo !== false;
  const showButton = data.showButton !== false;
  const ctaMode = (data.ctaMode as string) || "booking";
  const phoneOverride =
    typeof data.phoneOverride === "string" ? data.phoneOverride.trim() : "";
  const phoneValue = phoneOverride || profile.phone || "";
  const showSearch = Boolean(data.showSearch);
  const showAccount = Boolean(data.showAccount);
  const showThemeToggle = Boolean(data.showThemeToggle);
  const accountLink = (data.accountLink as string) || "/c";
  const showSocials = Boolean(data.showSocials);
  const socialsMode = (data.socialsMode as string) || "auto";
  const socialsCustom = (data.socialsCustom as Record<string, string>) ?? {};
  const buttonText = (data.buttonText as string) || "Записаться";
  const basePath = publicSlug ? `/${publicSlug}` : "#";

  const logoNode = showLogo ? (
    branding.logoUrl ? (
      <img src={branding.logoUrl} alt="" className="h-8 w-auto" />
    ) : (
      <div className="text-sm font-semibold">{accountName}</div>
    )
  ) : null;

  const linkItems = menuItems.map((key) => {
    const href =
      key === "home" ? basePath : `${basePath}/${key === "promos" ? "promos" : key}`;
    return (
      <Link
        key={key}
        href={href}
        className="text-sm font-medium"
        style={{ color: "var(--block-text, var(--bp-ink))" }}
      >
        {PAGE_LABELS[key]}
      </Link>
    );
  });

  const socialsAuto: Record<string, string | null | undefined> = {
    website: profile.websiteUrl,
    instagram: profile.instagramUrl,
    whatsapp: profile.whatsappUrl,
    telegram: profile.telegramUrl,
    max: profile.maxUrl,
    vk: profile.vkUrl,
    viber: profile.viberUrl,
    pinterest: profile.pinterestUrl,
    facebook: profile.facebookUrl,
    tiktok: profile.tiktokUrl,
    youtube: profile.youtubeUrl,
    twitter: profile.twitterUrl,
    dzen: profile.dzenUrl,
    ok: profile.okUrl,
  };

  const socialEntries = Object.keys(SOCIAL_ICONS)
    .map((key) => {
      const raw =
        socialsMode === "custom" ? socialsCustom[key] : socialsAuto[key];
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) return null;
      const href = value.startsWith("http") ? value : `https://${value}`;
      return { key, href };
    })
    .filter(Boolean) as Array<{ key: string; href: string }>;

  const socialsNode =
    showSocials && socialEntries.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        {socialEntries.map((item) => (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent"
            title={SOCIAL_LABELS[item.key] ?? item.key}
            aria-label={SOCIAL_LABELS[item.key] ?? item.key}
          >
            <img
              src={SOCIAL_ICONS[item.key]}
              alt={SOCIAL_LABELS[item.key] ?? item.key}
              className="h-5 w-5"
            />
          </a>
        ))}
      </div>
    ) : null;

  const canBook = Boolean(publicSlug);
  const canPhone = Boolean(phoneValue);
  const usePhone = ctaMode === "phone" && canPhone;
  const showCta = showButton && (canBook || canPhone);
  const isAccountExternal =
    typeof accountLink === "string" && /^https?:\/\//.test(accountLink);

  const ctaNode = showCta ? (
    usePhone ? (
      <a
        href={`tel:${phoneValue}`}
        className="inline-flex px-4 py-2 text-sm font-semibold"
        style={buttonStyle(style)}
      >
        {phoneValue}
      </a>
    ) : (
      <Link
        href={buildBookingLink({ publicSlug })}
        className="inline-flex px-4 py-2 text-sm font-semibold"
        style={buttonStyle(style)}
      >
        {buttonText}
      </Link>
    )
  ) : null;

  const searchNode =
    showSearch && publicSlug ? (
      <MenuSearch
        publicSlug={publicSlug}
        locations={locations.map((item) => ({ id: item.id, name: item.name }))}
        services={services.map((item) => ({ id: item.id, name: item.name }))}
        specialists={specialists.map((item) => ({ id: item.id, name: item.name }))}
        promos={promos.map((item) => ({ id: item.id, name: item.name }))}
      />
    ) : null;

  const accountNode = showAccount ? (
    isAccountExternal ? (
      <a
        href={accountLink}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]"
        aria-label="Личный кабинет"
        title="Личный кабинет"
        target="_blank"
        rel="noreferrer"
      >
        <IconUser />
      </a>
    ) : (
      <Link
        href={accountLink}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]"
        aria-label="Личный кабинет"
        title="Личный кабинет"
      >
        <IconUser />
      </Link>
    )
  ) : null;
  const themeToggleNode = showThemeToggle ? (
    <SiteThemeToggle
      mode={theme.mode}
      lightPalette={theme.lightPalette}
      darkPalette={theme.darkPalette}
    />
  ) : null;

  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      {searchNode}
      {socialsNode}
      {accountNode}
      {themeToggleNode}
      {ctaNode}
    </div>
  );

  const actionsCentered = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {searchNode}
      {socialsNode}
      {accountNode}
      {themeToggleNode}
      {ctaNode}
    </div>
  );

  const navNode = (
    <div className="flex flex-wrap items-center gap-4">{linkItems}</div>
  );

  const navPills = (
    <div className="flex flex-wrap items-center gap-2">
      {menuItems.map((key) => {
        const href =
          key === "home" ? basePath : `${basePath}/${key === "promos" ? "promos" : key}`;
        return (
          <Link
            key={key}
            href={href}
            className="rounded-full border border-[color:var(--site-border)] px-3 py-1 text-xs"
          >
            {PAGE_LABELS[key]}
          </Link>
        );
      })}
    </div>
  );

  let desktopLayout = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {logoNode}
      {navNode}
      {actions}
    </div>
  );

  if (block.variant === "v2") {
    desktopLayout = (
      <div className="flex flex-col items-center gap-4 text-center">
        {logoNode}
        {navNode}
        {actionsCentered}
      </div>
    );
  }

  if (block.variant === "v3") {
    desktopLayout = (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {logoNode}
          {navNode}
        </div>
        {actions}
      </div>
    );
  }

  if (block.variant === "v4") {
    desktopLayout = (
      <div className="flex flex-wrap items-center justify-between gap-4">
        {logoNode}
        {navPills}
        {actions}
      </div>
    );
  }

  if (block.variant === "v5") {
    desktopLayout = (
      <div className="flex flex-col items-center gap-3">
        {logoNode}
        {navNode}
        {actionsCentered}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="hidden md:block">{desktopLayout}</div>
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          {logoNode}
          <div className="flex items-center gap-2">
            {accountNode}
            {themeToggleNode}
            {ctaNode}
            <details className="relative">
              <summary className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]">
                <IconMenu />
              </summary>
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--bp-panel)] p-4 shadow-lg">
                {searchNode && <div className="mb-3">{searchNode}</div>}
                <div className="flex flex-col gap-2">{linkItems}</div>
                {socialsNode && <div className="mt-3">{socialsNode}</div>}
                {ctaNode && <div className="mt-3">{ctaNode}</div>}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveCoverImage(
  imageSource: { type?: string; id?: number; url?: string },
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[]
) {
  if (imageSource.type === "custom") return imageSource.url ?? null;
  if (imageSource.type === "none") return null;
  if (imageSource.type === "account") return branding.coverUrl ?? null;
  if (imageSource.type === "location") {
    return locations.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  if (imageSource.type === "service") {
    return services.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  if (imageSource.type === "specialist") {
    return specialists.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  return null;
}

function IconUser() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function renderAbout(
  block: SiteBlock,
  accountName: string,
  profile: AccountProfile,
  _theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const text = (data.text as string) || profile.description || "";
  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "О нас"}
      </h2>
      {text && <p className="mt-3 text-sm text-[color:var(--bp-muted)]">{text}</p>}
      <div className="mt-3 text-xs text-[color:var(--bp-muted)]">Аккаунт: {accountName}</div>
    </div>
  );
}

function renderLocations(
  block: SiteBlock,
  publicSlug: string,
  locations: LocationItem[],
  current: CurrentEntity,
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = current?.type === "location" ? current.id : null;
  const items =
    useCurrent && currentId
      ? locations.filter((item) => item.id === currentId)
      : resolveEntities(mode, ids, locations);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Локации"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((location) => (
          <div key={location.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            {location.coverUrl && (
              <img
                src={location.coverUrl}
                alt=""
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}
            <Link
              href={`/${publicSlug}/locations/${location.id}`}
              className="text-base font-semibold"
            >
              {location.name}
            </Link>
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{location.address}</div>
            {location.phone && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                Телефон: {location.phone}
              </div>
            )}
            {showButton && publicSlug && (
              <Link
                href={buildBookingLink({
                  publicSlug,
                  locationId: location.id,
                  scenario: "serviceFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
                style={buttonStyle(style)}
              >
                {buttonText}
              </Link>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет локаций для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderServices(
  block: SiteBlock,
  publicSlug: string,
  services: ServiceItem[],
  current: CurrentEntity,
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = current?.type === "service" ? current.id : null;
  const items =
    useCurrent && currentId
      ? services.filter((item) => item.id === currentId)
      : resolveEntities(mode, ids, services);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const showPrice = data.showPrice !== false;
  const showDuration = data.showDuration !== false;
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const specialistId = typeof data.specialistId === "number" ? data.specialistId : null;
  const currentLocationId = current?.type === "location" ? current.id : null;
  const currentSpecialistId = current?.type === "specialist" ? current.id : null;
  const effectiveSpecialistId = currentSpecialistId ?? specialistId;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Услуги"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((service) => (
          <div key={service.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            {service.coverUrl && (
              <img
                src={service.coverUrl}
                alt=""
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}
            <Link
              href={`/${publicSlug}/services/${service.id}`}
              className="text-base font-semibold"
            >
              {service.name}
            </Link>
            {service.description && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                {service.description}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--bp-muted)]">
              {showDuration && <span>{service.baseDurationMin} мин</span>}
              {showPrice && <span>{service.basePrice} ₽</span>}
            </div>
            {showButton && publicSlug && (
              <Link
                href={buildBookingLink({
                  publicSlug,
                  locationId:
                    currentLocationId ??
                    locationId ??
                    (service.locationIds.length === 1 ? service.locationIds[0] : null),
                  specialistId: effectiveSpecialistId,
                  serviceId: service.id,
                  scenario: effectiveSpecialistId ? "specialistFirst" : "serviceFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
                style={buttonStyle(style)}
              >
                {buttonText}
              </Link>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет услуг для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderSpecialists(
  block: SiteBlock,
  publicSlug: string,
  specialists: SpecialistItem[],
  current: CurrentEntity,
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = current?.type === "specialist" ? current.id : null;
  const items =
    useCurrent && currentId
      ? specialists.filter((item) => item.id === currentId)
      : resolveEntities(mode, ids, specialists);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const currentLocationId = current?.type === "location" ? current.id : null;
  const visibleItems = currentLocationId
    ? items.filter((item) => item.locationIds.includes(currentLocationId))
    : items;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Специалисты"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {visibleItems.map((specialist) => (
          <div key={specialist.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            {specialist.coverUrl && (
              <img
                src={specialist.coverUrl}
                alt=""
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}
            <Link
              href={`/${publicSlug}/specialists/${specialist.id}`}
              className="text-base font-semibold"
            >
              {specialist.name}
            </Link>
            {specialist.level && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{specialist.level}</div>
            )}
            {showButton && publicSlug && (
              <Link
                href={buildBookingLink({
                  publicSlug,
                  locationId:
                    currentLocationId ??
                    locationId ??
                    (specialist.locationIds.length === 1 ? specialist.locationIds[0] : null),
                  specialistId: specialist.id,
                  scenario: "specialistFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
                style={buttonStyle(style)}
              >
                {buttonText}
              </Link>
            )}
          </div>
        ))}
        {visibleItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет специалистов для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderPromos(
  block: SiteBlock,
  publicSlug: string,
  promos: PromoItem[],
  current: CurrentEntity,
  _theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = current?.type === "promo" ? current.id : null;
  const items =
    useCurrent && currentId
      ? promos.filter((item) => item.id === currentId)
      : resolveEntities(mode, ids, promos);
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Промо и скидки"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((promo) => (
          <div key={promo.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            <Link
              href={`/${publicSlug}/promos/${promo.id}`}
              className="text-base font-semibold"
            >
              {promo.name}
            </Link>
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
              {promo.type === "PERCENT" ? `${promo.value}%` : `${promo.value} ₽`}
              {promo.startsAt || promo.endsAt ? " · " : ""}
              {promo.startsAt ? `с ${promo.startsAt}` : ""}
              {promo.endsAt ? ` по ${promo.endsAt}` : ""}
            </div>
            {promo.codes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {promo.codes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  >
                    {code}
                  </span>
                ))}
              </div>
            )}
            {!promo.isActive && (
              <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                Неактивно
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет активных промо.
          </div>
        )}
      </div>
    </div>
  );
}

function renderWorks(block: SiteBlock, workPhotos: WorkPhotos) {
  const data = block.data as Record<string, unknown>;
  const source = (data.source as string) ?? "locations";
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const items =
    source === "services"
      ? workPhotos.services
      : source === "specialists"
        ? workPhotos.specialists
        : workPhotos.locations;
  const filtered =
    mode === "selected" && ids.length > 0
      ? items.filter((item) => ids.includes(Number(item.entityId)))
      : items;

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Работы"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {filtered.slice(0, 8).map((item, idx) => (
          <img
            key={`${item.entityId}-${idx}`}
            src={item.url}
            alt=""
            className="h-28 w-full rounded-xl object-cover"
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет фото работ для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderReviews(block: SiteBlock) {
  const data = block.data as Record<string, unknown>;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Отзывы"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]"
          >
            Отзывы будут отображаться здесь после их появления.
          </div>
        ))}
      </div>
    </div>
  );
}

function renderContacts(
  block: SiteBlock,
  accountName: string,
  profile: AccountProfile,
  locations: LocationItem[]
) {
  const data = block.data as Record<string, unknown>;
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const location = locationId
    ? locations.find((item) => item.id === locationId)
    : locations[0];
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <div>
        <h2
          className="text-2xl font-semibold"
          style={{ fontFamily: "var(--site-font-heading)" }}
        >
          {(data.title as string) || "Контакты"}
        </h2>
        {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
        <div className="mt-4 space-y-2 text-sm text-[color:var(--bp-muted)]">
          <div>Аккаунт: {accountName}</div>
          {profile.phone && <div>Телефон: {profile.phone}</div>}
          {profile.email && <div>Email: {profile.email}</div>}
          {(profile.address || location?.address) && (
            <div>Адрес: {profile.address || location?.address}</div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-xs text-[color:var(--bp-muted)]">
        Здесь можно будет подключить карту.
      </div>
    </div>
  );
}







