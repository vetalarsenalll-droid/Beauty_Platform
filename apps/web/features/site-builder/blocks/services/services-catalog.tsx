"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { buildBookingLink } from "@/lib/booking-links";
import type { SiteServiceItem as ServiceItem } from "@/features/site-builder/shared/site-data";

type ServiceCatalogProps = {
  variant: "v1" | "v2";
  listView: "tile" | "list";
  title: string;
  subtitle: string;
  items: ServiceItem[];
  publicSlug: string | null;
  currentLocationId: number | null;
  locationId: number | null;
  effectiveSpecialistId: number | null;
  cardsPerRow: number;
  showCategoryTabs: boolean;
  categoryAllLabel: string;
  showSearch: boolean;
  searchPlaceholder: string;
  showSort: boolean;
  defaultSort: string;
  showDescription: boolean;
  showPrice: boolean;
  showDuration: boolean;
  showButton: boolean;
  buttonText: string;
  detailsButtonText: string;
  detailsButtonColor?: string;
  detailsButtonTextColor?: string;
  detailsButtonBorderColor?: string;
  servicePageButtonMode: "entityPage" | "booking";
  cardStyle: "plain" | "filled";
  cardGapX: number;
  cardGapY: number;
  imageAspectRatio: string;
  imageRadius: number;
  cardPaddingX: number;
  cardPaddingY: number;
  mobileCardsPerRow: 1 | 2;
  showSecondImageOnHover: boolean;
  alignButtonsBottom: boolean;
  modalImageClickEnabled: boolean;
  serviceModalShowDescription: boolean;
  serviceModalShowMeta: boolean;
  modalGalleryBgColor: string;
  modalImageFit: "contain" | "cover";
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
  maxVisibleItems: number;
  usePagination: boolean;
  headingStyle: CSSProperties;
  subheadingStyle: CSSProperties;
  buttonStyle: CSSProperties;
  textAlign?: "left" | "center" | "right";
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

function resolveGridClassName(cardsPerRow: number, mobileCardsPerRow: 1 | 2) {
  const mobile = mobileCardsPerRow === 2 ? "grid-cols-2" : "grid-cols-1";
  if (cardsPerRow <= 1) return `${mobile}`;
  if (cardsPerRow === 2) return `${mobile} md:grid-cols-2`;
  if (cardsPerRow === 4) return `${mobile} md:grid-cols-2 xl:grid-cols-4`;
  return `${mobile} md:grid-cols-2 xl:grid-cols-3`;
}

function resolveArrowSize(size: "sm" | "md" | "lg") {
  if (size === "sm") return 34;
  if (size === "lg") return 52;
  return 42;
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

function uniqueImageUrls(service: ServiceItem) {
  return Array.from(new Set([...(service.photoUrls ?? []), service.coverUrl ?? ""].filter(Boolean)));
}

function ServiceModal({
  service,
  imageIndex,
  onClose,
  bookingHref,
  buttonStyle,
  buttonText,
  showDescription,
  showMeta,
  galleryBgColor,
  imageFit,
  imageAspectRatio,
  controls,
  arrowSize,
  arrowThickness,
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
  imageFit: "contain" | "cover";
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
}) {
  const images = useMemo(() => uniqueImageUrls(service), [service]);
  const [activeImageIndex, setActiveImageIndex] = useState(
    Math.min(Math.max(imageIndex, 0), Math.max(images.length - 1, 0))
  );
  const [zoomed, setZoomed] = useState(false);
  const canNavigate = images.length > 1;
  const showArrows = controls === "arrows" || controls === "arrowsAndDots" || controls === "thumbnails";
  const showDots = controls === "dots" || controls === "arrowsAndDots";
  const showThumbnails = controls === "thumbnails" && images.length > 1 && thumbnailsPosition === "bottom";

  useEffect(() => {
    setActiveImageIndex(Math.min(Math.max(imageIndex, 0), Math.max(images.length - 1, 0)));
    setZoomed(false);
  }, [imageIndex, images.length]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canNavigate, images.length, infiniteGallery, onClose]);

  const goPrev = () =>
    setActiveImageIndex((current) => {
      if (current <= 0) return infiniteGallery ? images.length - 1 : current;
      return current - 1;
    });
  const goNext = () =>
    setActiveImageIndex((current) => {
      if (current >= images.length - 1) return infiniteGallery ? 0 : current;
      return current + 1;
    });

  const currentImage = images[activeImageIndex] ?? null;
  const arrowPx = resolveArrowSize(arrowSize);
  const arrowButtonBaseStyle: CSSProperties = {
    width: arrowPx,
    height: arrowPx,
    borderRadius: 999,
    border: arrowBorderEnabled ? `1px solid ${arrowColor}` : "1px solid transparent",
    color: arrowColor,
    backgroundColor: rgbaFromHex(arrowBgColor, arrowBgOpacity),
  };

  return (
    <div
      className="fixed inset-0 z-[300] overflow-y-auto bg-[#f3f3f3]"
      onClick={onClose}
    >
      <div
        className="relative mx-auto flex min-h-screen w-full max-w-[1600px] items-center px-6 py-10 lg:px-10"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="fixed right-8 top-6 z-[310] text-5xl font-light leading-none text-black/80 hover:text-black"
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className="relative flex min-h-[70vh] flex-1 items-center justify-center p-8">
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
            className="relative overflow-hidden rounded-[8px]"
            style={{
              width: "min(62vw, 820px)",
              height: "min(72vh, 820px)",
            }}
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={service.name}
                className={`h-full w-full transition duration-300 ${
                  imageZoomOnHover ? "hover:scale-[1.04]" : ""
                }`}
                style={{
                  objectFit: imageFit || "contain",
                  transform: zoomed ? "scale(1.35)" : undefined,
                  cursor: imageZoomOnClick ? (zoomed ? "zoom-out" : "zoom-in") : "default",
                }}
                onClick={() => {
                  if (!imageZoomOnClick) return;
                  setZoomed((current) => !current);
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-[color:var(--bp-muted)]">
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

        <div className="flex w-full max-w-[520px] flex-col py-2">
          <div className="text-sm uppercase tracking-[0.18em] text-[color:var(--bp-muted)]">
            {service.categoryName || "Услуга"}
          </div>
          <h3 className="mt-3 text-5xl font-semibold leading-tight text-[color:var(--bp-ink)]">{service.name}</h3>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xl">
            <span className="font-semibold text-[color:var(--bp-ink)]">{formatPrice(service.basePrice)}</span>
            {showMeta ? (
              <span className="text-[color:var(--bp-muted)]">{service.baseDurationMin} мин</span>
            ) : null}
          </div>

          {bookingHref ? (
            <a href={bookingHref} className="mt-8 inline-flex w-fit items-center justify-center px-6 py-3 text-base" style={buttonStyle}>
              {buttonText}
            </a>
          ) : null}

          {showDescription && service.description ? (
            <p className="mt-10 text-[17px] leading-8 text-[color:var(--bp-muted)]">{service.description}</p>
          ) : null}

          {showThumbnails ? (
            <div className="mt-8 grid grid-cols-5 gap-3">
              {images.map((url, idx) => (
                <button
                  key={`${service.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveImageIndex(idx);
                    setZoomed(false);
                  }}
                  className="overflow-hidden rounded-[12px] border"
                  style={{
                    borderColor: idx === activeImageIndex ? "var(--bp-ink)" : "rgba(15,16,18,0.12)",
                  }}
                >
                  <div className="aspect-square">
                    <img src={url} alt="" className="h-full w-full object-cover" />
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
                    setZoomed(false);
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
  currentLocationId,
  locationId,
  effectiveSpecialistId,
  cardsPerRow,
  showCategoryTabs,
  categoryAllLabel,
  showSearch,
  searchPlaceholder,
  showSort,
  defaultSort,
  showDescription,
  showPrice,
  showDuration,
  showButton,
  buttonText,
  detailsButtonText,
  detailsButtonColor,
  detailsButtonTextColor,
  detailsButtonBorderColor,
  servicePageButtonMode,
  cardStyle,
  cardGapX,
  cardGapY,
  imageAspectRatio,
  imageRadius,
  cardPaddingX,
  cardPaddingY,
  mobileCardsPerRow,
  showSecondImageOnHover,
  alignButtonsBottom,
  modalImageClickEnabled,
  serviceModalShowDescription,
  serviceModalShowMeta,
  modalGalleryBgColor,
  modalImageFit,
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
  maxVisibleItems,
  usePagination,
  headingStyle,
  subheadingStyle,
  buttonStyle,
  textAlign = "left",
}: ServiceCatalogProps) {
  const isEditorial = variant === "v1";
  const isListView = listView === "list";
  const scopedItems = currentLocationId
    ? items.filter((item) => item.locationIds.includes(currentLocationId))
    : locationId
      ? items.filter((item) => item.locationIds.includes(locationId))
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
  const [activeModal, setActiveModal] = useState<ActiveModalState>(null);
  const pageSize = clamp(maxVisibleItems, 1, 100, 36);
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setSortMode(defaultSort);
  }, [defaultSort]);

  useEffect(() => {
    setPage(1);
    setVisibleCount(pageSize);
  }, [activeCategory, searchQuery, sortMode, pageSize, usePagination]);

  useEffect(() => {
    if (activeCategory === "__all__") return;
    if (categories.includes(activeCategory)) return;
    setActiveCategory("__all__");
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
  const activeModalBookingHref =
    activeModalService && publicSlug
      ? buildBookingLink({
          publicSlug,
          locationId:
            currentLocationId ??
            locationId ??
            (activeModalService.locationIds.length === 1 ? activeModalService.locationIds[0] : null),
          specialistId: effectiveSpecialistId,
          serviceId: activeModalService.id,
          scenario: "serviceFirst",
        })
      : null;

  return (
    <div>
      <div
        className={`flex flex-col gap-6 ${variant === "v2" ? "xl:flex-row xl:items-end xl:justify-between" : ""}`}
      >
        <div className="max-w-3xl">
          <h3 className={`${isEditorial ? "max-w-2xl" : ""} font-semibold`} style={headingStyle}>
            {title}
          </h3>
          {subtitle ? (
            <p
              className={`mt-3 ${isEditorial ? "max-w-2xl" : ""} text-[color:var(--bp-muted)]`}
              style={subheadingStyle}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        {(showSearch || showSort) && (
          <div className="flex w-full flex-col gap-3 sm:flex-row xl:max-w-[580px] xl:justify-end">
            {showSearch ? (
              <label
                className="flex min-w-0 flex-1 items-center gap-3 border-b px-0 py-2 text-sm"
                style={{ borderColor: "var(--block-border,transparent)" }}
              >
                <span className="text-[color:var(--block-muted,var(--bp-muted))]">⌕</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[color:var(--block-text,var(--bp-ink))] outline-none placeholder:text-[color:var(--block-muted,var(--bp-muted))]"
                />
              </label>
            ) : null}

            {showSort ? (
              <label
                className="flex min-w-0 items-center border-b px-0 py-2 text-sm text-[color:var(--block-text,var(--bp-ink))] sm:w-[260px]"
                style={{ borderColor: "var(--block-border,transparent)" }}
              >
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                  className="w-full appearance-none border-0 bg-transparent p-0 pr-6 text-sm outline-none"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="-ml-5 text-xs text-[color:var(--block-muted,var(--bp-muted))]">▾</span>
              </label>
            ) : null}
          </div>
        )}
      </div>

      {showCategoryTabs && categories.length > 0 ? (
        <div className={`mt-6 flex flex-wrap ${isEditorial ? "gap-3" : "gap-2"}`}>
          <button
            type="button"
            onClick={() => setActiveCategory("__all__")}
            className="rounded-[12px] border px-4 py-2 text-sm transition"
            style={{
              borderColor:
                activeCategory === "__all__"
                  ? "var(--block-text,var(--bp-ink))"
                  : "var(--block-border,transparent)",
              backgroundColor:
                activeCategory === "__all__" ? "var(--block-text,var(--bp-ink))" : "transparent",
              color:
                activeCategory === "__all__"
                  ? "var(--block-button-text,var(--bp-paper))"
                  : "var(--block-text,var(--bp-ink))",
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
                className="rounded-[12px] border px-4 py-2 text-sm transition"
                style={{
                  borderColor: isActive
                    ? "var(--block-text,var(--bp-ink))"
                    : "var(--block-border,transparent)",
                  backgroundColor: isActive ? "var(--block-text,var(--bp-ink))" : "transparent",
                  color: isActive
                    ? "var(--block-button-text,var(--bp-paper))"
                    : "var(--block-text,var(--bp-ink))",
                }}
              >
                {category}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className={`mt-8 ${isListView ? "flex flex-col" : `grid ${resolveGridClassName(cardsPerRow, mobileCardsPerRow)}`}`}
        style={{
          columnGap: isListView ? undefined : clamp(cardGapX, 0, 80, 20),
          rowGap: clamp(cardGapY, 0, 120, 40),
        }}
      >
        {displayItems.map((service) => {
          const serviceHref = publicSlug ? `/${publicSlug}/services/${service.id}` : "#";
          const bookingHref =
            showButton && publicSlug
              ? buildBookingLink({
                  publicSlug,
                  locationId:
                    currentLocationId ??
                    locationId ??
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
          const hasImage = Boolean(primaryImage);
          const articleBackground =
            cardStyle === "filled" ? "var(--block-sub-bg,transparent)" : "transparent";
          const articleBorderColor =
            cardStyle === "filled" ? "var(--block-border,transparent)" : "transparent";
          const listImageSize = 220;
          const imageRadiusValue = clamp(imageRadius, 0, 40, 10);
          const imageBorderRadius =
            isListView
              ? imageRadiusValue
              : cardStyle === "filled"
              ? `${imageRadiusValue}px ${imageRadiusValue}px 0 0`
              : imageRadiusValue;
          const listImageOffsetLeft = isListView ? clamp(cardPaddingX, 0, 80, 30) : 0;
          const contentAlignItems =
            textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start";
          const contentJustify =
            textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start";
          const contentPaddingX = isListView ? 24 : clamp(cardPaddingX, 0, 80, 30);
          const contentPaddingY = isListView ? 18 : clamp(cardPaddingY, 0, 80, 30);

          return (
            <article
              key={service.id}
              className={`group overflow-hidden rounded-[18px] ${
                isListView
                  ? "flex items-stretch gap-5 border-b pb-6"
                  : alignButtonsBottom
                    ? "flex h-full flex-col"
                    : ""
              }`}
              style={{
                textAlign,
                backgroundColor: isListView ? "transparent" : articleBackground,
                borderWidth: isListView ? 0 : 1,
                borderStyle: "solid",
                borderColor: isListView ? "transparent" : articleBorderColor,
              }}
            >
              {hasImage ? (
                modalImageClickEnabled ? (
                  <button
                    type="button"
                    onClick={() => setActiveModal({ serviceId: service.id, imageIndex: 0 })}
                    className={`block ${isListView ? "w-[220px] shrink-0 text-left" : "w-full text-left"}`}
                    style={isListView ? { marginLeft: listImageOffsetLeft } : undefined}
                  >
                    <div
                      className="relative overflow-hidden"
                      style={{
                        height: isListView ? listImageSize : undefined,
                        aspectRatio:
                          isListView
                            ? undefined
                            : imageAspectRatio === "original"
                              ? undefined
                              : imageAspectRatio || (variant === "v2" ? "4 / 3" : "5 / 6"),
                        borderRadius: imageBorderRadius,
                      }}
                    >
                      <img
                        src={primaryImage ?? ""}
                        alt={service.name}
                        className={`h-full w-full transition duration-300 ${
                          secondaryImage ? "group-hover:opacity-0" : "group-hover:scale-[1.03]"
                        }`}
                        style={{ objectFit: "cover" }}
                      />
                      {secondaryImage ? (
                        <img
                          src={secondaryImage}
                          alt=""
                          className="absolute inset-0 h-full w-full opacity-0 transition duration-300 group-hover:opacity-100"
                          style={{ objectFit: "cover" }}
                        />
                      ) : null}
                    </div>
                  </button>
                ) : (
                  <a
                    href={serviceHref}
                    className={`block ${isListView ? "w-[220px] shrink-0" : ""}`}
                    style={isListView ? { marginLeft: listImageOffsetLeft } : undefined}
                  >
                    <div
                      className="relative overflow-hidden"
                      style={{
                        height: isListView ? listImageSize : undefined,
                        aspectRatio:
                          isListView
                            ? undefined
                            : imageAspectRatio === "original"
                              ? undefined
                              : imageAspectRatio || (variant === "v2" ? "4 / 3" : "5 / 6"),
                        borderRadius: imageBorderRadius,
                      }}
                    >
                      <img
                        src={primaryImage ?? ""}
                        alt={service.name}
                        className={`h-full w-full transition duration-300 ${
                          secondaryImage ? "group-hover:opacity-0" : "group-hover:scale-[1.03]"
                        }`}
                        style={{ objectFit: "cover" }}
                      />
                      {secondaryImage ? (
                        <img
                          src={secondaryImage}
                          alt=""
                          className="absolute inset-0 h-full w-full opacity-0 transition duration-300 group-hover:opacity-100"
                          style={{ objectFit: "cover" }}
                        />
                      ) : null}
                    </div>
                  </a>
                )
              ) : null}

              <div
                className={`flex flex-1 flex-col ${isListView ? "justify-between" : ""}`}
                style={{
                  paddingLeft: contentPaddingX,
                  paddingRight: contentPaddingX,
                  paddingTop: contentPaddingY,
                  paddingBottom: contentPaddingY,
                  height: isListView ? listImageSize : undefined,
                  boxSizing: "border-box",
                  backgroundColor:
                    isListView && cardStyle === "filled"
                      ? "var(--block-sub-bg,transparent)"
                      : "transparent",
                  border:
                    isListView && cardStyle === "filled"
                      ? "1px solid var(--block-border,transparent)"
                      : undefined,
                  borderRadius: isListView && cardStyle === "filled" ? 18 : undefined,
                  alignItems: isListView ? contentAlignItems : undefined,
                }}
              >
                {service.categoryName ? (
                  <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--block-muted,var(--bp-muted))]">
                    {service.categoryName}
                  </div>
                ) : null}

                <a
                  href={serviceHref}
                  className={`font-semibold leading-tight text-[color:var(--block-text,var(--bp-ink))] hover:underline ${
                    isEditorial ? "text-[22px]" : "text-[20px]"
                  }`}
                >
                  {service.name}
                </a>

                {(showDuration || showPrice) && (
                  <div
                    className="mt-6 flex flex-wrap gap-2 text-sm text-[color:var(--block-muted,var(--bp-muted))]"
                    style={{ justifyContent: isListView ? contentJustify : undefined }}
                  >
                    {showDuration ? (
                      <span
                        className="rounded-[10px] px-3 py-1"
                        style={{
                          border: "1px solid var(--block-border,transparent)",
                          backgroundColor:
                            cardStyle === "filled" ? "var(--block-sub-bg,transparent)" : "transparent",
                        }}
                      >
                        {service.baseDurationMin} мин
                      </span>
                    ) : null}
                    {showPrice ? (
                      <span
                        className="rounded-[10px] px-3 py-1"
                        style={{
                          border: "1px solid var(--block-border,transparent)",
                          backgroundColor:
                            cardStyle === "filled" ? "var(--block-sub-bg,transparent)" : "transparent",
                        }}
                      >
                        {formatPrice(service.basePrice)}
                      </span>
                    ) : null}
                  </div>
                )}

                <div
                  className={
                    isListView
                      ? "pt-3"
                      : alignButtonsBottom
                        ? "mt-auto pt-6"
                        : "pt-6"
                  }
                >
                  <div
                    className="flex flex-wrap gap-3"
                    style={{ justifyContent: isListView ? contentJustify : undefined }}
                  >
                    <a
                      href={detailsHref}
                      className="inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-sm"
                      style={{
                        backgroundColor: detailsButtonColor || "transparent",
                        color: detailsButtonTextColor || "var(--block-text,var(--bp-ink))",
                        border: `1px solid ${detailsButtonBorderColor || "var(--block-border,transparent)"}`,
                      }}
                    >
                      {detailsButtonText}
                    </a>
                    {showButton && bookingHref ? (
                      <a
                        href={bookingHref}
                        className="inline-flex items-center justify-center rounded-[12px] px-4 py-2 text-sm"
                        style={buttonStyle}
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
          galleryBgColor={modalGalleryBgColor}
          imageFit={modalImageFit}
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
        />
      ) : null}
    </div>
  );
}
