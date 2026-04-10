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
  coverHeightCss: string;
  filterOverlay: string;
  showArrows: boolean;
  showDots: boolean;
  infinite: boolean;
  autoplayMs: number;
  arrowSize: "sm" | "md" | "lg" | "xl";
  arrowThickness: number;
  arrowColor: string;
  arrowBgColor: string;
  dotSize: number;
  dotColor: string;
  dotActiveColor: string;
  dotBorderWidth: number;
  dotBorderColor: string;
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
  coverHeightCss,
  filterOverlay,
  showArrows,
  showDots,
  infinite,
  autoplayMs,
  arrowSize,
  arrowThickness,
  arrowColor,
  arrowBgColor,
  dotSize,
  dotColor,
  dotActiveColor,
  dotBorderWidth,
  dotBorderColor,
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

  useEffect(() => {
    if (slides.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= slides.length) setIndex(slides.length - 1);
  }, [index, slides.length]);

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

  const current = slides[index] ?? slides[0];
  if (!current) return null;

  const arrowSizeMap = { sm: 40, md: 48, lg: 56, xl: 64 } as const;
  const arrowPx = arrowSizeMap[arrowSize] ?? 40;
  const canGoPrev = infinite || index > 0;
  const canGoNext = infinite || index < slides.length - 1;

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

  return (
    <section
      className="relative overflow-hidden px-4 py-14 sm:px-10 sm:py-20"
      style={{
        minHeight: coverHeightCss,
        backgroundImage: current.imageUrl ? `url(${current.imageUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center center",
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: filterOverlay }} />
      <div
        className="relative z-[1] mx-auto flex w-full"
        style={{
          minHeight: coverHeightCss,
          alignItems:
            contentVerticalAlign === "top"
              ? "flex-start"
              : contentVerticalAlign === "bottom"
                ? "flex-end"
                : "center",
        }}
      >
        <div
          className="w-full"
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
              fontSize: `clamp(${headingMobileSize}px, 9cqw, ${Math.max(
                headingMobileSize,
                headingDesktopSize
              )}px)`,
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
                marginLeft:
                  contentAlign === "center" || contentAlign === "right" ? "auto" : 0,
                marginRight: contentAlign === "center" ? "auto" : 0,
                fontSize: `clamp(${textMobileSize}px, 4.2cqw, ${Math.max(
                  textMobileSize,
                  textDesktopSize
                )}px)`,
              }}
            >
              {current.description}
            </p>
          ) : null}
          {current.buttonText && current.buttonHref ? (
            <div
              className="mt-7 flex"
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
                className="inline-flex items-center whitespace-nowrap font-semibold"
                style={{
                  ...buttonCss,
                  minHeight: "clamp(46px, 6cqw, 54px)",
                  paddingInline: "clamp(24px, 3.2cqw, 40px)",
                  paddingBlock: "clamp(10px, 1.2cqw, 12px)",
                  fontSize: "clamp(14px, 2cqw, 16px)",
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
            className="absolute left-4 top-1/2 z-[2] -translate-y-1/2 rounded-full transition disabled:opacity-40"
            style={{
              width: arrowPx,
              height: arrowPx,
              backgroundColor: arrowBgColor,
              color: arrowColor,
            }}
            aria-label="Предыдущий слайд"
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto"
              style={{ width: arrowPx * 0.5, height: arrowPx * 0.5 }}
              fill="none"
              stroke="currentColor"
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
            className="absolute right-4 top-1/2 z-[2] -translate-y-1/2 rounded-full transition disabled:opacity-40"
            style={{
              width: arrowPx,
              height: arrowPx,
              backgroundColor: arrowBgColor,
              color: arrowColor,
            }}
            aria-label="Следующий слайд"
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto"
              style={{ width: arrowPx * 0.5, height: arrowPx * 0.5 }}
              fill="none"
              stroke="currentColor"
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
            const active = dotIndex === index;
            return (
              <button
                key={`${slide.id}-dot`}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className="rounded-full transition"
                style={{
                  width: dotSize,
                  height: dotSize,
                  backgroundColor: active ? dotActiveColor : dotColor,
                  borderStyle: "solid",
                  borderWidth: dotBorderWidth,
                  borderColor: dotBorderColor,
                  opacity: active ? 1 : 0.85,
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
