"use client";

import { UnoptimizedImage } from "@/components/unoptimized-image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildBookingLink } from "@/lib/booking-links";
import { RatingBadge } from "@/features/site-builder/blocks/rating-badge";
import type { SiteServiceItem as ServiceItem } from "@/features/site-builder/shared/site-data";

type ServiceCatalogProps = {
  variant: "v1" | "v2";
  listView: "tile" | "list";
  title: string;
  subtitle: string;
  items: ServiceItem[];
  publicSlug: string | null;
  publicBasePath?: string | null;
  currentLocationId: number | null;
  locationId: number | null;
  locations: Array<{ id: number; name: string }>;
  effectiveSpecialistId: number | null;
  cardsPerRow: number;
  showCategoryTabs: boolean;
  categoryAllLabel: string;
  showSearch: boolean;
  searchPlaceholder: string;
  showSort: boolean;
  defaultSort: string;
  searchSortAlignment: "left" | "center" | "right";
  filtersAlignment: "left" | "center" | "right";
  categoryTextColor?: string;
  categoryActiveColor?: string;
  sortTextColor?: string;
  sortActiveColor?: string;
  locationTextColor?: string;
  locationActiveColor?: string;
  categoryTextColorDark?: string;
  categoryActiveColorDark?: string;
  sortTextColorDark?: string;
  sortActiveColorDark?: string;
  locationTextColorDark?: string;
  locationActiveColorDark?: string;
  themeMode: "light" | "dark";
  showDescription: boolean;
  showPrice: boolean;
  showDuration: boolean;
  showButton: boolean;
  buttonText: string;
  buttonAlignment?: "left" | "center" | "right";
  detailsButtonText: string;
  detailsButtonColor?: string;
  detailsButtonTextColor?: string;
  detailsButtonBorderColor?: string;
  detailsButtonColorDark?: string;
  detailsButtonTextColorDark?: string;
  detailsButtonBorderColorDark?: string;
  servicePageButtonMode: "entityPage" | "booking";
  cardStyle: "plain" | "filled";
  cardBackgroundColorLight?: string;
  cardBackgroundImageLight?: string;
  cardBackgroundColorDark?: string;
  cardBackgroundImageDark?: string;
  cardLiquidGlass?: boolean;
  cardBackgroundStartOpacityLight?: number;
  cardBackgroundEndOpacityLight?: number;
  cardBackgroundStartOpacityDark?: number;
  cardBackgroundEndOpacityDark?: number;
  cardGapX: number;
  cardGapY: number;
  imageAspectRatio: string;
  serviceCardImageFit?: "contain" | "cover";
  imageRadius: number;
  cardPaddingX: number;
  cardPaddingY: number;
  mobileCardsPerRow: 1 | 2;
  showSecondImageOnHover: boolean;
  imageZoomOnHover: boolean;
  alignButtonsBottom: boolean;
  modalImageClickEnabled: boolean;
  serviceModalShowDescription: boolean;
  serviceModalShowMeta: boolean;
  serviceModalBgColor?: string;
  serviceModalBgColorDark?: string;
  serviceModalBgImage?: string;
  serviceModalBgImageDark?: string;
  serviceModalMediaColumns: number;
  serviceModalInfoColumns: number;
  modalGalleryBgColor: string;
  modalImageFit: "contain" | "cover";
  modalImageRadius: number;
  modalImageAspectRatio: string;
  modalControls: "arrowsAndDots" | "arrows" | "dots" | "thumbnails";
  modalArrowSize: "sm" | "md" | "lg";
  modalArrowThickness: number;
  modalArrowColor: string;
  modalArrowHoverColor: string;
  modalArrowBgColor: string;
  modalArrowHoverBgColor: string;
  modalArrowBgOpacity: number;
  modalArrowHoverBgOpacity: number;
  modalArrowBorderEnabled: boolean;
  modalDotsSize: number;
  modalDotsColor: string;
  modalDotsActiveColor: string;
  modalDotsBorderWidth: number;
  modalThumbnailsPosition: "bottom";
  modalInfiniteGallery: boolean;
  modalImageZoomOnClick: boolean;
  modalImageZoomOnHover: boolean;
  modalCategoryTextStyle: CSSProperties;
  modalTitleTextStyle: CSSProperties;
  modalDescriptionTextStyle: CSSProperties;
  modalPriceTextStyle: CSSProperties;
  modalDurationTextStyle: CSSProperties;
  maxVisibleItems: number;
  usePagination: boolean;
  headingStyle: CSSProperties;
  subheadingStyle: CSSProperties;
  buttonStyle: CSSProperties;
  detailsButtonStyle?: CSSProperties;
  textAlign?: "left" | "center" | "right";
  ratingAlignment?: "left" | "center" | "right";
  ratingVerticalAlignment?: "top" | "bottom";
  ratingTextColor?: string;
  ratingTextColorDark?: string;
  ratingStarColor?: string;
  ratingStarColorDark?: string;
  ratingBackgroundColor?: string;
  ratingBackgroundColorDark?: string;
  ratingBackgroundOpacity?: number;
  ratingBackgroundRadius?: number;
  ratingTextSize?: number;
  ratingTextFont?: string;
  ratingTextWeight?: string | number | null;
  previewViewportWidth?: number;
};

type ActiveModalState = {
  serviceId: number;
  imageIndex: number;
} | null;

const SORT_OPTIONS = [
  { value: "default", label: "По умолчанию" },
  { value: "priceAsc", label: "Цена: по возрастанию" },
  { value: "priceDesc", label: "Цена: по убыванию" },
  { value: "nameAsc", label: "Название: А-Я" },
  { value: "nameDesc", label: "Название: Я-А" },
  { value: "durationAsc", label: "Длительность: меньше" },
  { value: "durationDesc", label: "Длительность: больше" },
] as const;

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function formatPrice(value: number) {
  return `${Number.isFinite(value) ? Math.round(value) : 0} ₽`;
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function opacityGradientFromColor(color: string, startOpacity: number, endOpacity: number) {
  return `linear-gradient(180deg, ${rgbaFromHex(color, clamp(startOpacity, 0, 100, 0) / 100)}, ${rgbaFromHex(
    color,
    clamp(endOpacity, 0, 100, 10) / 100
  )})`;
}

function clampPan(value: number, limit: number) {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(-limit, Math.min(limit, value));
}

function resolveGridClassName(
  cardsPerRow: number,
  mobileCardsPerRow: 1 | 2,
  previewViewportWidth?: number
) {
  if (typeof previewViewportWidth === "number" && Number.isFinite(previewViewportWidth)) {
    if (previewViewportWidth < 640) {
      return mobileCardsPerRow === 2 ? "grid-cols-2" : "grid-cols-1";
    }
    if (previewViewportWidth < 1280) {
      return cardsPerRow <= 1 ? "grid-cols-1" : "grid-cols-2";
    }
    if (cardsPerRow <= 1) return "grid-cols-1";
    if (cardsPerRow === 2) return "grid-cols-2";
    if (cardsPerRow === 4) return "grid-cols-4";
    if (cardsPerRow === 5) return "grid-cols-5";
    if (cardsPerRow === 6) return "grid-cols-6";
    return "grid-cols-3";
  }

  const mobile = mobileCardsPerRow === 2 ? "grid-cols-2" : "grid-cols-1";
  if (cardsPerRow <= 1) return `${mobile}`;
  if (cardsPerRow === 2) return `${mobile} md:grid-cols-2`;
  if (cardsPerRow === 5) return `${mobile} md:grid-cols-2 xl:grid-cols-5`;
  if (cardsPerRow === 6) return `${mobile} md:grid-cols-3 xl:grid-cols-6`;
  if (cardsPerRow === 4) return `${mobile} md:grid-cols-2 xl:grid-cols-4`;
  return `${mobile} md:grid-cols-2 xl:grid-cols-3`;
}

function useWindowViewportWidth() {
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateWidth = () => setWidth(window.innerWidth);
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return width;
}

function resolveArrowSize(size: "sm" | "md" | "lg") {
  if (size === "sm") return 34;
  if (size === "lg") return 52;
  return 42;
}

function alignmentToJustifyContent(alignment: "left" | "center" | "right") {
  if (alignment === "center") return "center";
  if (alignment === "right") return "flex-end";
  return "flex-start";
}

function alignmentToSmJustifyClass(alignment: "left" | "center" | "right") {
  if (alignment === "center") return "sm:justify-center";
  if (alignment === "right") return "sm:justify-end";
  return "sm:justify-start";
}

function textAlignToBlockMarginStyle(textAlign: CSSProperties["textAlign"]): CSSProperties {
  if (textAlign === "center") return { marginLeft: "auto", marginRight: "auto" };
  if (textAlign === "right") return { marginLeft: "auto", marginRight: 0 };
  return { marginLeft: 0, marginRight: "auto" };
}

function rgbaFromHex(hex: string, opacity: number) {
  const normalized = hex.trim().replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity, 0, 1, 1)})`;
}

function readableTextColor(backgroundColor: string, light = "#f8fafc", dark = "#111827") {
  const normalized = backgroundColor.trim().replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return light;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? dark : light;
}

function uniqueImageUrls(service: ServiceItem) {
  return Array.from(new Set([...(service.photoUrls ?? []), service.coverUrl ?? ""].filter(Boolean)));
}

type ModalTextStyle = CSSProperties & {
  "--modal-dark-color"?: string;
};

function ServiceModal({
  service,
  imageIndex,
  onClose,
  bookingHref,
  buttonStyle,
  buttonText,
  showDescription,
  showMeta,
  modalBackgroundColor,
  modalBackgroundImage,
  mediaColumns,
  infoColumns,
  imageFit,
  imageRadius,
  imageAspectRatio,
  controls,
  arrowSize,
  arrowColor,
  arrowHoverColor,
  arrowBgColor,
  arrowHoverBgColor,
  arrowBgOpacity,
  arrowHoverBgOpacity,
  arrowBorderEnabled,
  dotsSize,
  dotsColor,
  dotsActiveColor,
  dotsBorderWidth,
  thumbnailsPosition,
  infiniteGallery,
  imageZoomOnClick,
  imageZoomOnHover,
  categoryTextStyle,
  titleTextStyle,
  descriptionTextStyle,
  priceTextStyle,
  durationTextStyle,
  previewViewportWidth,
}: {
  service: ServiceItem;
  imageIndex: number;
  onClose: () => void;
  bookingHref: string | null;
  buttonStyle: CSSProperties;
  buttonText: string;
  showDescription: boolean;
  showMeta: boolean;
  galleryBgColor: string;
  modalBackgroundColor: string;
  modalBackgroundImage: string;
  mediaColumns: number;
  infoColumns: number;
  imageFit: "contain" | "cover";
  imageRadius: number;
  imageAspectRatio: string;
  controls: "arrowsAndDots" | "arrows" | "dots" | "thumbnails";
  arrowSize: "sm" | "md" | "lg";
  arrowThickness: number;
  arrowColor: string;
  arrowHoverColor: string;
  arrowBgColor: string;
  arrowHoverBgColor: string;
  arrowBgOpacity: number;
  arrowHoverBgOpacity: number;
  arrowBorderEnabled: boolean;
  dotsSize: number;
  dotsColor: string;
  dotsActiveColor: string;
  dotsBorderWidth: number;
  thumbnailsPosition: "bottom";
  infiniteGallery: boolean;
  imageZoomOnClick: boolean;
  imageZoomOnHover: boolean;
  categoryTextStyle: CSSProperties;
  titleTextStyle: CSSProperties;
  descriptionTextStyle: CSSProperties;
  priceTextStyle: CSSProperties;
  durationTextStyle: CSSProperties;
  previewViewportWidth?: number;
}) {
  const images = useMemo(() => uniqueImageUrls(service), [service]);
  const [activeImageIndex, setActiveImageIndex] = useState(
    Math.min(Math.max(imageIndex, 0), Math.max(images.length - 1, 0))
  );
  const [zoomLevel, setZoomLevel] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartPan, setDragStartPan] = useState({ x: 0, y: 0 });
  const [previewTopOffset, setPreviewTopOffset] = useState(56);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const windowViewportWidth = useWindowViewportWidth();
  const canNavigate = images.length > 1;
  const showArrows = controls === "arrows" || controls === "arrowsAndDots" || controls === "thumbnails";
  const showDots = controls === "dots" || controls === "arrowsAndDots";
  const showThumbnails = controls === "thumbnails" && images.length > 1 && thumbnailsPosition === "bottom";

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setActiveImageIndex(Math.min(Math.max(imageIndex, 0), Math.max(images.length - 1, 0)));
      setZoomLevel(0);
      setPan({ x: 0, y: 0 });
      setIsDraggingImage(false);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [imageIndex, images.length]);

  useEffect(() => {
    if (!isDraggingImage) return;
    const stopDragging = () => setIsDraggingImage(false);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("blur", stopDragging);
    return () => {
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("blur", stopDragging);
    };
  }, [isDraggingImage]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const previousPaddingLeft = document.body.style.paddingLeft;
    const scrollbarCompensation = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.overflow = "hidden";
    if (scrollbarCompensation > 0) {
      const right = parseFloat(previousPaddingRight || "0") || 0;
      const left = parseFloat(previousPaddingLeft || "0") || 0;
      document.body.style.paddingRight = `${right + scrollbarCompensation}px`;
      document.body.style.paddingLeft = `${left + scrollbarCompensation}px`;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" && canNavigate) {
        setActiveImageIndex((current) => {
          if (current >= images.length - 1) return infiniteGallery ? 0 : current;
          return current + 1;
        });
      }
      if (event.key === "ArrowLeft" && canNavigate) {
        setActiveImageIndex((current) => {
          if (current <= 0) return infiniteGallery ? images.length - 1 : current;
          return current - 1;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.body.style.paddingLeft = previousPaddingLeft;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canNavigate, images.length, infiniteGallery, onClose]);

  const goPrev = () => {
    setPan({ x: 0, y: 0 });
    setActiveImageIndex((current) => {
      if (current <= 0) return infiniteGallery ? images.length - 1 : current;
      return current - 1;
    });
  };
  const goNext = () => {
    setPan({ x: 0, y: 0 });
    setActiveImageIndex((current) => {
      if (current >= images.length - 1) return infiniteGallery ? 0 : current;
      return current + 1;
    });
  };

  const currentImage = images[activeImageIndex] ?? null;
  const isImageFocusMode = zoomLevel > 0;
  const hasPreviewViewport =
    typeof previewViewportWidth === "number" && Number.isFinite(previewViewportWidth);
  const effectiveModalViewportWidth = hasPreviewViewport ? previewViewportWidth : windowViewportWidth;
  const isMobileModal =
    typeof effectiveModalViewportWidth === "number" &&
    Number.isFinite(effectiveModalViewportWidth) &&
    effectiveModalViewportWidth < 640;

  useEffect(() => {
    if (!hasPreviewViewport || typeof window === "undefined") return;
    const updateTopOffset = () => {
      const toolbar = document.querySelector<HTMLElement>("[data-site-builder-toolbar='true']");
      const bottom = toolbar?.getBoundingClientRect().bottom;
      setPreviewTopOffset(Number.isFinite(bottom) ? Math.max(0, Math.round(bottom ?? 56)) : 56);
    };
    updateTopOffset();
    window.addEventListener("resize", updateTopOffset);
    window.addEventListener("scroll", updateTopOffset, true);
    return () => {
      window.removeEventListener("resize", updateTopOffset);
      window.removeEventListener("scroll", updateTopOffset, true);
    };
  }, [hasPreviewViewport]);

  const modalImageRadiusValue = clamp(imageRadius, 0, 80, 8);
  const zoomScale =
    zoomLevel <= 1 ? 1 : zoomLevel === 2 ? 1.35 : zoomLevel === 3 ? 1.8 : zoomLevel === 4 ? 2.3 : 2.9;
  const focusViewportWidth = hasPreviewViewport ? "calc(100% - 24px)" : "min(92vw, 1280px)";
  const focusViewportHeight = hasPreviewViewport
    ? `calc(100vh - ${previewTopOffset + 84}px)`
    : isMobileModal
      ? "calc(100vh - 84px)"
      : "calc(100vh - 112px)";
  const getPanBounds = () => {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return { x: 0, y: 0 };
    return {
      x: Math.max(0, (image.clientWidth * zoomScale - viewport.clientWidth) / 2),
      y: Math.max(0, (image.clientHeight * zoomScale - viewport.clientHeight) / 2),
    };
  };
  const arrowPx = resolveArrowSize(arrowSize);
  const arrowButtonBaseStyle: CSSProperties = {
    width: arrowPx,
    height: arrowPx,
    borderRadius: 999,
    border: arrowBorderEnabled ? `1px solid ${arrowColor}` : "1px solid transparent",
    color: arrowColor,
    backgroundColor: rgbaFromHex(arrowBgColor, arrowBgOpacity),
  };
  const clampedMediaColumns = clamp(mediaColumns, 1, 11, 6);
  const clampedInfoColumns = clamp(infoColumns, 1, 11, 6);
  const modalColumnsTotal = Math.max(2, clampedMediaColumns + clampedInfoColumns);
  const mediaWidthPercent = (clampedMediaColumns / modalColumnsTotal) * 100;
  const infoWidthPercent = (clampedInfoColumns / modalColumnsTotal) * 100;
  const modalChromeColor =
    typeof titleTextStyle.color === "string" && titleTextStyle.color.trim()
      ? titleTextStyle.color
      : "var(--block-text,var(--bp-ink))";
  const modalChromeButtonStyle: CSSProperties = { color: modalChromeColor };
  const modalShellStyle: CSSProperties = {
    backgroundColor: modalBackgroundColor,
    backgroundImage: modalBackgroundImage,
    ...(hasPreviewViewport
      ? {
          left: "50%",
          right: "auto",
          top: `${previewTopOffset}px`,
          width: `${previewViewportWidth}px`,
          height: `calc(100vh - ${previewTopOffset}px)`,
          maxWidth: "100vw",
          transform: "translateX(-50%)",
        }
      : isMobileModal
        ? {
            left: 0,
            right: "auto",
            width: "100dvw",
            maxWidth: "100dvw",
          }
        : {}),
  };
  const modalMediaStyle: CSSProperties = isMobileModal
    ? { flex: "0 0 auto", maxWidth: "100%", width: "100%" }
    : isImageFocusMode
      ? {}
      : { flex: `0 0 ${mediaWidthPercent}%`, maxWidth: `${mediaWidthPercent}%` };
  const modalInfoStyle: CSSProperties = isMobileModal
    ? { flex: "0 0 auto", maxWidth: "100%", width: "100%" }
    : { flex: `0 0 ${infoWidthPercent}%`, maxWidth: `${infoWidthPercent}%` };
  const mobileCategoryTextStyle: CSSProperties = isMobileModal
    ? { ...categoryTextStyle, fontSize: 12, lineHeight: 1.3 }
    : categoryTextStyle;
  const mobileTitleTextStyle: CSSProperties = isMobileModal
    ? { ...titleTextStyle, fontSize: 42, lineHeight: 1.08 }
    : titleTextStyle;
  const mobileDescriptionTextStyle: CSSProperties = isMobileModal
    ? { ...descriptionTextStyle, fontSize: 16, lineHeight: 1.45 }
    : descriptionTextStyle;
  const mobilePriceTextStyle: CSSProperties = isMobileModal
    ? { ...priceTextStyle, fontSize: 18, lineHeight: 1.25 }
    : priceTextStyle;
  const mobileDurationTextStyle: CSSProperties = isMobileModal
    ? { ...durationTextStyle, fontSize: 18, lineHeight: 1.25 }
    : durationTextStyle;

  return (
    <div
      className={`fixed bottom-0 top-0 z-[300] overflow-hidden bg-[color:var(--block-bg,var(--bp-paper))] ${
        hasPreviewViewport ? "" : isMobileModal ? "" : "left-0 right-0"
      }`}
      style={modalShellStyle}
    >
      <div
        className={`relative mx-auto flex w-full ${
          isMobileModal && !isImageFocusMode ? "flex-col items-stretch overflow-y-auto" : "items-center"
        } ${
          isImageFocusMode ? "max-w-none" : "max-w-[1600px]"
        } ${
          isImageFocusMode
            ? hasPreviewViewport
              ? "px-3 pb-3 pt-3"
              : "px-2 py-2 lg:px-3 lg:py-3"
            : isMobileModal
              ? "px-4 pb-8 pt-3"
              : "px-6 py-10 lg:px-10"
        } ${
          hasPreviewViewport ? "h-full min-h-0" : "min-h-screen"
        } ${isImageFocusMode ? (hasPreviewViewport ? "justify-start" : "justify-center") : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            if (zoomLevel > 0) {
              setZoomLevel(0);
              setPan({ x: 0, y: 0 });
              setIsDraggingImage(false);
              return;
            }
            onClose();
          }}
          className={`z-[310] font-light leading-none opacity-80 transition hover:opacity-100 ${
            hasPreviewViewport
              ? "absolute right-4 top-4 text-4xl"
              : "fixed right-8 top-6 text-5xl"
          }`}
          style={modalChromeButtonStyle}
          aria-label="Закрыть"
        >
          ×
        </button>

        {imageZoomOnClick && zoomLevel > 0 ? (
          <div
            className={`z-[310] flex items-center gap-4 ${
              hasPreviewViewport ? "absolute right-14 top-5" : "fixed right-24 top-8"
            }`}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPan({ x: 0, y: 0 });
                setZoomLevel((current) => (current <= 1 ? 1 : ((current - 1) as 0 | 1 | 2 | 3 | 4 | 5)));
              }}
              className="inline-flex items-center justify-center text-4xl leading-none opacity-80 transition hover:opacity-100 disabled:opacity-30"
              style={modalChromeButtonStyle}
              aria-label="Уменьшить"
              disabled={zoomLevel <= 1}
            >
              −
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPan({ x: 0, y: 0 });
                setZoomLevel((current) => (current === 5 ? 5 : ((current + 1) as 0 | 1 | 2 | 3 | 4 | 5)));
              }}
              className="inline-flex items-center justify-center text-4xl leading-none opacity-80 transition hover:opacity-100 disabled:opacity-30"
              style={modalChromeButtonStyle}
              aria-label="Увеличить"
              disabled={zoomLevel === 5}
            >
              +
            </button>
          </div>
        ) : null}

        <div
          className={`relative flex items-center justify-center ${
            isImageFocusMode
              ? "min-h-0 flex-1 p-0"
              : isMobileModal
                ? "min-h-0 w-full p-0"
                : "min-h-[70vh] flex-1 p-8"
          }`}
          style={modalMediaStyle}
        >
          {showArrows && canNavigate ? (
            <button
              type="button"
              onClick={goPrev}
              className="group absolute left-6 top-1/2 z-10 -translate-y-1/2 transition"
              style={arrowButtonBaseStyle}
              aria-label="Предыдущее изображение"
            >
              <span
                className="block transition group-hover:scale-105"
                style={{
                  color: arrowColor,
                  lineHeight: 1,
                  fontSize: Math.round(arrowPx * 0.52),
                  fontWeight: 500,
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = arrowHoverColor || arrowColor;
                  event.currentTarget.parentElement!.style.backgroundColor = rgbaFromHex(
                    arrowHoverBgColor || arrowBgColor,
                    arrowHoverBgOpacity
                  );
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = arrowColor;
                  event.currentTarget.parentElement!.style.backgroundColor = rgbaFromHex(
                    arrowBgColor,
                    arrowBgOpacity
                  );
                }}
              >
                ‹
              </span>
            </button>
          ) : null}

          <div
            ref={viewportRef}
            className="relative mx-auto flex items-center justify-center overflow-hidden rounded-[8px]"
            style={{
              width: isImageFocusMode ? focusViewportWidth : isMobileModal ? "100%" : "min(62vw, 820px)",
              height: isImageFocusMode ? focusViewportHeight : isMobileModal ? "auto" : "min(72vh, 820px)",
              aspectRatio: !isImageFocusMode ? imageAspectRatio : undefined,
              borderRadius: zoomLevel > 1 ? 0 : modalImageRadiusValue,
            }}
            onMouseDown={(event) => {
              if (zoomLevel <= 1 || event.button !== 0) return;
              setIsDraggingImage(true);
              setDragStart({ x: event.clientX, y: event.clientY });
              setDragStartPan(pan);
            }}
            onMouseMove={(event) => {
              if (!isDraggingImage) return;
              if ((event.buttons & 1) !== 1) {
                setIsDraggingImage(false);
                return;
              }
              const dx = event.clientX - dragStart.x;
              const dy = event.clientY - dragStart.y;
              const panBounds = getPanBounds();
              setPan({
                x: clampPan(dragStartPan.x + dx, panBounds.x),
                y: clampPan(dragStartPan.y + dy, panBounds.y),
              });
            }}
            onMouseUp={() => setIsDraggingImage(false)}
            onMouseLeave={() => setIsDraggingImage(false)}
          >
            {currentImage ? (
              <UnoptimizedImage
                ref={imageRef}
                src={currentImage}
                alt={service.name}
                draggable={false}
                className={`${isImageFocusMode ? "max-h-full max-w-full" : "h-full w-full"} transition duration-300 ${
                  imageZoomOnHover && zoomLevel === 0 ? "hover:scale-[1.04]" : ""
                }`}
                style={{
                  objectFit: isImageFocusMode ? "contain" : imageFit,
                  objectPosition: "center center",
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
                  transformOrigin: "center center",
                  transition: isDraggingImage ? "none" : "transform 120ms ease-out",
                  cursor:
                    imageZoomOnClick
                      ? zoomLevel === 0
                        ? "zoom-in"
                        : zoomLevel > 1
                          ? isDraggingImage
                            ? "grabbing"
                            : "grab"
                          : "default"
                      : "default",
                }}
                onClick={() => {
                  if (!imageZoomOnClick) return;
                  if (zoomLevel === 0) {
                    setPan({ x: 0, y: 0 });
                    setZoomLevel(1);
                  }
                }}
                onDragStart={(event) => event.preventDefault()}
                onLoad={() => setPan({ x: 0, y: 0 })}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-[color:var(--block-muted,var(--bp-muted))]">
                Нет изображения
              </div>
            )}
          </div>

          {showArrows && canNavigate ? (
            <button
              type="button"
              onClick={goNext}
              className="group absolute right-6 top-1/2 z-10 -translate-y-1/2 transition"
              style={arrowButtonBaseStyle}
              aria-label="Следующее изображение"
            >
              <span
                className="block transition group-hover:scale-105"
                style={{
                  color: arrowColor,
                  lineHeight: 1,
                  fontSize: Math.round(arrowPx * 0.52),
                  fontWeight: 500,
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = arrowHoverColor || arrowColor;
                  event.currentTarget.parentElement!.style.backgroundColor = rgbaFromHex(
                    arrowHoverBgColor || arrowBgColor,
                    arrowHoverBgOpacity
                  );
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = arrowColor;
                  event.currentTarget.parentElement!.style.backgroundColor = rgbaFromHex(
                    arrowBgColor,
                    arrowBgOpacity
                  );
                }}
              >
                ›
              </span>
            </button>
          ) : null}
        </div>

        {!isImageFocusMode ? (
        <div
          className={`flex w-full flex-col ${isMobileModal ? "pt-5" : "py-2"}`}
          style={modalInfoStyle}
        >
          <div className="service-modal-text uppercase tracking-[0.18em]" style={mobileCategoryTextStyle}>
            {service.categoryName || "Услуга"}
          </div>
          <h3 className="service-modal-text mt-3 leading-tight" style={mobileTitleTextStyle}>{service.name}</h3>

          {showMeta ? (
            <div className={`${isMobileModal ? "mt-4" : "mt-6"} flex flex-wrap items-center gap-4`}>
              <span className="service-modal-text" style={mobilePriceTextStyle}>от {formatPrice(service.basePrice)}</span>
              <span className="service-modal-text" style={mobileDurationTextStyle}>от {service.baseDurationMin} мин</span>
            </div>
          ) : null}

          {bookingHref ? (
            <a href={bookingHref} className={`${isMobileModal ? "mt-5" : "mt-8"} inline-flex w-fit items-center justify-center px-6 py-3 text-base`} style={buttonStyle}>
              {buttonText}
            </a>
          ) : null}

          {showDescription && service.description ? (
            <p className={`service-modal-text ${isMobileModal ? "mt-6" : "mt-10 leading-8"}`} style={mobileDescriptionTextStyle}>{service.description}</p>
          ) : null}

          {showThumbnails ? (
            <div className="mt-8 grid grid-cols-5 gap-3">
              {images.map((url, idx) => (
                <button
                  key={`${service.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveImageIndex(idx);
                    setZoomLevel(0);
                  }}
                  className="overflow-hidden rounded-[12px] border"
                  style={{
                    borderColor: idx === activeImageIndex ? "var(--bp-ink)" : "rgba(15,16,18,0.12)",
                  }}
                >
                  <div className="aspect-square">
                    <UnoptimizedImage src={url} alt="" className="h-full w-full object-cover" />
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {showDots && images.length > 1 ? (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              {images.map((_, idx) => (
                <button
                  key={`${service.id}-dot-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveImageIndex(idx);
                    setZoomLevel(0);
                  }}
                  className="rounded-full transition"
                  style={{
                    width: dotsSize * 2,
                    height: dotsSize * 2,
                    backgroundColor: idx === activeImageIndex ? dotsActiveColor : dotsColor,
                    border: `${Math.max(0, dotsBorderWidth)}px solid ${dotsColor}`,
                  }}
                  aria-label={`Изображение ${idx + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
        ) : null}
      </div>
    </div>
  );
}

export function ServicesCatalog({
  variant,
  listView,
  title,
  subtitle,
  items,
  publicSlug,
  publicBasePath,
  currentLocationId,
  locationId,
  locations,
  effectiveSpecialistId,
  cardsPerRow,
  showCategoryTabs,
  categoryAllLabel,
  showSearch,
  searchPlaceholder,
  showSort,
  defaultSort,
  searchSortAlignment,
  filtersAlignment,
  categoryTextColor,
  categoryActiveColor,
  sortTextColor,
  sortActiveColor,
  locationTextColor,
  locationActiveColor,
  categoryTextColorDark,
  categoryActiveColorDark,
  sortTextColorDark,
  sortActiveColorDark,
  locationTextColorDark,
  locationActiveColorDark,
  themeMode,
  showPrice,
  showDuration,
  showButton,
  buttonText,
  buttonAlignment = "center",
  detailsButtonText,
  detailsButtonColor,
  detailsButtonTextColor,
  detailsButtonBorderColor,
  detailsButtonColorDark,
  detailsButtonTextColorDark,
  detailsButtonBorderColorDark,
  servicePageButtonMode,
  cardStyle,
  cardBackgroundColorLight,
  cardBackgroundImageLight,
  cardBackgroundColorDark,
  cardBackgroundImageDark,
  cardLiquidGlass = false,
  cardBackgroundStartOpacityLight,
  cardBackgroundEndOpacityLight,
  cardBackgroundStartOpacityDark,
  cardBackgroundEndOpacityDark,
  cardGapX,
  cardGapY,
  imageAspectRatio,
  serviceCardImageFit = "cover",
  imageRadius,
  cardPaddingX,
  cardPaddingY,
  mobileCardsPerRow,
  showSecondImageOnHover,
  imageZoomOnHover,
  alignButtonsBottom,
  modalImageClickEnabled,
  serviceModalShowDescription,
  serviceModalShowMeta,
  serviceModalBgColor,
  serviceModalBgColorDark,
  serviceModalBgImage,
  serviceModalBgImageDark,
  serviceModalMediaColumns,
  serviceModalInfoColumns,
  modalGalleryBgColor,
  modalImageFit,
  modalImageRadius,
  modalImageAspectRatio,
  modalControls,
  modalArrowSize,
  modalArrowThickness,
  modalArrowColor,
  modalArrowHoverColor,
  modalArrowBgColor,
  modalArrowHoverBgColor,
  modalArrowBgOpacity,
  modalArrowHoverBgOpacity,
  modalArrowBorderEnabled,
  modalDotsSize,
  modalDotsColor,
  modalDotsActiveColor,
  modalDotsBorderWidth,
  modalThumbnailsPosition,
  modalInfiniteGallery,
  modalImageZoomOnClick,
  modalImageZoomOnHover,
  modalCategoryTextStyle,
  modalTitleTextStyle,
  modalDescriptionTextStyle,
  modalPriceTextStyle,
  modalDurationTextStyle,
  maxVisibleItems,
  usePagination,
  headingStyle,
  subheadingStyle,
  buttonStyle,
  detailsButtonStyle,
  textAlign = "left",
  ratingAlignment = "right",
  ratingVerticalAlignment,
  ratingTextColor = "#111827",
  ratingTextColorDark,
  ratingStarColor = "#ffb020",
  ratingStarColorDark,
  ratingBackgroundColor = "transparent",
  ratingBackgroundColorDark,
  ratingBackgroundOpacity = 50,
  ratingBackgroundRadius = 0,
  ratingTextSize = 16,
  ratingTextFont = "Manrope",
  ratingTextWeight,
  previewViewportWidth,
}: ServiceCatalogProps) {
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const isEditorial = variant === "v1";
  const isListView = listView === "list";
  const [activeThemeMode, setActiveThemeMode] = useState<"light" | "dark">(
    themeMode === "dark" ? "dark" : "light"
  );
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const availableLocations = locations.filter((location) =>
    items.some((item) => item.locationIds.includes(location.id))
  );
  const showLocationFilter = !currentLocationId && !locationId && availableLocations.length > 0;
  const effectiveLocationId = currentLocationId ?? locationId ?? selectedLocationId;
  const scopedItems = effectiveLocationId
    ? items.filter((item) => item.locationIds.includes(effectiveLocationId))
    : items;
  const categories = Array.from(
    new Set(
      scopedItems
        .map((item) => item.categoryName?.trim() ?? "")
        .filter((value) => value.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right, "ru"));
  const [activeCategory, setActiveCategory] = useState<string>("__all__");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState(defaultSort);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [areMobileFiltersOpen, setAreMobileFiltersOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModalState>(null);
  const pageSize = clamp(maxVisibleItems, 1, 100, 8);
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setSortMode(defaultSort);
      setIsSortOpen(false);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [defaultSort]);

  useEffect(() => {
    if (areMobileFiltersOpen) return;
    const raf = window.requestAnimationFrame(() => {
      setIsSortOpen(false);
      setIsLocationOpen(false);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [areMobileFiltersOpen]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setActiveCategory("__all__"));
    return () => window.cancelAnimationFrame(raf);
  }, [selectedLocationId]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setPage(1);
      setVisibleCount(pageSize);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeCategory, selectedLocationId, searchQuery, sortMode, pageSize, usePagination]);

  const activeSortOption =
    SORT_OPTIONS.find((option) => option.value === sortMode) ?? SORT_OPTIONS[0]!;
  const activeLocationOption = selectedLocationId
    ? availableLocations.find((location) => location.id === selectedLocationId)
    : null;
  const pickThemeColor = (light?: string, dark?: string, fallback = "var(--block-text,var(--bp-ink))") =>
    activeThemeMode === "dark" ? dark || light || fallback : light || dark || fallback;
  const resolvedCategoryTextColor = pickThemeColor(categoryTextColor, categoryTextColorDark);
  const resolvedCategoryActiveColor = pickThemeColor(categoryActiveColor, categoryActiveColorDark);
  const resolvedSortTextColor = pickThemeColor(sortTextColor, sortTextColorDark);
  const resolvedSortActiveColor = pickThemeColor(
    sortActiveColor,
    sortActiveColorDark,
    resolvedCategoryActiveColor
  );
  const resolvedLocationTextColor = pickThemeColor(locationTextColor, locationTextColorDark, resolvedSortTextColor);
  const resolvedLocationActiveColor = pickThemeColor(
    locationActiveColor,
    locationActiveColorDark,
    resolvedSortActiveColor
  );
  const resolvedDetailsButtonColor =
    activeThemeMode === "dark"
      ? detailsButtonColorDark || detailsButtonColor || "transparent"
      : detailsButtonColor || "transparent";
  const resolvedDetailsButtonTextColor =
    activeThemeMode === "dark"
      ? detailsButtonTextColorDark || detailsButtonTextColor || "var(--block-text,var(--bp-ink))"
      : detailsButtonTextColor || "var(--block-text,var(--bp-ink))";
  const resolvedDetailsButtonBorderColor =
    activeThemeMode === "dark"
      ? detailsButtonBorderColorDark || detailsButtonBorderColor || "var(--block-border,transparent)"
      : detailsButtonBorderColor || "var(--block-border,transparent)";
  const resolvedServiceModalBgColor =
    activeThemeMode === "dark"
      ? serviceModalBgColorDark || serviceModalBgColor || "var(--block-bg,var(--bp-paper))"
      : serviceModalBgColor || "var(--block-bg,var(--bp-paper))";
  const resolvedServiceModalBgImage =
    activeThemeMode === "dark"
      ? serviceModalBgImageDark || serviceModalBgImage || "none"
      : serviceModalBgImage || "none";
  const resolvedCardBackgroundColor = pickThemeColor(
    cardBackgroundColorLight,
    cardBackgroundColorDark,
    "var(--block-sub-bg,var(--bp-paper))"
  );
  const resolvedCardBackgroundImage =
    activeThemeMode === "dark"
      ? cardBackgroundImageDark || cardBackgroundImageLight || "none"
      : cardBackgroundImageLight || cardBackgroundImageDark || "none";
  const cardBackgroundStartOpacity =
    activeThemeMode === "dark"
      ? Number.isFinite(Number(cardBackgroundStartOpacityDark))
        ? Number(cardBackgroundStartOpacityDark)
        : Number.isFinite(Number(cardBackgroundStartOpacityLight))
          ? Number(cardBackgroundStartOpacityLight)
          : 0
      : Number.isFinite(Number(cardBackgroundStartOpacityLight))
        ? Number(cardBackgroundStartOpacityLight)
        : Number.isFinite(Number(cardBackgroundStartOpacityDark))
          ? Number(cardBackgroundStartOpacityDark)
          : 0;
  const cardBackgroundEndOpacity =
    activeThemeMode === "dark"
      ? Number.isFinite(Number(cardBackgroundEndOpacityDark))
        ? Number(cardBackgroundEndOpacityDark)
        : Number.isFinite(Number(cardBackgroundEndOpacityLight))
          ? Number(cardBackgroundEndOpacityLight)
          : 10
      : Number.isFinite(Number(cardBackgroundEndOpacityLight))
        ? Number(cardBackgroundEndOpacityLight)
        : Number.isFinite(Number(cardBackgroundEndOpacityDark))
          ? Number(cardBackgroundEndOpacityDark)
          : 10;
  const cardPanelBackgroundImage = opacityGradientFromColor(
    resolvedCardBackgroundColor,
    cardBackgroundStartOpacity,
    cardBackgroundEndOpacity
  );
  const panelBackgroundStartOpacity = clamp(cardBackgroundStartOpacity, 0, 100, 0) / 100;
  const panelBackgroundEndOpacity = clamp(cardBackgroundEndOpacity, 0, 100, 10) / 100;
  const softPanelBackgroundImage = `linear-gradient(180deg, ${rgbaFromHex(
    resolvedCardBackgroundColor,
    0
  )} 0%, ${rgbaFromHex(resolvedCardBackgroundColor, panelBackgroundStartOpacity * 0.45)} 24%, ${rgbaFromHex(
    resolvedCardBackgroundColor,
    panelBackgroundStartOpacity
  )} 44%, ${rgbaFromHex(resolvedCardBackgroundColor, panelBackgroundEndOpacity)} 100%)`;
  const photoPanelColorOverlayImage = `linear-gradient(180deg, ${rgbaFromHex(
    resolvedCardBackgroundColor,
    0
  )} 0%, ${rgbaFromHex(resolvedCardBackgroundColor, 0)} 44%, ${rgbaFromHex(
    resolvedCardBackgroundColor,
    panelBackgroundStartOpacity * 0.28
  )} 58%, ${rgbaFromHex(resolvedCardBackgroundColor, panelBackgroundStartOpacity)} 76%, ${rgbaFromHex(
    resolvedCardBackgroundColor,
    panelBackgroundEndOpacity
  )} 100%)`;
  const photoPanelBlurMaskImage =
    "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 44%, rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.72) 76%, rgba(0,0,0,1) 100%)";
  const glassPanelFeather = 104;
  const resolveModalTextStyle = (style: CSSProperties): CSSProperties => {
    const nextStyle = { ...(style as ModalTextStyle) };
    const darkColor = nextStyle["--modal-dark-color"];
    delete nextStyle["--modal-dark-color"];
    if (activeThemeMode === "dark" && typeof darkColor === "string" && darkColor.trim()) {
      nextStyle.color = darkColor;
    }
    return nextStyle;
  };
  const resolvedModalCategoryTextStyle = resolveModalTextStyle(modalCategoryTextStyle);
  const resolvedModalTitleTextStyle = resolveModalTextStyle(modalTitleTextStyle);
  const resolvedModalDescriptionTextStyle = resolveModalTextStyle(modalDescriptionTextStyle);
  const resolvedModalPriceTextStyle = resolveModalTextStyle(modalPriceTextStyle);
  const resolvedModalDurationTextStyle = resolveModalTextStyle(modalDurationTextStyle);
  const isDarkTheme = activeThemeMode === "dark";
  const resolvedRatingTextColor = isDarkTheme ? ratingTextColorDark || ratingTextColor : ratingTextColor;
  const resolvedRatingStarColor = isDarkTheme ? ratingStarColorDark || ratingStarColor : ratingStarColor;
  const resolvedRatingBackgroundColor = isDarkTheme
    ? ratingBackgroundColorDark || ratingBackgroundColor
    : ratingBackgroundColor;
  const ratingOverlayClassName =
    ratingAlignment === "left"
      ? "left-3 justify-start"
      : ratingAlignment === "center"
        ? "left-1/2 -translate-x-1/2 justify-center"
        : "right-3 justify-end";
  const resolvedRatingVerticalAlignment =
    imageAspectRatio === "original" ? "top" : (ratingVerticalAlignment ?? "bottom");
  const ratingOverlayVerticalClassName = resolvedRatingVerticalAlignment === "top" ? "top-3" : "bottom-3";
  const ratingWeight = ratingTextWeight === "" || ratingTextWeight == null ? undefined : ratingTextWeight;
  const controlBorderColor = isDarkTheme ? "rgba(242,243,245,0.18)" : "rgba(15,16,18,0.12)";
  const controlBackgroundColor = isDarkTheme ? "rgba(31,36,44,0.92)" : "rgba(255,255,255,0.78)";
  const dropdownBackgroundColor = isDarkTheme ? "rgba(18,22,28,0.98)" : "rgba(255,255,255,0.98)";
  const optionHoverColor = isDarkTheme ? "rgba(242,243,245,0.08)" : "rgba(15,16,18,0.04)";
  const controlShadow = isDarkTheme
    ? "0 1px 2px rgba(0,0,0,0.24)"
    : "0 1px 2px rgba(15,16,18,0.04)";
  const dropdownShadow = isDarkTheme
    ? "0 14px 34px rgba(0,0,0,0.34)"
    : "0 14px 34px rgba(15,16,18,0.14)";
  const selectedSortTextColor = readableTextColor(resolvedSortActiveColor);
  const searchSortJustifyContent = alignmentToJustifyContent(searchSortAlignment);
  const filtersJustifyContent = alignmentToJustifyContent(filtersAlignment);
  const buttonJustifyContent = alignmentToJustifyContent(buttonAlignment);
  const headingBlockMarginStyle = textAlignToBlockMarginStyle(headingStyle.textAlign);
  const subheadingBlockMarginStyle = textAlignToBlockMarginStyle(subheadingStyle.textAlign);
  const serviceCardTitleStyle: CSSProperties = {
    ...subheadingStyle,
    color: "var(--block-text,var(--bp-ink))",
    fontWeight: 600,
  };
  const serviceCardTextStyle: CSSProperties = {
    color: "var(--block-muted,var(--bp-muted))",
    fontSize: "var(--block-text-size)",
  };
  const serviceCardButtonTextStyle: CSSProperties = {
    fontSize: "var(--block-text-size)",
  };
  const effectiveViewportWidth =
    typeof previewViewportWidth === "number" && Number.isFinite(previewViewportWidth)
      ? previewViewportWidth
      : undefined;
  const hasPreviewViewport =
    typeof effectiveViewportWidth === "number" && Number.isFinite(effectiveViewportWidth);
  const isNarrowPreviewViewport = hasPreviewViewport && effectiveViewportWidth < 640;
  const searchControlsClassName = hasPreviewViewport
    ? `${isNarrowPreviewViewport && !areMobileFiltersOpen ? "hidden" : "flex"} w-full gap-3 ${
        isNarrowPreviewViewport ? "flex-col" : "flex-row items-center"
      }`
    : `${areMobileFiltersOpen ? "flex" : "hidden"} w-full flex-col gap-3 sm:flex sm:flex-row sm:items-center`;
  const mobileFiltersToggleClassName = hasPreviewViewport
    ? `${isNarrowPreviewViewport ? "flex" : "hidden"} h-[44px] w-full items-center justify-between gap-3 text-left text-sm transition`
    : "flex h-[44px] w-full items-center justify-between gap-3 text-left text-sm transition sm:hidden";
  const categoryTabsGapClassName = isEditorial ? "gap-3" : "gap-2";
  const categoryTabsClassName = hasPreviewViewport
    ? `mt-6 flex max-w-full ${categoryTabsGapClassName} ${
        isNarrowPreviewViewport
          ? "flex-nowrap justify-start overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:thin] [scrollbar-color:var(--block-border,var(--bp-stroke))_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--block-border,var(--bp-stroke))]"
          : "flex-wrap"
      }`
    : `mt-6 flex max-w-full flex-nowrap justify-start overflow-x-auto overflow-y-hidden pb-1 ${categoryTabsGapClassName} ${alignmentToSmJustifyClass(
        filtersAlignment
      )} [scrollbar-width:thin] [scrollbar-color:var(--block-border,var(--bp-stroke))_transparent] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--block-border,var(--bp-stroke))]`;
  const categoryTabsStyle: CSSProperties | undefined =
    hasPreviewViewport && !isNarrowPreviewViewport
      ? { justifyContent: filtersJustifyContent }
      : undefined;
  const searchInputClassName = hasPreviewViewport
    ? `relative block h-[44px] min-w-0 text-sm transition ${
        isNarrowPreviewViewport ? "w-full" : "w-[320px]"
      }`
    : "relative block h-[44px] min-w-0 text-sm transition sm:w-[320px]";
  const selectControlClassName = hasPreviewViewport
    ? `relative min-w-0 ${isNarrowPreviewViewport ? "w-full" : "w-[250px]"}`
    : "relative min-w-0 sm:w-[250px]";

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setActiveThemeMode(themeMode === "dark" ? "dark" : "light"));
    return () => window.cancelAnimationFrame(raf);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resolveModeFromDom = () => {
      const scopedRoot =
        catalogRef.current?.closest("[data-site-theme]") ??
        document.getElementById("public-site-root") ??
        document.documentElement;
      const mode = scopedRoot.getAttribute("data-site-theme");
      if (mode === "light" || mode === "dark") {
        setActiveThemeMode(mode);
      }
    };
    resolveModeFromDom();
    const onThemeChange = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: string }>).detail?.mode;
      if (mode === "light" || mode === "dark") {
        setActiveThemeMode(mode);
        return;
      }
      resolveModeFromDom();
    };
    window.addEventListener("site-theme-change", onThemeChange as EventListener);
    const observedRoot =
      catalogRef.current?.closest("[data-site-theme]") ??
      document.getElementById("public-site-root") ??
      document.documentElement;
    const observer = new MutationObserver(resolveModeFromDom);
    observer.observe(observedRoot, { attributes: true, attributeFilter: ["data-site-theme"] });
    return () => {
      window.removeEventListener("site-theme-change", onThemeChange as EventListener);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeCategory === "__all__") return;
    if (categories.includes(activeCategory)) return;
    const raf = window.requestAnimationFrame(() => setActiveCategory("__all__"));
    return () => window.cancelAnimationFrame(raf);
  }, [activeCategory, categories]);

  const filteredItems = scopedItems
    .filter((item) => {
      if (activeCategory === "__all__") return true;
      return (item.categoryName?.trim() ?? "") === activeCategory;
    })
    .filter((item) => {
      const query = normalizeText(searchQuery);
      if (!query) return true;
      return [item.name, item.description ?? "", item.categoryName ?? ""].some((value) =>
        normalizeText(value).includes(query)
      );
    })
    .slice()
    .sort((left, right) => {
      switch (sortMode) {
        case "priceAsc":
          return left.basePrice - right.basePrice;
        case "priceDesc":
          return right.basePrice - left.basePrice;
        case "nameAsc":
          return left.name.localeCompare(right.name, "ru");
        case "nameDesc":
          return right.name.localeCompare(left.name, "ru");
        case "durationAsc":
          return left.baseDurationMin - right.baseDurationMin;
        case "durationDesc":
          return right.baseDurationMin - left.baseDurationMin;
        default:
          return 0;
      }
    });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const displayItems = usePagination
    ? filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredItems.slice(0, visibleCount);

  const activeModalService = activeModal
    ? displayItems.find((item) => item.id === activeModal.serviceId) ??
      scopedItems.find((item) => item.id === activeModal.serviceId) ??
      null
    : null;
  const basePath =
    typeof publicBasePath === "string"
      ? publicBasePath.replace(/\/$/, "")
      : publicSlug
        ? `/${publicSlug}`
        : "#";
  const activeModalBookingHref =
    activeModalService && publicSlug
      ? buildBookingLink({
          publicSlug,
          publicBasePath: basePath,
          locationId:
            effectiveLocationId ??
            (activeModalService.locationIds.length === 1 ? activeModalService.locationIds[0] : null),
          specialistId: effectiveSpecialistId,
          serviceId: activeModalService.id,
          scenario: "serviceFirst",
        })
      : null;

  return (
    <div ref={catalogRef} className="bp-services-catalog">
      <div
        className={`flex flex-col gap-6 ${variant === "v2" ? "xl:flex-row xl:items-end xl:justify-between" : ""}`}
      >
        {title || subtitle ? (
          <div className="w-full">
            {title ? (
              <h3
                className={`${isEditorial ? "max-w-2xl" : "max-w-3xl"} font-semibold`}
                style={{ ...headingStyle, ...headingBlockMarginStyle }}
              >
                {title}
              </h3>
            ) : null}
            {subtitle ? (
            <p
              className={`${title ? "mt-3" : ""} ${isEditorial ? "max-w-2xl" : "max-w-3xl"} text-[color:var(--bp-muted)]`}
              style={{ ...subheadingStyle, ...subheadingBlockMarginStyle }}
            >
              {subtitle}
            </p>
            ) : null}
          </div>
        ) : null}

        {(showSearch || showSort || showLocationFilter) && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setAreMobileFiltersOpen((open) => !open)}
              className={mobileFiltersToggleClassName}
              style={{
                border: "none",
                borderBottom: `1px solid ${
                  areMobileFiltersOpen ? "transparent" : controlBorderColor
                }`,
                borderRadius: 0,
                backgroundColor: "transparent",
                color: resolvedSortTextColor,
                padding: "0 0 10px",
                boxShadow: "none",
                fontSize: "var(--block-text-size)",
              }}
              aria-expanded={areMobileFiltersOpen}
            >
              <span className="truncate">Поиск</span>
              <span className="shrink-0 text-[11px] leading-none text-[color:var(--block-muted,var(--bp-muted))]">
                {areMobileFiltersOpen ? "▴" : "▾"}
              </span>
            </button>

            <div
              className={`${searchControlsClassName} ${areMobileFiltersOpen ? "mt-3" : ""} sm:mt-0`}
              style={{ justifyContent: searchSortJustifyContent }}
            >
              {showSearch ? (
                <label
                  className={searchInputClassName}
                >
                  <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[15px] leading-none text-[color:var(--block-muted,var(--bp-muted))]">
                    ⌕
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-full w-full min-w-0 py-0 pl-9 pr-3.5 text-sm leading-none text-[color:var(--block-text,var(--bp-ink))] outline-none placeholder:text-[color:var(--block-muted,var(--bp-muted))]"
                    style={{
                      appearance: "none",
                      border: `1px solid ${controlBorderColor}`,
                      borderRadius: 12,
                      backgroundColor: controlBackgroundColor,
                      boxShadow: controlShadow,
                      fontSize: "var(--block-text-size)",
                    }}
                  />
                </label>
              ) : null}

              {showSort ? (
                <div
                  className={selectControlClassName}
                  onBlur={(event) => {
                    const nextFocusedElement = event.relatedTarget as Node | null;
                    if (!nextFocusedElement || !event.currentTarget.contains(nextFocusedElement)) {
                      setIsSortOpen(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsSortOpen((open) => !open)}
                    className="flex h-[44px] w-full items-center justify-between gap-3 text-left text-sm transition"
                    style={{
                      border: `1px solid ${controlBorderColor}`,
                      borderRadius: 12,
                      backgroundColor: controlBackgroundColor,
                      color: resolvedSortTextColor,
                      padding: "0 12px 0 14px",
                      boxShadow: controlShadow,
                      fontSize: "var(--block-text-size)",
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={isSortOpen}
                  >
                    <span className="truncate">{activeSortOption.label}</span>
                    <span className="shrink-0 text-[11px] leading-none text-[color:var(--block-muted,var(--bp-muted))]">
                      ▾
                    </span>
                  </button>

                  {isSortOpen ? (
                    <div
                      className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden py-1 text-sm"
                      style={{
                        border: `1px solid ${controlBorderColor}`,
                        borderRadius: 12,
                        backgroundColor: dropdownBackgroundColor,
                        color: resolvedSortTextColor,
                        boxShadow: dropdownShadow,
                        fontSize: "var(--block-text-size)",
                      }}
                      role="listbox"
                    >
                      {SORT_OPTIONS.map((option) => {
                        const isSelected = option.value === sortMode;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSortMode(option.value);
                              setIsSortOpen(false);
                            }}
                            className="block w-full px-3.5 py-2.5 text-left transition"
                            onMouseEnter={(event) => {
                              if (!isSelected) event.currentTarget.style.backgroundColor = optionHoverColor;
                            }}
                            onMouseLeave={(event) => {
                              if (!isSelected) event.currentTarget.style.backgroundColor = "transparent";
                            }}
                            style={{
                              backgroundColor: isSelected
                                ? resolvedSortActiveColor
                                : "transparent",
                              color: isSelected
                                ? selectedSortTextColor
                                : resolvedSortTextColor,
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {showLocationFilter ? (
                <div
                  className={selectControlClassName}
                  onBlur={(event) => {
                    const nextFocusedElement = event.relatedTarget as Node | null;
                    if (!nextFocusedElement || !event.currentTarget.contains(nextFocusedElement)) {
                      setIsLocationOpen(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsLocationOpen((open) => !open)}
                    className="flex h-[44px] w-full items-center justify-between gap-3 text-left text-sm transition"
                    style={{
                      border: `1px solid ${controlBorderColor}`,
                      borderRadius: 12,
                      backgroundColor: controlBackgroundColor,
                      color: resolvedLocationTextColor,
                      padding: "0 12px 0 14px",
                      boxShadow: controlShadow,
                      fontSize: "var(--block-text-size)",
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={isLocationOpen}
                  >
                    <span className="truncate">{activeLocationOption?.name ?? "Все локации"}</span>
                    <span className="shrink-0 text-[11px] leading-none text-[color:var(--block-muted,var(--bp-muted))]">
                      ▾
                    </span>
                  </button>

                  {isLocationOpen ? (
                    <div
                      className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden py-1 text-sm"
                      style={{
                        border: `1px solid ${controlBorderColor}`,
                        borderRadius: 12,
                        backgroundColor: dropdownBackgroundColor,
                        color: resolvedLocationTextColor,
                        boxShadow: dropdownShadow,
                        fontSize: "var(--block-text-size)",
                      }}
                      role="listbox"
                    >
                      {[{ id: null, name: "Все локации" }, ...availableLocations].map((location) => {
                        const isSelected = location.id === selectedLocationId;
                        return (
                          <button
                            key={location.id ?? "all"}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSelectedLocationId(location.id);
                              setIsLocationOpen(false);
                            }}
                            className="block w-full px-3.5 py-2.5 text-left transition"
                            onMouseEnter={(event) => {
                              if (!isSelected) event.currentTarget.style.backgroundColor = optionHoverColor;
                            }}
                            onMouseLeave={(event) => {
                              if (!isSelected) event.currentTarget.style.backgroundColor = "transparent";
                            }}
                            style={{
                              backgroundColor: isSelected ? resolvedLocationActiveColor : "transparent",
                              color: isSelected ? readableTextColor(resolvedLocationActiveColor) : resolvedLocationTextColor,
                            }}
                          >
                            {location.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {showCategoryTabs && categories.length > 0 ? (
        <div className={categoryTabsClassName} style={categoryTabsStyle}>
          <button
            type="button"
            onClick={() => setActiveCategory("__all__")}
            className="shrink-0 whitespace-nowrap rounded-[12px] border px-4 py-2 transition"
            style={{
              borderColor:
                activeCategory === "__all__"
                  ? resolvedCategoryActiveColor
                  : "var(--block-border,transparent)",
              backgroundColor:
                activeCategory === "__all__" ? resolvedCategoryActiveColor : "transparent",
              color:
                activeCategory === "__all__"
                  ? "var(--block-button-text,var(--bp-paper))"
                  : resolvedCategoryTextColor,
              fontSize: "var(--block-text-size)",
            }}
          >
            {categoryAllLabel || "Все услуги"}
          </button>
          {categories.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className="shrink-0 whitespace-nowrap rounded-[12px] border px-4 py-2 transition"
                style={{
                  borderColor: isActive
                    ? resolvedCategoryActiveColor
                    : "var(--block-border,transparent)",
                  backgroundColor: isActive ? resolvedCategoryActiveColor : "transparent",
                  color: isActive
                    ? "var(--block-button-text,var(--bp-paper))"
                    : resolvedCategoryTextColor,
                  fontSize: "var(--block-text-size)",
                }}
              >
                {category}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className={`mt-8 ${
          isListView
            ? "flex flex-col"
            : `grid ${resolveGridClassName(cardsPerRow, mobileCardsPerRow, effectiveViewportWidth)}`
        }`}
        style={{
          columnGap: isListView ? undefined : clamp(cardGapX, 0, 80, 20),
          rowGap: clamp(cardGapY, 0, 120, 40),
        }}
      >
        {displayItems.map((service) => {
          const serviceHref = publicSlug ? `${basePath}/services/${service.id}` : "#";
          const bookingHref =
            showButton && publicSlug
              ? buildBookingLink({
                  publicSlug,
                  publicBasePath: basePath,
                  locationId:
                    effectiveLocationId ??
                    (service.locationIds.length === 1 ? service.locationIds[0] : null),
                  specialistId: effectiveSpecialistId,
                  serviceId: service.id,
                  scenario: "serviceFirst",
                })
              : null;
          const detailsHref =
            servicePageButtonMode === "booking" && bookingHref ? bookingHref : serviceHref;
          const images = uniqueImageUrls(service);
          const primaryImage = images[0] ?? null;
          const secondaryImage = showSecondImageOnHover ? images[1] ?? null : null;
          const hasServiceMeta = showDuration || showPrice;
          const isImageInsetCard = imageAspectRatio === "original" && !isListView;
          const hasFilledInfoPanel = isImageInsetCard && cardStyle === "filled";
          const hasGlassInfoPanel = hasFilledInfoPanel && Boolean(primaryImage) && cardLiquidGlass;
          const hasRegularFilledInfoPanel = cardStyle === "filled" && !isImageInsetCard && !isListView;
          const articleBackground =
            cardStyle === "filled" && !isImageInsetCard && !hasRegularFilledInfoPanel
              ? resolvedCardBackgroundColor
              : "transparent";
          const articleBorderColor =
            cardStyle === "filled" ? "var(--block-border,transparent)" : "transparent";
          const isMobileListView = isListView && isNarrowPreviewViewport;
          const listImageSize = isMobileListView ? 180 : 160;
          const listContentHeight = isMobileListView ? undefined : listImageSize;
          const imageRadiusValue = clamp(imageRadius, 0, 40, 10);
          const imageBorderRadius =
            isListView
              ? imageRadiusValue
              : cardStyle === "filled"
              ? `${imageRadiusValue}px ${imageRadiusValue}px 0 0`
              : imageRadiusValue;
          const listImageWrapperClassName = isListView
            ? hasPreviewViewport
              ? isNarrowPreviewViewport
                ? "w-full shrink-0 text-left"
                : "w-[160px] shrink-0 text-left"
              : "w-[160px] shrink-0 text-left max-sm:!w-full"
            : "w-full text-left";
          const contentTextAlign = textAlign;
          const contentAlignItems =
            contentTextAlign === "center"
              ? "center"
              : contentTextAlign === "right"
                ? "flex-end"
                : "flex-start";
          const contentJustify =
            contentTextAlign === "center"
              ? "center"
              : contentTextAlign === "right"
                ? "flex-end"
                : "flex-start";
          const shouldCompactTileSpacing =
            !isListView && hasPreviewViewport && isNarrowPreviewViewport;
          const baseContentPaddingX = clamp(cardPaddingX, 0, 80, 30);
          const baseContentPaddingY = clamp(cardPaddingY, 0, 80, 30);
          const contentPaddingX = isListView
            ? 0
            : shouldCompactTileSpacing
              ? 12
              : hasPreviewViewport
                ? baseContentPaddingX
                : `var(--service-card-padding-x, ${baseContentPaddingX}px)`;
          const contentPaddingY = isListView
            ? 18
            : shouldCompactTileSpacing
              ? 12
              : hasPreviewViewport
                ? baseContentPaddingY
                : `var(--service-card-padding-y, ${baseContentPaddingY}px)`;
          const shouldAlignMobileTextToImage =
            shouldCompactTileSpacing &&
            !isImageInsetCard &&
            !hasRegularFilledInfoPanel &&
            cardStyle !== "filled";
          const contentInnerPaddingX = shouldAlignMobileTextToImage ? 0 : contentPaddingX;
          const insetPanelPadding =
            typeof contentPaddingY === "number"
              ? Math.max(12, Math.round(contentPaddingY * 0.5))
              : `var(--service-card-inset-panel-padding, ${Math.max(12, Math.round(baseContentPaddingY * 0.5))}px)`;
          const imageInsetCardMinHeight = shouldCompactTileSpacing ? 300 : 480;
          const compactServiceTitleStyle: CSSProperties = shouldCompactTileSpacing
            ? {
                ...serviceCardTitleStyle,
                width: "100%",
                textAlign: contentTextAlign,
                fontSize: 15,
                lineHeight: 1.16,
                minHeight: 35,
              }
            : hasPreviewViewport
              ? {
                  ...serviceCardTitleStyle,
                  width: "100%",
                  textAlign: contentTextAlign,
                  minHeight: !isListView ? 45 : undefined,
                }
              : {
                  ...serviceCardTitleStyle,
                  width: "100%",
                  textAlign: contentTextAlign,
                  minHeight: "var(--service-card-title-min-height, 45px)",
                };
          const compactServiceTextStyle: CSSProperties = shouldCompactTileSpacing
            ? { ...serviceCardTextStyle, fontSize: 13, lineHeight: 1.2 }
            : serviceCardTextStyle;
          const compactServiceButtonTextStyle: CSSProperties = shouldCompactTileSpacing
            ? { ...serviceCardButtonTextStyle, fontSize: 13, lineHeight: 1.1, padding: "8px 16px" }
            : hasPreviewViewport
              ? serviceCardButtonTextStyle
              : {
                  ...serviceCardButtonTextStyle,
                  fontSize: "var(--catalog-card-button-font-size, var(--block-text-size))",
                  lineHeight: "var(--catalog-card-button-line-height, normal)",
                  padding: "var(--catalog-card-button-padding-y, 8px) var(--catalog-card-button-padding-x, 16px)",
                };
          const titleOverlayStyle = compactServiceTitleStyle;
          const textOverlayStyle = compactServiceTextStyle;
          const serviceMetaClassName = isListView
            ? "mt-6"
            : isImageInsetCard
              ? "mt-3"
            : !alignButtonsBottom
              ? "mt-3"
            : hasPreviewViewport
                ? shouldCompactTileSpacing
                  ? "mt-3"
                  : "mt-6"
                : "mt-4 sm:mt-6";
          const serviceActionsClassName = isListView
            ? "pt-3"
            : isImageInsetCard
              ? "mt-6"
            : alignButtonsBottom
              ? hasPreviewViewport
                ? shouldCompactTileSpacing
                  ? "pt-3"
                  : "mt-auto pt-6"
                : "pt-4 sm:mt-auto sm:pt-6"
              : hasPreviewViewport
                ? shouldCompactTileSpacing
                  ? "pt-3"
                  : "pt-3"
                : "pt-3";
          const openServiceModal = () => {
            setActiveModal({ serviceId: service.id, imageIndex: 0 });
          };

          return (
            <article
              key={service.id}
              className={`group ${
                cardStyle === "filled" ? "overflow-hidden" : ""
              } ${
                isImageInsetCard ? "relative" : ""
              } ${
                !isListView && !isImageInsetCard && cardStyle !== "filled"
                  ? "bp-service-card-plain-tile"
                  : ""
              } ${
                isListView
                  ? hasPreviewViewport
                    ? isNarrowPreviewViewport
                      ? "flex flex-col gap-3 border-b pb-5"
                      : "flex items-stretch gap-4 border-b pb-6"
                    : "flex items-stretch gap-4 border-b pb-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-3 max-sm:pb-5"
                  : alignButtonsBottom
                    ? hasPreviewViewport
                      ? isNarrowPreviewViewport
                        ? "flex flex-col"
                        : "flex h-full flex-col"
                      : "flex flex-col sm:h-full"
                    : ""
              } ${modalImageClickEnabled ? "cursor-pointer" : ""}`}
              role={modalImageClickEnabled ? "button" : undefined}
              tabIndex={modalImageClickEnabled ? 0 : undefined}
              onClick={modalImageClickEnabled ? openServiceModal : undefined}
              onKeyDown={
                modalImageClickEnabled
                  ? (event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      openServiceModal();
                    }
                  : undefined
              }
              style={{
                textAlign,
                backgroundColor: isListView ? "transparent" : articleBackground,
                backgroundImage:
                  isListView || isImageInsetCard || hasRegularFilledInfoPanel
                    ? "none"
                    : cardStyle === "filled"
                      ? resolvedCardBackgroundImage
                      : "none",
                borderWidth: isListView ? 0 : 1,
                borderStyle: "solid",
                borderColor: isListView ? "transparent" : articleBorderColor,
                borderRadius: cardStyle === "filled" ? imageRadiusValue : 0,
                padding: isImageInsetCard
                  ? hasFilledInfoPanel
                    ? shouldCompactTileSpacing
                      ? `${contentPaddingY}px ${contentPaddingX}px 0`
                      : `${cardPaddingY}px ${cardPaddingX}px 0`
                    : `${contentPaddingY}px ${contentPaddingX}px`
                  : undefined,
                minHeight: isImageInsetCard
                  ? hasPreviewViewport
                    ? imageInsetCardMinHeight
                    : "var(--service-image-inset-card-min-height, 480px)"
                  : undefined,
              }}
            >
              {modalImageClickEnabled ? (
                <div
                  className={`block ${listImageWrapperClassName} ${
                    isImageInsetCard
                      ? "absolute inset-0 bg-transparent"
                      : "bg-[color:var(--block-sub-bg,var(--bp-paper))]"
                  }`}
                >
                    <div
                      className="relative h-full w-full overflow-hidden"
                      style={{
                        height: isImageInsetCard ? "100%" : isListView ? listImageSize : undefined,
                        aspectRatio:
                          isListView
                            ? undefined
                            : isImageInsetCard
                              ? undefined
                              : imageAspectRatio === "original"
                                ? "4 / 5"
                              : imageAspectRatio || (variant === "v2" ? "4 / 3" : "5 / 6"),
                        borderRadius: imageBorderRadius,
                      }}
                    >
                      {primaryImage ? (
                        <UnoptimizedImage
                          src={primaryImage}
                          alt={service.name}
                          className={`h-full w-full transition duration-300 ${
                            secondaryImage
                              ? "group-hover:opacity-0"
                              : imageZoomOnHover
                                ? "group-hover:scale-[1.03]"
                                : ""
                          }`}
                          style={{ objectFit: isImageInsetCard ? "cover" : serviceCardImageFit }}
                        />
                      ) : (
                        <div className="relative z-[1] flex h-full w-full items-center justify-center px-4 text-center text-sm text-[color:var(--block-muted,var(--bp-muted))]">
                          Нет фото
                        </div>
                      )}
                      {primaryImage && secondaryImage ? (
                        <UnoptimizedImage
                          src={secondaryImage}
                          alt=""
                          className="absolute inset-0 h-full w-full opacity-0 transition duration-300 group-hover:opacity-100"
                          style={{ objectFit: isImageInsetCard ? "cover" : serviceCardImageFit }}
                        />
                      ) : null}
                      {hasGlassInfoPanel && primaryImage ? (
                        <UnoptimizedImage
                          aria-hidden="true"
                          src={primaryImage}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08]"
                          style={{
                            objectFit: "cover",
                            filter: "blur(32px) saturate(1.08)",
                            maskImage: photoPanelBlurMaskImage,
                            WebkitMaskImage: photoPanelBlurMaskImage,
                          }}
                        />
                      ) : null}
                      {hasFilledInfoPanel ? (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                          style={{
                            backgroundImage: photoPanelColorOverlayImage,
                          }}
                        />
                      ) : null}
                      <div className={`pointer-events-none absolute z-[3] flex max-w-[calc(100%-24px)] ${ratingOverlayVerticalClassName} ${ratingOverlayClassName}`}>
                        <RatingBadge
                          ratingAvg={service.ratingAvg}
                          ratingCount={service.ratingCount}
                          compact={shouldCompactTileSpacing}
                          textColor={resolvedRatingTextColor}
                          starColor={resolvedRatingStarColor}
                          backgroundColor={resolvedRatingBackgroundColor}
                          backgroundOpacity={ratingBackgroundOpacity}
                          backgroundRadius={ratingBackgroundRadius}
                          fontSize={ratingTextSize}
                          fontFamily={ratingTextFont}
                          fontWeight={ratingWeight}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <a
                    href={serviceHref}
                    className={`block ${listImageWrapperClassName} ${
                      isImageInsetCard
                        ? "absolute inset-0 bg-transparent"
                        : "bg-[color:var(--block-sub-bg,var(--bp-paper))]"
                    }`}
                  >
                    <div
                      className="relative h-full w-full overflow-hidden"
                      style={{
                        height: isImageInsetCard ? "100%" : isListView ? listImageSize : undefined,
                        aspectRatio:
                          isListView
                            ? undefined
                            : isImageInsetCard
                              ? undefined
                              : imageAspectRatio === "original"
                                ? "4 / 5"
                              : imageAspectRatio || (variant === "v2" ? "4 / 3" : "5 / 6"),
                        borderRadius: imageBorderRadius,
                      }}
                    >
                      {primaryImage ? (
                        <UnoptimizedImage
                          src={primaryImage}
                          alt={service.name}
                          className={`h-full w-full transition duration-300 ${
                            secondaryImage
                              ? "group-hover:opacity-0"
                              : imageZoomOnHover
                                ? "group-hover:scale-[1.03]"
                                : ""
                          }`}
                          style={{ objectFit: isImageInsetCard ? "cover" : serviceCardImageFit }}
                        />
                      ) : (
                        <div className="relative z-[1] flex h-full w-full items-center justify-center px-4 text-center text-sm text-[color:var(--block-muted,var(--bp-muted))]">
                          Нет фото
                        </div>
                      )}
                      {primaryImage && secondaryImage ? (
                        <UnoptimizedImage
                          src={secondaryImage}
                          alt=""
                          className="absolute inset-0 h-full w-full opacity-0 transition duration-300 group-hover:opacity-100"
                          style={{ objectFit: isImageInsetCard ? "cover" : serviceCardImageFit }}
                        />
                      ) : null}
                      {hasGlassInfoPanel && primaryImage ? (
                        <UnoptimizedImage
                          aria-hidden="true"
                          src={primaryImage}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08]"
                          style={{
                            objectFit: "cover",
                            filter: "blur(32px) saturate(1.08)",
                            maskImage: photoPanelBlurMaskImage,
                            WebkitMaskImage: photoPanelBlurMaskImage,
                          }}
                        />
                      ) : null}
                      {hasFilledInfoPanel ? (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                          style={{
                            backgroundImage: photoPanelColorOverlayImage,
                          }}
                        />
                      ) : null}
                      <div className={`pointer-events-none absolute z-[3] flex max-w-[calc(100%-24px)] ${ratingOverlayVerticalClassName} ${ratingOverlayClassName}`}>
                        <RatingBadge
                          ratingAvg={service.ratingAvg}
                          ratingCount={service.ratingCount}
                          compact={shouldCompactTileSpacing}
                          textColor={resolvedRatingTextColor}
                          starColor={resolvedRatingStarColor}
                          backgroundColor={resolvedRatingBackgroundColor}
                          backgroundOpacity={ratingBackgroundOpacity}
                          backgroundRadius={ratingBackgroundRadius}
                          fontSize={ratingTextSize}
                          fontFamily={ratingTextFont}
                          fontWeight={ratingWeight}
                        />
                      </div>
                    </div>
                  </a>
                )}

              <div
                className={`bp-service-card-content flex min-w-0 flex-col max-sm:!h-auto max-sm:!pb-3 max-sm:!pt-2 ${
                  isImageInsetCard ? "" : "flex-1"
                } ${
                  isListView ? "justify-between" : ""
                } ${isImageInsetCard ? "absolute bottom-0 z-[1] justify-end" : ""}`}
                style={{
                  left: isImageInsetCard ? 0 : undefined,
                  right: isImageInsetCard ? 0 : undefined,
                  bottom: isImageInsetCard ? 0 : undefined,
                  paddingLeft: isImageInsetCard
                    ? insetPanelPadding
                    : contentInnerPaddingX,
                  paddingRight: isImageInsetCard
                    ? insetPanelPadding
                    : contentInnerPaddingX,
                  paddingTop: isImageInsetCard
                    ? insetPanelPadding
                    : contentPaddingY,
                  paddingBottom: isImageInsetCard
                    ? insetPanelPadding
                    : contentPaddingY,
                  height: isListView ? listContentHeight : undefined,
                  boxSizing: "border-box",
                  textAlign: contentTextAlign,
                  backgroundColor:
                    hasFilledInfoPanel
                      ? hasGlassInfoPanel
                        ? "transparent"
                        : "transparent"
                      : hasRegularFilledInfoPanel || (isListView && cardStyle === "filled")
                        ? "transparent"
                        : "transparent",
                  backgroundImage:
                    hasFilledInfoPanel || hasRegularFilledInfoPanel
                      ? "none"
                      : isListView && cardStyle === "filled"
                        ? cardPanelBackgroundImage
                        : "none",
                  border:
                    isListView && cardStyle === "filled"
                      ? "1px solid var(--block-border,transparent)"
                      : undefined,
                  borderTopLeftRadius:
                    hasFilledInfoPanel || hasRegularFilledInfoPanel ? 0 : isListView && cardStyle === "filled" ? 18 : undefined,
                  borderTopRightRadius:
                    hasFilledInfoPanel || hasRegularFilledInfoPanel ? 0 : isListView && cardStyle === "filled" ? 18 : undefined,
                  borderBottomLeftRadius:
                    hasFilledInfoPanel ? 0 : hasRegularFilledInfoPanel ? imageRadiusValue : isListView && cardStyle === "filled" ? 18 : undefined,
                  borderBottomRightRadius:
                    hasFilledInfoPanel ? 0 : hasRegularFilledInfoPanel ? imageRadiusValue : isListView && cardStyle === "filled" ? 18 : undefined,
                  marginBottom: undefined,
                  position:
                    hasFilledInfoPanel || hasRegularFilledInfoPanel || hasGlassInfoPanel
                      ? isImageInsetCard
                        ? "absolute"
                        : "relative"
                      : undefined,
                  overflow: hasFilledInfoPanel || hasRegularFilledInfoPanel || hasGlassInfoPanel ? "visible" : undefined,
                  boxShadow: undefined,
                  alignItems: isListView ? contentAlignItems : undefined,
                }}
              >
                {hasRegularFilledInfoPanel && !hasGlassInfoPanel && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-0"
                    style={{
                      top: -glassPanelFeather,
                      backgroundImage: softPanelBackgroundImage,
                      borderBottomLeftRadius: hasFilledInfoPanel ? 0 : hasRegularFilledInfoPanel ? imageRadiusValue : undefined,
                      borderBottomRightRadius: hasFilledInfoPanel ? 0 : hasRegularFilledInfoPanel ? imageRadiusValue : undefined,
                    }}
                  />
                )}
                {modalImageClickEnabled ? (
                  <span
                    className="relative z-[1] block w-full font-semibold leading-tight text-[color:var(--block-text,var(--bp-ink))] max-sm:min-h-[35px] max-sm:!text-[15px] max-sm:!leading-[1.16]"
                    style={titleOverlayStyle}
                  >
                    {service.name}
                  </span>
                ) : (
                  <a
                    href={serviceHref}
                    className="relative z-[1] block w-full font-semibold leading-tight text-[color:var(--block-text,var(--bp-ink))] no-underline hover:no-underline max-sm:min-h-[35px] max-sm:!text-[15px] max-sm:!leading-[1.16]"
                    style={titleOverlayStyle}
                  >
                    {service.name}
                  </a>
                )}
                {hasServiceMeta && (
                  <div
                    className={`relative z-[1] flex flex-wrap gap-x-1.5 gap-y-0.5 text-[color:var(--block-muted,var(--bp-muted))] max-sm:!mt-3 max-sm:!text-[13px] max-sm:!leading-[1.2] ${serviceMetaClassName}`}
                    style={{ ...textOverlayStyle, justifyContent: contentJustify }}
                  >
                    {showDuration ? (
                      <span className="whitespace-nowrap">
                        от {service.baseDurationMin} мин
                      </span>
                    ) : null}
                    {showPrice ? (
                      <span className="whitespace-nowrap">
                        от {formatPrice(service.basePrice)}
                      </span>
                    ) : null}
                  </div>
                )}

                <div
                  className={`bp-catalog-card-actions relative z-[1] ${serviceActionsClassName} w-full max-sm:!pt-3`}
                  style={{ alignSelf: "stretch" }}
                  >
                    <div
                      className="flex w-full flex-wrap items-center gap-4 max-sm:gap-2"
                      style={{ justifyContent: buttonJustifyContent }}
                    >
                    {detailsButtonText ? (
                      <a
                        href={detailsHref}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-sm"
                        style={{
                          backgroundColor: resolvedDetailsButtonColor,
                          color: resolvedDetailsButtonTextColor,
                          border: "1px solid transparent",
                          borderRadius: buttonStyle.borderRadius ?? 0,
                          boxShadow: `inset 0 0 0 1px ${resolvedDetailsButtonBorderColor}`,
                          ...compactServiceButtonTextStyle,
                          ...detailsButtonStyle,
                        }}
                      >
                        {detailsButtonText}
                      </a>
                    ) : null}
                    {showButton && bookingHref && buttonText ? (
                      <a
                        href={bookingHref}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-sm font-semibold"
                        style={{ ...compactServiceButtonTextStyle, ...buttonStyle }}
                      >
                        {buttonText}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {displayItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[color:var(--block-border,transparent)] p-6 text-sm text-[color:var(--block-muted,var(--bp-muted))]">
            Услуги по выбранным параметрам не найдены.
          </div>
        ) : null}
      </div>

      {!usePagination && filteredItems.length > visibleCount ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((current) => Math.min(current + pageSize, filteredItems.length))
            }
            className="inline-flex items-center justify-center rounded-[12px] border px-5 py-2 text-sm"
            style={{
              borderColor: "var(--block-border,transparent)",
              color: "var(--block-text,var(--bp-ink))",
            }}
          >
            Загрузить ещё
          </button>
        </div>
      ) : null}

      {usePagination && filteredItems.length > pageSize ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-[10px] border px-3 text-sm"
              style={{
                borderColor:
                  pageNumber === currentPage
                    ? "var(--block-text,var(--bp-ink))"
                    : "var(--block-border,transparent)",
                color: "var(--block-text,var(--bp-ink))",
                backgroundColor:
                  pageNumber === currentPage ? "var(--block-sub-bg,transparent)" : "transparent",
              }}
            >
              {pageNumber}
            </button>
          ))}
        </div>
      ) : null}

      {activeModalService ? (
        <ServiceModal
          service={activeModalService}
          imageIndex={activeModal?.imageIndex ?? 0}
          onClose={() => setActiveModal(null)}
          bookingHref={activeModalBookingHref}
          buttonStyle={buttonStyle}
          buttonText={buttonText}
          showDescription={serviceModalShowDescription}
          showMeta={serviceModalShowMeta}
          modalBackgroundColor={resolvedServiceModalBgColor}
          modalBackgroundImage={resolvedServiceModalBgImage}
          mediaColumns={serviceModalMediaColumns}
          infoColumns={serviceModalInfoColumns}
          galleryBgColor={modalGalleryBgColor}
          imageFit={modalImageFit}
          imageRadius={modalImageRadius}
          imageAspectRatio={modalImageAspectRatio}
          controls={modalControls}
          arrowSize={modalArrowSize}
          arrowThickness={modalArrowThickness}
          arrowColor={modalArrowColor}
          arrowHoverColor={modalArrowHoverColor}
          arrowBgColor={modalArrowBgColor}
          arrowHoverBgColor={modalArrowHoverBgColor}
          arrowBgOpacity={modalArrowBgOpacity}
          arrowHoverBgOpacity={modalArrowHoverBgOpacity}
          arrowBorderEnabled={modalArrowBorderEnabled}
          dotsSize={modalDotsSize}
          dotsColor={modalDotsColor}
          dotsActiveColor={modalDotsActiveColor}
          dotsBorderWidth={modalDotsBorderWidth}
          thumbnailsPosition={modalThumbnailsPosition}
          infiniteGallery={modalInfiniteGallery}
          imageZoomOnClick={modalImageZoomOnClick}
          imageZoomOnHover={modalImageZoomOnHover}
          categoryTextStyle={resolvedModalCategoryTextStyle}
          titleTextStyle={resolvedModalTitleTextStyle}
          descriptionTextStyle={resolvedModalDescriptionTextStyle}
          priceTextStyle={resolvedModalPriceTextStyle}
          durationTextStyle={resolvedModalDurationTextStyle}
          previewViewportWidth={previewViewportWidth}
        />
      ) : null}
    </div>
  );
}
