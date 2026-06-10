"use client";

import { useEffect, useState, type CSSProperties } from "react";

export type PublicCoverSlide = {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  imageUrl: string | null;
};

type PublicCoverV2HeroProps = {
  slides: PublicCoverSlide[];
  contentAlign: "left" | "center" | "right";
  contentVerticalAlign: "top" | "center" | "bottom";
  contentMaxWidth: string;
  contentMarginLeft: string | number;
  coverBackgroundPosition: string;
  coverHeightCss: string;
  filterOverlay: string;
  showArrows: boolean;
  showDots: boolean;
  infinite: boolean;
  autoplayMs: number;
  arrowSize: "sm" | "md" | "lg" | "xl";
  arrowThickness: number;
  arrowColorLight: string;
  arrowColorDark: string;
  arrowHoverColorLight: string;
  arrowHoverColorDark: string;
  arrowBgColorLight: string;
  arrowBgColorDark: string;
  arrowHoverBgColorLight: string;
  arrowHoverBgColorDark: string;
  arrowShowOutline: boolean;
  arrowOutlineColorLight: string;
  arrowOutlineColorDark: string;
  arrowOutlineThickness: number;
  dotSize: number;
  dotColorLight: string;
  dotColorDark: string;
  dotActiveColorLight: string;
  dotActiveColorDark: string;
  dotBorderWidth: number;
  dotBorderColorLight: string;
  dotBorderColorDark: string;
  primaryButtonBorderColor: string;
  primaryButtonHoverBgColorLight: string;
  primaryButtonHoverBgColorDark: string;
  themeMode: "light" | "dark";
  headingCss: CSSProperties;
  textCss: CSSProperties;
  buttonCss: CSSProperties;
  headingDesktopSize: number;
  headingMobileSize: number;
  textDesktopSize: number;
  textMobileSize: number;
  descriptionColor: string;
};

export default function PublicCoverV2Hero({
  slides,
  contentAlign,
  contentVerticalAlign,
  contentMaxWidth,
  contentMarginLeft,
  coverBackgroundPosition,
  coverHeightCss,
  filterOverlay,
  showArrows,
  showDots,
  infinite,
  autoplayMs,
  arrowSize,
  arrowThickness,
  arrowColorLight,
  arrowColorDark,
  arrowHoverColorLight,
  arrowHoverColorDark,
  arrowBgColorLight,
  arrowBgColorDark,
  arrowHoverBgColorLight,
  arrowHoverBgColorDark,
  arrowShowOutline,
  arrowOutlineColorLight,
  arrowOutlineColorDark,
  arrowOutlineThickness,
  dotSize,
  dotColorLight,
  dotColorDark,
  dotActiveColorLight,
  dotActiveColorDark,
  dotBorderWidth,
  dotBorderColorLight,
  dotBorderColorDark,
  primaryButtonBorderColor,
  primaryButtonHoverBgColorLight,
  primaryButtonHoverBgColorDark,
  themeMode,
  headingCss,
  textCss,
  buttonCss,
  headingDesktopSize,
  headingMobileSize,
  textDesktopSize,
  textMobileSize,
  descriptionColor,
}: PublicCoverV2HeroProps) {
  const [index, setIndex] = useState(0);
  const canSlide = slides.length > 1;
  const [hoveredArrow, setHoveredArrow] = useState<"prev" | "next" | null>(null);
  const [hoveredPrimaryButton, setHoveredPrimaryButton] = useState(false);
  const [activeThemeMode, setActiveThemeMode] = useState<"light" | "dark">(
    themeMode === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    const resolveModeFromDom = () => {
      const root = document.getElementById("public-site-root");
      const mode = root?.getAttribute("data-site-theme");
      if (mode === "light" || mode === "dark") setActiveThemeMode(mode);
    };
    resolveModeFromDom();
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: string }>).detail;
      const mode = detail?.mode;
      if (mode === "light" || mode === "dark") {
        setActiveThemeMode(mode);
        return;
      }
      resolveModeFromDom();
    };
    window.addEventListener("site-theme-change", onThemeChange as EventListener);
    const root = document.getElementById("public-site-root");
    let observer: MutationObserver | null = null;
    if (root) {
      observer = new MutationObserver(() => resolveModeFromDom());
      observer.observe(root, { attributes: true, attributeFilter: ["data-site-theme"] });
    }
    return () => {
      window.removeEventListener("site-theme-change", onThemeChange as EventListener);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!canSlide || autoplayMs <= 0) return;
        const timer = window.setInterval(() => {
      setIndex((prev) => {
        if (infinite) return (prev + 1) % slides.length;
        if (prev >= slides.length - 1) return prev;
        return prev + 1;
      });
    }, autoplayMs);
    return () => window.clearInterval(timer);
  }, [autoplayMs, canSlide, infinite, slides.length]);

  const activeIndex = slides.length > 0 ? Math.min(index, slides.length - 1) : 0;
  const current = slides[activeIndex] ?? slides[0];
  if (!current) return null;

  const arrowSizeMap = { sm: 40, md: 48, lg: 56, xl: 64 } as const;
  const arrowPx = arrowSizeMap[arrowSize] ?? 40;
  const canGoPrev = infinite || activeIndex > 0;
  const canGoNext = infinite || activeIndex < slides.length - 1;

  const goPrev = () => {
    if (!canGoPrev) return;
    setIndex((prev) => {
      if (infinite) return (prev - 1 + slides.length) % slides.length;
      return Math.max(0, prev - 1);
    });
  };

  const goNext = () => {
    if (!canGoNext) return;
    setIndex((prev) => {
      if (infinite) return (prev + 1) % slides.length;
      return Math.min(slides.length - 1, prev + 1);
    });
  };

  const pickModeColor = (light: string, dark: string) =>
    activeThemeMode === "dark" ? dark || light : light || dark;
  const baseArrowBg = pickModeColor(arrowBgColorLight, arrowBgColorDark);
  const hoverArrowBg = pickModeColor(arrowHoverBgColorLight, arrowHoverBgColorDark) || baseArrowBg;
  const baseArrowColor = pickModeColor(arrowColorLight, arrowColorDark);
  const hoverArrowColor = pickModeColor(arrowHoverColorLight, arrowHoverColorDark) || baseArrowColor;
  const outlineColor = pickModeColor(arrowOutlineColorLight, arrowOutlineColorDark);
  const effectiveOutlineColor =
    outlineColor && outlineColor !== "transparent" ? outlineColor : baseArrowColor;
  const dotColor = pickModeColor(dotColorLight, dotColorDark);
  const dotActiveColor = pickModeColor(dotActiveColorLight, dotActiveColorDark);
  const dotBorderColor = pickModeColor(dotBorderColorLight, dotBorderColorDark);
  const hasPrimaryButtonBorder =
    primaryButtonBorderColor !== "transparent" &&
    primaryButtonBorderColor.toLowerCase() !== "rgba(0,0,0,0)";
  const primaryButtonHoverBgColorRaw = pickModeColor(
    primaryButtonHoverBgColorLight,
    primaryButtonHoverBgColorDark
  );
  const primaryButtonHoverBgColor =
    primaryButtonHoverBgColorRaw &&
    primaryButtonHoverBgColorRaw.toLowerCase() !== "transparent"
      ? primaryButtonHoverBgColorRaw
      : "";

  return (
    <section
      className="bp-cover-hero bp-cover-v2-hero relative overflow-hidden px-4 py-14 sm:px-10 sm:py-20"
      style={{
        ["--bp-cover-height-desktop" as string]: coverHeightCss,
        ["--bp-cover-height-mobile" as string]: "min(680px, 100svh)",
        ["--bp-cover-heading-size-desktop" as string]: `clamp(${headingMobileSize}px, 9cqw, ${Math.max(
          headingMobileSize,
          headingDesktopSize
        )}px)`,
        ["--bp-cover-heading-size-mobile" as string]: `${Math.max(
          24,
          Math.min(38, headingMobileSize)
        )}px`,
        ["--bp-cover-text-size-desktop" as string]: `clamp(${textMobileSize}px, 4.2cqw, ${Math.max(
          textMobileSize,
          textDesktopSize
        )}px)`,
        ["--bp-cover-text-size-mobile" as string]: `${Math.max(
          13,
          Math.min(17, textMobileSize)
        )}px`,
        height: "var(--bp-cover-height, var(--bp-cover-height-desktop))",
        minHeight: "var(--bp-cover-height, var(--bp-cover-height-desktop))",
        backgroundImage: current.imageUrl ? `url(${current.imageUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: coverBackgroundPosition,
        containerType: "inline-size",
        boxSizing: "border-box",
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: filterOverlay }} />
      <div
        className="relative z-[1] mx-auto flex w-full"
        style={{
          height: "100%",
          minHeight: "100%",
          alignItems:
            contentVerticalAlign === "top"
              ? "flex-start"
              : contentVerticalAlign === "bottom"
                ? "flex-end"
                : "center",
        }}
      >
        <div
          className="bp-cover-content w-full"
          style={{
            maxWidth: contentMaxWidth,
            marginLeft: contentMarginLeft,
            marginRight: 0,
          }}
        >
          <h2
            className="text-white leading-[1.08] tracking-[-0.01em]"
            style={{
              ...headingCss,
              textAlign: contentAlign,
              whiteSpace: "pre-line",
              fontSize: "var(--bp-cover-heading-size)",
            }}
          >
            {current.title}
          </h2>
          {current.description ? (
            <p
              className="mt-5 max-w-[760px] text-white/80 leading-[1.45]"
              style={{
                ...textCss,
                textAlign: contentAlign,
                color: descriptionColor,
                whiteSpace: "pre-line",
                marginLeft:
                  contentAlign === "center" || contentAlign === "right" ? "auto" : 0,
                marginRight: contentAlign === "center" ? "auto" : 0,
                fontSize: "var(--bp-cover-text-size)",
              }}
            >
              {current.description}
            </p>
          ) : null}
          {current.buttonText && current.buttonHref ? (
            <div
              className="mt-6 flex"
              style={{
                justifyContent:
                  contentAlign === "center"
                    ? "center"
                    : contentAlign === "right"
                      ? "flex-end"
                      : "flex-start",
              }}
            >
              <a
                href={current.buttonHref}
                className="bp-cover-primary-hover inline-flex items-center whitespace-nowrap font-semibold"
                onMouseEnter={() => setHoveredPrimaryButton(true)}
                onMouseLeave={() => setHoveredPrimaryButton(false)}
                style={{
                  ...buttonCss,
                  ...(hoveredPrimaryButton && primaryButtonHoverBgColor
                    ? { backgroundColor: primaryButtonHoverBgColor }
                    : {}),
                  borderStyle: "solid",
                  borderWidth: hasPrimaryButtonBorder ? 1 : 0,
                  borderColor: hasPrimaryButtonBorder ? primaryButtonBorderColor : "transparent",
                  minHeight: "clamp(40px, 5.2cqw, 48px)",
                  paddingInline: "clamp(18px, 3cqw, 30px)",
                  paddingBlock: "clamp(8px, 1.1cqw, 11px)",
                  fontSize: "var(--bp-cover-button-size, clamp(14px, 2cqw, 16px))",
                  transition: "background-color 180ms ease",
                }}
              >
                {current.buttonText}
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {showArrows && canSlide ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="bp-cover-slider-arrow bp-cover-slider-arrow-prev absolute left-4 top-1/2 z-[2] -translate-y-1/2 rounded-full transition disabled:opacity-40"
            style={{
              width: arrowPx,
              height: arrowPx,
              backgroundColor: hoveredArrow === "prev" ? hoverArrowBg : baseArrowBg,
              color: hoveredArrow === "prev" ? hoverArrowColor : baseArrowColor,
              borderWidth: arrowShowOutline ? arrowOutlineThickness : 0,
              borderColor: arrowShowOutline ? effectiveOutlineColor : "transparent",
              borderStyle: "solid",
            }}
            aria-label="Предыдущий слайд"
            onMouseEnter={() => setHoveredArrow("prev")}
            onMouseLeave={() => setHoveredArrow(null)}
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto"
              style={{ width: arrowPx * 0.5, height: arrowPx * 0.5 }}
              fill="none"
              stroke={hoveredArrow === "prev" ? hoverArrowColor : baseArrowColor}
              strokeWidth={arrowThickness}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="bp-cover-slider-arrow bp-cover-slider-arrow-next absolute right-4 top-1/2 z-[2] -translate-y-1/2 rounded-full transition disabled:opacity-40"
            style={{
              width: arrowPx,
              height: arrowPx,
              backgroundColor: hoveredArrow === "next" ? hoverArrowBg : baseArrowBg,
              color: hoveredArrow === "next" ? hoverArrowColor : baseArrowColor,
              borderWidth: arrowShowOutline ? arrowOutlineThickness : 0,
              borderColor: arrowShowOutline ? effectiveOutlineColor : "transparent",
              borderStyle: "solid",
            }}
            aria-label="Следующий слайд"
            onMouseEnter={() => setHoveredArrow("next")}
            onMouseLeave={() => setHoveredArrow(null)}
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto"
              style={{ width: arrowPx * 0.5, height: arrowPx * 0.5 }}
              fill="none"
              stroke={hoveredArrow === "next" ? hoverArrowColor : baseArrowColor}
              strokeWidth={arrowThickness}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </>
      ) : null}

      {showDots && canSlide ? (
        <div className="absolute bottom-6 left-1/2 z-[2] flex -translate-x-1/2 items-center gap-2">
          {slides.map((slide, dotIndex) => {
            return (
              <button
                key={`${slide.id}-dot`}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className="rounded-full transition"
                style={{
                  width: dotSize,
                  height: dotSize,
                  backgroundColor: dotIndex === activeIndex ? dotActiveColor : dotColor,
                  borderStyle: "solid",
                  borderWidth: dotBorderWidth,
                  borderColor: dotBorderColor,
                  opacity: dotIndex === activeIndex ? 1 : 0.85,
                }}
                aria-label={`Слайд ${dotIndex + 1}`}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
