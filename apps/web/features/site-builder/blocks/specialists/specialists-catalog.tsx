"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildBookingLink } from "@/lib/booking-links";

export type SpecialistCatalogItem = {
  id: number;
  name: string;
  bio?: string | null;
  level: string | null;
  locationIds: number[];
  coverUrl: string | null;
  photoUrls?: string[];
};

type ActiveSpecialistModalState = {
  specialistId: number;
  imageIndex: number;
} | null;

type SpecialistsCatalogProps = {
  title: string;
  subtitle?: string;
  items: SpecialistCatalogItem[];
  publicSlug?: string | null;
  locations?: Array<{ id: number; name: string }>;
  currentLocationId?: number | null;
  locationId?: number | null;
  variant?: "v1" | "v2";
  listView?: "tile" | "list";
  cardsPerRow?: number;
  mobileCardsPerRow?: number;
  showCategoryTabs?: boolean;
  categoryAllLabel?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  showSort?: boolean;
  defaultSort?: string;
  searchSortAlignment?: "left" | "center" | "right";
  filtersAlignment?: "left" | "center" | "right";
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
  showLocationFilter?: boolean;
  showLevel?: boolean;
  showDescription?: boolean;
  showButton?: boolean;
  buttonText?: string;
  buttonAlignment?: "left" | "center" | "right";
  showDetailsButton?: boolean;
  detailsButtonText?: string;
  detailsButtonColor?: string;
  detailsButtonTextColor?: string;
  detailsButtonBorderColor?: string;
  detailsButtonColorDark?: string;
  detailsButtonTextColorDark?: string;
  detailsButtonBorderColorDark?: string;
  showImage?: boolean;
  imageAspectRatio?: string;
  imageRadius?: number;
  imageFit?: "cover" | "contain";
  imageZoomOnHover?: boolean;
  imageZoomOnClick?: boolean;
  modalMediaColumns?: number;
  modalInfoColumns?: number;
  alignButtonsBottom?: boolean;
  cardBackgroundColorLight?: string;
  cardBackgroundImageLight?: string;
  cardBackgroundColorDark?: string;
  cardBackgroundImageDark?: string;
  cardLiquidGlass?: boolean;
  cardTitleTextStyle?: CSSProperties;
  cardDescriptionTextStyle?: CSSProperties;
  cardClickEnabled?: boolean;
  cardStyle?: "plain" | "filled" | "boxed";
  cardGapX?: number;
  cardGapY?: number;
  cardPaddingX?: number;
  cardPaddingY?: number;
  maxVisibleItems?: number;
  usePagination?: boolean;
  headingStyle?: CSSProperties;
  subheadingStyle?: CSSProperties;
  buttonStyle?: CSSProperties;
  textAlign?: "left" | "center" | "right";
};

const SORT_OPTIONS = [
  { value: "default", label: "По умолчанию" },
  { value: "nameAsc", label: "Имя: А-Я" },
  { value: "nameDesc", label: "Имя: Я-А" },
  { value: "levelAsc", label: "Уровень: А-Я" },
  { value: "levelDesc", label: "Уровень: Я-А" },
];

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function clampPan(value: number, limit: number) {
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(-limit, Math.min(limit, value));
}

function rgbaFromHex(hex: string, opacity: number) {
  const normalized = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(255,255,255,${opacity})`;
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function alphaHexColors(value: string, opacity: number) {
  return value.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => rgbaFromHex(hex, opacity));
}

function uniqueSpecialistImages(specialist: SpecialistCatalogItem) {
  return Array.from(new Set([...(specialist.photoUrls ?? []), specialist.coverUrl ?? ""].filter(Boolean)));
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function alignClassName(value: "left" | "center" | "right") {
  if (value === "center") return "justify-center";
  if (value === "right") return "justify-end";
  return "justify-start";
}

function resolveGridClassName(cardsPerRow: number, mobileCardsPerRow: number) {
  const mobile = mobileCardsPerRow === 2 ? "grid-cols-2" : "grid-cols-1";
  if (cardsPerRow <= 1) return mobile;
  if (cardsPerRow === 2) return `${mobile} md:grid-cols-2`;
  if (cardsPerRow === 4) return `${mobile} md:grid-cols-2 xl:grid-cols-4`;
  return `${mobile} md:grid-cols-2 xl:grid-cols-3`;
}

function SpecialistModal({
  specialist,
  imageIndex,
  bookingHref,
  buttonText,
  buttonStyle,
  onClose,
  showDescription,
  imageFit,
  imageRadius,
  imageAspectRatio,
  imageZoomOnClick,
  imageZoomOnHover,
  mediaColumns,
  infoColumns,
  titleTextStyle,
  descriptionTextStyle,
}: {
  specialist: SpecialistCatalogItem;
  imageIndex: number;
  bookingHref: string | null;
  buttonText: string;
  buttonStyle?: CSSProperties;
  onClose: () => void;
  showDescription: boolean;
  imageFit: "cover" | "contain";
  imageRadius: number;
  imageAspectRatio: string;
  imageZoomOnClick: boolean;
  imageZoomOnHover: boolean;
  mediaColumns: number;
  infoColumns: number;
  titleTextStyle?: CSSProperties;
  descriptionTextStyle?: CSSProperties;
}) {
  const images = useMemo(() => uniqueSpecialistImages(specialist), [specialist]);
  const [activeImageIndex, setActiveImageIndex] = useState(
    Math.min(Math.max(imageIndex, 0), Math.max(images.length - 1, 0))
  );
  const [zoomLevel, setZoomLevel] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartPan, setDragStartPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const currentImage = images[activeImageIndex] ?? null;
  const canNavigate = images.length > 1;
  const isImageFocusMode = zoomLevel > 0;

  useEffect(() => {
    setActiveImageIndex(Math.min(Math.max(imageIndex, 0), Math.max(images.length - 1, 0)));
    setZoomLevel(0);
    setPan({ x: 0, y: 0 });
    setIsDraggingImage(false);
  }, [imageIndex, images.length]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (zoomLevel > 0) {
          setZoomLevel(0);
          setPan({ x: 0, y: 0 });
          return;
        }
        onClose();
      }
      if (event.key === "ArrowRight" && canNavigate) {
        setPan({ x: 0, y: 0 });
        setActiveImageIndex((current) => (current >= images.length - 1 ? 0 : current + 1));
      }
      if (event.key === "ArrowLeft" && canNavigate) {
        setPan({ x: 0, y: 0 });
        setActiveImageIndex((current) => (current <= 0 ? images.length - 1 : current - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canNavigate, images.length, onClose, zoomLevel]);

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

  const goPrev = () => {
    setPan({ x: 0, y: 0 });
    setActiveImageIndex((current) => (current <= 0 ? images.length - 1 : current - 1));
  };
  const goNext = () => {
    setPan({ x: 0, y: 0 });
    setActiveImageIndex((current) => (current >= images.length - 1 ? 0 : current + 1));
  };
  const zoomScale =
    zoomLevel <= 1 ? 1 : zoomLevel === 2 ? 1.35 : zoomLevel === 3 ? 1.8 : zoomLevel === 4 ? 2.3 : 2.9;
  const getPanBounds = () => {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return { x: 0, y: 0 };
    return {
      x: Math.max(0, (image.clientWidth * zoomScale - viewport.clientWidth) / 2),
      y: Math.max(0, (image.clientHeight * zoomScale - viewport.clientHeight) / 2),
    };
  };
  const imageRadiusValue = clamp(imageRadius, 0, 80, 8);
  const clampedMediaColumns = clamp(Math.round(mediaColumns), 1, 11, 6);
  const clampedInfoColumns = clamp(Math.round(infoColumns), 1, 11, 6);
  const modalColumnsTotal = Math.max(2, clampedMediaColumns + clampedInfoColumns);
  const mediaWidthPercent = (clampedMediaColumns / modalColumnsTotal) * 100;
  const infoWidthPercent = (clampedInfoColumns / modalColumnsTotal) * 100;
  const modalMediaStyle: CSSProperties = isImageFocusMode
    ? {}
    : { flex: `0 0 ${mediaWidthPercent}%`, maxWidth: `${mediaWidthPercent}%` };
  const modalInfoStyle: CSSProperties = {
    flex: `0 0 ${infoWidthPercent}%`,
    maxWidth: `${infoWidthPercent}%`,
  };
  const description = typeof specialist.bio === "string" ? specialist.bio.trim() : "";
  const modalChromeButtonStyle: CSSProperties = {
    color:
      typeof titleTextStyle?.color === "string" && titleTextStyle.color.trim()
        ? titleTextStyle.color
        : "var(--block-text,var(--bp-ink))",
  };

  return (
    <div className="fixed inset-0 z-[300] overflow-hidden bg-[color:var(--block-bg,var(--bp-paper))]">
      <div
        className={`relative mx-auto flex min-h-screen w-full ${
          isImageFocusMode ? "max-w-none items-center justify-center px-3 py-3" : "max-w-[1600px] items-center px-6 py-10 lg:px-10"
        }`}
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
          className="fixed right-8 top-6 z-[310] text-5xl font-light leading-none opacity-80 transition hover:opacity-100"
          style={modalChromeButtonStyle}
          aria-label="Закрыть"
        >
          ×
        </button>

        {imageZoomOnClick && zoomLevel > 0 ? (
          <div className="fixed right-24 top-8 z-[310] flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoomLevel((current) => (current <= 1 ? 1 : ((current - 1) as 0 | 1 | 2 | 3 | 4 | 5)));
              }}
              className="text-4xl leading-none opacity-80 transition hover:opacity-100 disabled:opacity-30"
              style={modalChromeButtonStyle}
              disabled={zoomLevel <= 1}
              aria-label="Уменьшить"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoomLevel((current) => (current === 5 ? 5 : ((current + 1) as 0 | 1 | 2 | 3 | 4 | 5)));
              }}
              className="text-4xl leading-none opacity-80 transition hover:opacity-100 disabled:opacity-30"
              style={modalChromeButtonStyle}
              disabled={zoomLevel === 5}
              aria-label="Увеличить"
            >
              +
            </button>
          </div>
        ) : null}

        <div
          className={`relative flex items-center justify-center ${isImageFocusMode ? "min-h-0 flex-1 p-0" : "min-h-[70vh] p-8"}`}
          style={modalMediaStyle}
        >
          {canNavigate && !isImageFocusMode ? (
            <button type="button" onClick={goPrev} className="absolute left-6 top-1/2 z-10 -translate-y-1/2 text-5xl leading-none opacity-70" aria-label="Предыдущее изображение">
              ‹
            </button>
          ) : null}
          <div
            ref={viewportRef}
            className="relative mx-auto flex items-center justify-center overflow-hidden"
            style={{
              width: isImageFocusMode ? "min(92vw, 1280px)" : "min(62vw, 820px)",
              height: isImageFocusMode ? "calc(100vh - 112px)" : "min(72vh, 820px)",
              borderRadius: zoomLevel > 1 ? 0 : imageRadiusValue,
              aspectRatio: !isImageFocusMode ? imageAspectRatio : undefined,
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
              <img
                ref={imageRef}
                src={currentImage}
                alt={specialist.name}
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
                  cursor: imageZoomOnClick
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
              <div className="flex h-full w-full items-center justify-center text-sm text-[color:var(--bp-muted)]">
                Нет изображения
              </div>
            )}
          </div>
          {canNavigate && !isImageFocusMode ? (
            <button type="button" onClick={goNext} className="absolute right-6 top-1/2 z-10 -translate-y-1/2 text-5xl leading-none opacity-70" aria-label="Следующее изображение">
              ›
            </button>
          ) : null}
        </div>

        {!isImageFocusMode ? (
          <div className="flex w-full flex-col py-2" style={modalInfoStyle}>
            {specialist.level ? (
              <div className="specialist-card-text uppercase tracking-[0.18em]" style={descriptionTextStyle}>
                {specialist.level}
              </div>
            ) : null}
            <h3 className="specialist-card-text mt-3 leading-tight" style={titleTextStyle}>
              {specialist.name}
            </h3>
            {bookingHref ? (
              <a href={bookingHref} className="mt-8 inline-flex w-fit items-center justify-center px-6 py-3 text-base" style={buttonStyle}>
                {buttonText}
              </a>
            ) : null}
            {showDescription && description ? (
              <p className="specialist-card-text mt-10 leading-8" style={descriptionTextStyle}>
                {description}
              </p>
            ) : null}
            {images.length > 1 ? (
              <div className="mt-8 grid grid-cols-5 gap-3">
                {images.map((url, idx) => (
                  <button
                    key={`${specialist.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      setActiveImageIndex(idx);
                      setZoomLevel(0);
                    }}
                    className="overflow-hidden rounded-[12px] border"
                    style={{ borderColor: idx === activeImageIndex ? "var(--bp-ink)" : "rgba(15,16,18,0.12)" }}
                  >
                    <div className="aspect-square">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SpecialistsCatalog({
  title,
  subtitle = "",
  items,
  publicSlug,
  locations = [],
  currentLocationId = null,
  locationId = null,
  listView = "tile",
  cardsPerRow = 4,
  mobileCardsPerRow = 2,
  showCategoryTabs = true,
  categoryAllLabel = "Все специалисты",
  showSearch = true,
  searchPlaceholder = "Поиск специалиста",
  showSort = true,
  defaultSort = "default",
  searchSortAlignment = "right",
  filtersAlignment = "left",
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
  showLocationFilter = true,
  showLevel = true,
  showDescription = true,
  showButton = true,
  buttonText = "Записаться",
  buttonAlignment = "center",
  showDetailsButton = true,
  detailsButtonText = "Подробнее",
  detailsButtonColor,
  detailsButtonTextColor,
  detailsButtonBorderColor,
  detailsButtonColorDark,
  detailsButtonTextColorDark,
  detailsButtonBorderColorDark,
  showImage = true,
  imageAspectRatio = "1 / 1",
  imageRadius = 10,
  imageFit = "cover",
  imageZoomOnHover = true,
  imageZoomOnClick = false,
  modalMediaColumns = 6,
  modalInfoColumns = 6,
  alignButtonsBottom = true,
  cardBackgroundColorLight,
  cardBackgroundImageLight,
  cardBackgroundColorDark,
  cardBackgroundImageDark,
  cardLiquidGlass = false,
  cardTitleTextStyle,
  cardDescriptionTextStyle,
  cardClickEnabled = true,
  cardStyle = "plain",
  cardGapX = 20,
  cardGapY = 40,
  cardPaddingX = 30,
  cardPaddingY = 30,
  maxVisibleItems = 8,
  usePagination = false,
  headingStyle,
  subheadingStyle,
  buttonStyle,
  textAlign = "left",
}: SpecialistsCatalogProps) {
  const catalogRef = useRef<HTMLElement | null>(null);
  const [activeThemeMode, setActiveThemeMode] = useState<"light" | "dark">("light");
  const [query, setQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    currentLocationId ?? locationId ?? null
  );
  const [selectedLevel, setSelectedLevel] = useState("");
  const [sort, setSort] = useState(defaultSort || "default");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveSpecialistModalState>(null);
  const pageSize = clampInt(maxVisibleItems, 8, 1, 100);
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const columns = clampInt(cardsPerRow, 4, 1, 4);
  const mobileColumns = clampInt(mobileCardsPerRow, 2, 1, 2);
  const activeLocationId = currentLocationId ?? selectedLocationId;
  const normalizedQuery = normalizeSearch(query);
  const normalizedCardStyle = cardStyle === "filled" || cardStyle === "boxed" ? "filled" : "plain";
  const availableLocations = locations.filter((location) =>
    items.some((item) => item.locationIds.includes(location.id))
  );
  const activeSortOption = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0]!;
  const activeLocationOption = selectedLocationId
    ? availableLocations.find((location) => location.id === selectedLocationId)
    : null;
  const levels = useMemo(
    () => Array.from(new Set(items.map((item) => item.level).filter(Boolean) as string[])),
    [items]
  );

  const filteredItems = useMemo(() => {
    const next = items.filter((item) => {
      if (activeLocationId && !item.locationIds.includes(activeLocationId)) return false;
      if (selectedLevel && item.level !== selectedLevel) return false;
      if (!normalizedQuery) return true;
      return `${item.name} ${item.level ?? ""}`.toLowerCase().includes(normalizedQuery);
    });

    if (sort === "nameAsc") next.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    if (sort === "nameDesc") next.sort((a, b) => b.name.localeCompare(a.name, "ru"));
    if (sort === "levelAsc") next.sort((a, b) => (a.level ?? "").localeCompare(b.level ?? "", "ru"));
    if (sort === "levelDesc") next.sort((a, b) => (b.level ?? "").localeCompare(a.level ?? "", "ru"));

    return next;
  }, [activeLocationId, items, normalizedQuery, selectedLevel, sort]);

  useEffect(() => {
    setSort(defaultSort || "default");
  }, [defaultSort]);

  useEffect(() => {
    setPage(1);
    setVisibleCount(pageSize);
  }, [activeLocationId, normalizedQuery, selectedLevel, sort, pageSize, usePagination]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resolveModeFromDom = () => {
      const scopedRoot =
        catalogRef.current?.closest("[data-site-theme]") ??
        document.getElementById("public-site-root") ??
        document.documentElement;
      const mode = scopedRoot.getAttribute("data-site-theme");
      setActiveThemeMode(mode === "dark" ? "dark" : "light");
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

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const displayItems = usePagination
    ? filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredItems.slice(0, visibleCount);
  const activeModalSpecialist = activeModal
    ? displayItems.find((item) => item.id === activeModal.specialistId) ??
      filteredItems.find((item) => item.id === activeModal.specialistId) ??
      items.find((item) => item.id === activeModal.specialistId) ??
      null
    : null;
  const activeModalBookingHref =
    activeModalSpecialist && publicSlug
      ? buildBookingLink({
          publicSlug,
          locationId:
            activeLocationId ??
            (activeModalSpecialist.locationIds.length === 1 ? activeModalSpecialist.locationIds[0] : null),
          specialistId: activeModalSpecialist.id,
          scenario: "specialistFirst",
        })
      : null;

  const gridClassName =
    listView === "list" ? "grid-cols-1" : resolveGridClassName(columns, mobileColumns);
  const buttonJustifyContent =
    buttonAlignment === "left" ? "flex-start" : buttonAlignment === "right" ? "flex-end" : "center";
  const pickColor = (light?: string, dark?: string, fallback = "var(--block-text,var(--bp-ink))") =>
    activeThemeMode === "dark" ? dark || light || fallback : light || dark || fallback;
  const resolvedCategoryTextColor = pickColor(categoryTextColor, categoryTextColorDark);
  const resolvedCategoryActiveColor = pickColor(
    categoryActiveColor,
    categoryActiveColorDark,
    "var(--block-button,var(--site-button,var(--bp-ink)))"
  );
  const resolvedSortTextColor = pickColor(sortTextColor, sortTextColorDark);
  const resolvedSortActiveColor = pickColor(
    sortActiveColor,
    sortActiveColorDark,
    resolvedCategoryActiveColor
  );
  const resolvedLocationTextColor = pickColor(locationTextColor, locationTextColorDark);
  const resolvedLocationActiveColor = pickColor(
    locationActiveColor,
    locationActiveColorDark,
    resolvedSortActiveColor
  );
  const resolvedDetailsButtonColor = pickColor(detailsButtonColor, detailsButtonColorDark, "transparent");
  const resolvedDetailsButtonTextColor = pickColor(
    detailsButtonTextColor,
    detailsButtonTextColorDark,
    "var(--block-text,var(--bp-ink))"
  );
  const resolvedDetailsButtonBorderColor = pickColor(
    detailsButtonBorderColor,
    detailsButtonBorderColorDark,
    "var(--block-border,transparent)"
  );
  const resolvedCardBackgroundColor = pickColor(
    cardBackgroundColorLight,
    cardBackgroundColorDark,
    "var(--block-sub-bg,var(--bp-paper))"
  );
  const resolvedCardBackgroundImage =
    activeThemeMode === "dark"
      ? cardBackgroundImageDark || cardBackgroundImageLight || "none"
      : cardBackgroundImageLight || cardBackgroundImageDark || "none";
  const glassPanelOpacity = activeThemeMode === "dark" ? 0.28 : 0.42;
  const glassPanelBackgroundImage =
    activeThemeMode === "dark"
      ? `linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.06) 42%, rgba(12,14,18,0.34)), ${
          resolvedCardBackgroundImage && resolvedCardBackgroundImage !== "none"
            ? alphaHexColors(resolvedCardBackgroundImage, glassPanelOpacity)
            : "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(12,14,18,0.18))"
        }`
      : alphaHexColors(resolvedCardBackgroundImage, glassPanelOpacity);
  const resolveModeTextStyle = (nextStyle?: CSSProperties): CSSProperties | undefined => {
    if (!nextStyle) return undefined;
    const darkColor = (nextStyle as Record<string, unknown>)["--card-dark-color"];
    if (activeThemeMode !== "dark" || typeof darkColor !== "string" || !darkColor) return nextStyle;
    return { ...nextStyle, color: darkColor };
  };
  const resolvedCardTitleTextStyle = resolveModeTextStyle(cardTitleTextStyle);
  const resolvedCardDescriptionTextStyle = resolveModeTextStyle(cardDescriptionTextStyle);
  const isDarkTheme = activeThemeMode === "dark";
  const controlBorderColor = isDarkTheme ? "rgba(242,243,245,0.18)" : "rgba(15,16,18,0.12)";
  const controlBackgroundColor = isDarkTheme ? "rgba(31,36,44,0.92)" : "rgba(255,255,255,0.78)";
  const dropdownBackgroundColor = isDarkTheme ? "rgba(18,22,28,0.98)" : "rgba(255,255,255,0.98)";
  const optionHoverColor = isDarkTheme ? "rgba(242,243,245,0.08)" : "rgba(15,16,18,0.04)";
  const controlShadow = isDarkTheme ? "0 1px 2px rgba(0,0,0,0.24)" : "0 1px 2px rgba(15,16,18,0.04)";
  const dropdownShadow = isDarkTheme ? "0 14px 34px rgba(0,0,0,0.34)" : "0 14px 34px rgba(15,16,18,0.14)";
  const searchSortJustifyContent =
    searchSortAlignment === "center" ? "center" : searchSortAlignment === "right" ? "flex-end" : "flex-start";
  const selectControlClassName = "relative min-w-0 sm:w-[250px]";

  return (
    <section
      ref={catalogRef}
      className="bp-specialists-catalog"
      style={{
        textAlign,
      }}
    >
      <div>
        {title && (
          <h2 className="leading-tight" style={headingStyle}>
            {title}
          </h2>
        )}
        {subtitle && (
          <p
            className="mt-3 max-w-[760px] leading-relaxed text-[color:var(--block-muted,var(--bp-muted))]"
            style={subheadingStyle}
          >
            {subtitle}
          </p>
        )}
      </div>

      {(showSearch || showSort || (showLocationFilter && availableLocations.length > 1 && !currentLocationId)) && (
        <div
          className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
          style={{ justifyContent: searchSortJustifyContent }}
        >
          {showSearch && (
            <label className="relative block h-[44px] min-w-0 text-sm transition sm:w-[320px]">
              <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[color:var(--block-muted,var(--bp-muted))]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
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
          )}
          {showSort && (
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
                    const isSelected = option.value === sort;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSort(option.value);
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
                            ? "var(--block-button-text,var(--site-button-text,#fff))"
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
          )}
          {showLocationFilter && availableLocations.length > 1 && !currentLocationId && (
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
                          backgroundColor: isSelected
                            ? resolvedLocationActiveColor
                            : "transparent",
                          color: isSelected
                            ? "var(--block-button-text,var(--site-button-text,#fff))"
                            : resolvedLocationTextColor,
                        }}
                      >
                        {location.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {showCategoryTabs && levels.length > 0 && (
        <div className={`mt-6 flex flex-wrap gap-4 ${alignClassName(filtersAlignment)}`}>
          <button
            type="button"
            onClick={() => setSelectedLevel("")}
            className="rounded-[10px] px-4 py-2 text-sm"
            style={{
              backgroundColor: selectedLevel === "" ? resolvedCategoryActiveColor : "transparent",
              color:
                selectedLevel === ""
                  ? "var(--block-button-text,var(--site-button-text,#fff))"
                  : resolvedCategoryTextColor,
            }}
          >
            {categoryAllLabel}
          </button>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedLevel(level)}
              className="rounded-[10px] px-4 py-2 text-sm"
              style={{
                backgroundColor: selectedLevel === level ? resolvedCategoryActiveColor : "transparent",
                color:
                  selectedLevel === level
                    ? "var(--block-button-text,var(--site-button-text,#fff))"
                    : resolvedCategoryTextColor,
              }}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      <div
        className={`mt-8 grid ${gridClassName}`}
        style={{
          columnGap: listView === "list" ? undefined : Math.max(0, cardGapX),
          rowGap: Math.max(0, cardGapY),
        }}
      >
        {displayItems.map((specialist) => {
          const bookingHref = publicSlug
            ? buildBookingLink({
                publicSlug,
                locationId:
                  activeLocationId ??
                  (specialist.locationIds.length === 1 ? specialist.locationIds[0] : null),
                specialistId: specialist.id,
                scenario: "specialistFirst",
              })
            : "#";
          const profileHref = publicSlug ? `/${publicSlug}/specialists/${specialist.id}` : "#";
          const canOpenCardByClick = cardClickEnabled && Boolean(publicSlug);
          const isListCard = listView === "list";
          const isImageInsetCard = imageAspectRatio === "original";
          const hasCoverImage = Boolean(specialist.coverUrl);
          const hasFilledInfoPanel = isImageInsetCard && normalizedCardStyle === "filled" && !isListCard;
          const hasGlassInfoPanel = hasFilledInfoPanel && hasCoverImage && cardLiquidGlass;
          const isFilledCard = normalizedCardStyle === "filled" || isImageInsetCard;
          const imageRadiusValue = clampInt(imageRadius, 10, 0, 40);
          const imageBorderRadius =
            isListCard
              ? imageRadiusValue
              : isImageInsetCard
                ? imageRadiusValue
              : isFilledCard
                ? `${imageRadiusValue}px ${imageRadiusValue}px 0 0`
                : imageRadiusValue;
          const openSpecialistModal = () => {
            setActiveModal({ specialistId: specialist.id, imageIndex: 0 });
          };

          return (
            <article
              key={specialist.id}
              className={`group ${isImageInsetCard && !isListCard ? "relative overflow-hidden" : ""} ${isFilledCard && !isListCard ? "overflow-hidden" : ""} ${
                isListCard ? "grid gap-5 sm:grid-cols-[260px_1fr] sm:items-center" : ""
              } ${!isListCard && alignButtonsBottom ? "flex h-full flex-col" : ""} ${canOpenCardByClick ? "cursor-pointer" : ""}`}
              role={canOpenCardByClick ? "button" : undefined}
              tabIndex={canOpenCardByClick ? 0 : undefined}
              onClick={
                canOpenCardByClick
                  ? (event) => {
                      const target = event.target as HTMLElement | null;
                      if (target?.closest("a,button,input,select,textarea")) return;
                      openSpecialistModal();
                    }
                  : undefined
              }
              onKeyDown={
                canOpenCardByClick
                  ? (event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      openSpecialistModal();
                    }
                  : undefined
              }
              style={{
                backgroundColor: isImageInsetCard
                  ? "transparent"
                  : isFilledCard
                    ? resolvedCardBackgroundColor
                    : "transparent",
                backgroundImage: isImageInsetCard
                  ? "none"
                  : isFilledCard
                    ? resolvedCardBackgroundImage
                    : "none",
                borderRadius: isFilledCard ? imageRadiusValue : 0,
                padding:
                  isImageInsetCard && !isListCard
                    ? hasFilledInfoPanel
                      ? `${cardPaddingY}px ${cardPaddingX}px 0`
                      : `${cardPaddingY}px ${cardPaddingX}px`
                    : undefined,
                minHeight: isImageInsetCard && !isListCard ? 420 : undefined,
              }}
            >
              {showImage && (
                <a
                  href={profileHref}
                  onClick={
                    canOpenCardByClick
                      ? (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openSpecialistModal();
                        }
                      : undefined
                  }
                  className={`block overflow-hidden ${
                    isImageInsetCard && !isListCard && hasCoverImage
                      ? "absolute inset-0 bg-transparent"
                      : isImageInsetCard && !isListCard
                        ? "bg-transparent"
                        : "bg-[color:var(--block-sub-bg,var(--bp-paper))]"
                  }`}
                  style={{
                    aspectRatio: isImageInsetCard && hasCoverImage ? undefined : imageAspectRatio === "original" ? "4 / 5" : imageAspectRatio,
                    borderRadius: imageBorderRadius,
                  }}
                >
                  {specialist.coverUrl ? (
                    <img
                      src={specialist.coverUrl}
                      alt=""
                      className={`h-full w-full transition duration-300 ${imageZoomOnHover ? "group-hover:scale-[1.04]" : ""}`}
                      style={{ objectFit: isImageInsetCard ? "cover" : imageFit }}
                    />
                  ) : (
                    <div className={`${isImageInsetCard && !isListCard ? "hidden" : "flex"} h-full w-full items-center justify-center px-4 text-center text-sm text-[color:var(--block-muted,var(--bp-muted))]`}>
                      Нет фото
                    </div>
                  )}
                </a>
              )}
              <div
                className={`${isImageInsetCard && !isListCard ? "relative z-[1] justify-end" : ""} ${showImage && !isListCard && !isFilledCard ? "mt-5" : ""} ${
                  !isListCard && alignButtonsBottom && !isImageInsetCard ? "flex flex-1 flex-col" : ""
                } ${
                  isImageInsetCard && !isListCard ? "flex flex-col" : ""
                }`}
                style={{
                  padding:
                    isFilledCard && !isImageInsetCard
                      ? `${cardPaddingY}px ${cardPaddingX}px`
                      : hasFilledInfoPanel
                        ? Math.max(12, Math.round(cardPaddingY * 0.5))
                        : undefined,
                  marginTop: isImageInsetCard && !isListCard ? "auto" : undefined,
                  borderRadius: hasFilledInfoPanel ? 0 : undefined,
                  border: hasFilledInfoPanel ? 0 : undefined,
                  marginLeft: hasFilledInfoPanel ? -cardPaddingX : undefined,
                  marginRight: hasFilledInfoPanel ? -cardPaddingX : undefined,
                  width: hasFilledInfoPanel ? `calc(100% + ${cardPaddingX * 2}px)` : undefined,
                  borderBottomLeftRadius: hasFilledInfoPanel ? 0 : undefined,
                  borderBottomRightRadius: hasFilledInfoPanel ? 0 : undefined,
                  borderTopLeftRadius: hasFilledInfoPanel ? 0 : undefined,
                  borderTopRightRadius: hasFilledInfoPanel ? 0 : undefined,
                  backgroundColor: hasFilledInfoPanel
                    ? hasGlassInfoPanel
                      ? rgbaFromHex(
                          resolvedCardBackgroundColor,
                          glassPanelOpacity
                        )
                      : resolvedCardBackgroundColor
                    : undefined,
                  backgroundImage: hasFilledInfoPanel
                    ? hasGlassInfoPanel
                      ? glassPanelBackgroundImage
                      : resolvedCardBackgroundImage
                    : undefined,
                  boxShadow: hasGlassInfoPanel
                    ? activeThemeMode === "dark"
                      ? "inset 0 1px 0 rgba(255,255,255,0.18), 0 18px 45px rgba(0,0,0,0.22)"
                      : "0 18px 45px rgba(15,16,18,0.14)"
                    : undefined,
                  backdropFilter: hasGlassInfoPanel ? "blur(22px) saturate(1.65)" : undefined,
                  WebkitBackdropFilter: hasGlassInfoPanel ? "blur(22px) saturate(1.65)" : undefined,
                }}
              >
                <a
                  href={profileHref}
                  onClick={
                    canOpenCardByClick
                      ? (event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openSpecialistModal();
                        }
                      : undefined
                  }
                  className="specialist-card-text text-lg font-semibold leading-tight text-[color:var(--block-text,var(--bp-ink))] no-underline"
                  style={
                    isImageInsetCard && !isListCard && !hasFilledInfoPanel
                      ? { ...resolvedCardTitleTextStyle, color: "#ffffff" }
                      : resolvedCardTitleTextStyle
                  }
                >
                  {specialist.name}
                </a>
                {showLevel && specialist.level && (
                  <div
                    className="specialist-card-text mt-3 text-sm text-[color:var(--block-muted,var(--bp-muted))]"
                    style={
                      isImageInsetCard && !isListCard && !hasFilledInfoPanel
                        ? { ...resolvedCardDescriptionTextStyle, color: "rgba(255,255,255,0.82)" }
                        : resolvedCardDescriptionTextStyle
                    }
                  >
                    {specialist.level}
                  </div>
                )}
                {((showDetailsButton && detailsButtonText) || (showButton && buttonText)) && publicSlug && (
                  <div
                    className={`flex flex-wrap items-center gap-4 ${
                      !isListCard && alignButtonsBottom && !isImageInsetCard ? "mt-auto pt-6" : "mt-6"
                    }`}
                    style={{ justifyContent: buttonJustifyContent }}
                  >
                    {showDetailsButton && detailsButtonText && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (canOpenCardByClick) {
                            openSpecialistModal();
                            return;
                          }
                          window.location.href = profileHref;
                        }}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm no-underline"
                        style={{
                          backgroundColor: resolvedDetailsButtonColor,
                          color: resolvedDetailsButtonTextColor,
                          border: "1px solid transparent",
                          borderRadius: buttonStyle?.borderRadius ?? 0,
                          boxShadow: `inset 0 0 0 1px ${resolvedDetailsButtonBorderColor}`,
                        }}
                      >
                        {detailsButtonText}
                      </button>
                    )}
                    {showButton && buttonText && (
                      <a
                        href={bookingHref}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold no-underline"
                        style={buttonStyle}
                      >
                        {buttonText}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {displayItems.length === 0 && (
          <div className="border border-dashed border-[color:var(--block-border,var(--bp-stroke))] p-6 text-sm text-[color:var(--block-muted,var(--bp-muted))]">
            Нет специалистов для отображения.
          </div>
        )}
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
              borderColor: "var(--block-border,var(--bp-stroke))",
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
                    : "var(--block-border,var(--bp-stroke))",
                color: "var(--block-text,var(--bp-ink))",
                backgroundColor:
                  pageNumber === currentPage ? "var(--block-sub-bg,var(--bp-paper))" : "transparent",
              }}
            >
              {pageNumber}
            </button>
          ))}
        </div>
      ) : null}

      {activeModalSpecialist ? (
        <SpecialistModal
          specialist={activeModalSpecialist}
          imageIndex={activeModal?.imageIndex ?? 0}
          bookingHref={activeModalBookingHref}
          buttonText={buttonText}
          buttonStyle={buttonStyle}
          onClose={() => setActiveModal(null)}
          showDescription={showDescription}
          imageFit={imageFit}
          imageRadius={imageRadius}
          imageAspectRatio={imageAspectRatio}
          imageZoomOnClick={imageZoomOnClick}
          imageZoomOnHover={imageZoomOnHover}
          mediaColumns={modalMediaColumns}
          infoColumns={modalInfoColumns}
          titleTextStyle={resolvedCardTitleTextStyle}
          descriptionTextStyle={resolvedCardDescriptionTextStyle}
        />
      ) : null}

    </section>
  );
}
