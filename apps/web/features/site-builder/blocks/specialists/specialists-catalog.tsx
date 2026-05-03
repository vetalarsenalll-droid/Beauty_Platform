"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildBookingLink } from "@/lib/booking-links";

export type SpecialistCatalogItem = {
  id: number;
  name: string;
  level: string | null;
  locationIds: number[];
  coverUrl: string | null;
};

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
  showButton?: boolean;
  buttonText?: string;
  buttonAlignment?: "left" | "center" | "right";
  showDetailsButton?: boolean;
  detailsButtonText?: string;
  showImage?: boolean;
  imageAspectRatio?: string;
  imageRadius?: number;
  imageZoomOnHover?: boolean;
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
  showButton = true,
  buttonText = "Записаться",
  buttonAlignment = "center",
  showDetailsButton = true,
  detailsButtonText = "Подробнее",
  showImage = true,
  imageAspectRatio = "1 / 1",
  imageRadius = 10,
  imageZoomOnHover = true,
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
          const isFilledCard = normalizedCardStyle === "filled";
          const imageRadiusValue = clampInt(imageRadius, 10, 0, 40);
          const imageBorderRadius =
            isListCard
              ? imageRadiusValue
              : isFilledCard
                ? `${imageRadiusValue}px ${imageRadiusValue}px 0 0`
                : imageRadiusValue;

          return (
            <article
              key={specialist.id}
              className={`group ${isFilledCard && !isListCard ? "overflow-hidden" : ""} ${
                isListCard ? "grid gap-5 sm:grid-cols-[260px_1fr] sm:items-center" : ""
              } ${canOpenCardByClick ? "cursor-pointer" : ""}`}
              role={canOpenCardByClick ? "button" : undefined}
              tabIndex={canOpenCardByClick ? 0 : undefined}
              onClick={
                canOpenCardByClick
                  ? (event) => {
                      const target = event.target as HTMLElement | null;
                      if (target?.closest("a,button,input,select,textarea")) return;
                      window.location.href = profileHref;
                    }
                  : undefined
              }
              onKeyDown={
                canOpenCardByClick
                  ? (event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      window.location.href = profileHref;
                    }
                  : undefined
              }
              style={{
                backgroundColor: isFilledCard ? "var(--block-sub-bg,var(--bp-paper))" : "transparent",
                borderRadius: isFilledCard ? imageRadiusValue : 0,
              }}
            >
              {showImage && (
                <a
                  href={profileHref}
                  className="block overflow-hidden bg-[color:var(--block-sub-bg,var(--bp-paper))]"
                  style={{
                    aspectRatio: imageAspectRatio === "original" ? undefined : imageAspectRatio,
                    borderRadius: imageBorderRadius,
                  }}
                >
                  {specialist.coverUrl ? (
                    <img
                      src={specialist.coverUrl}
                      alt=""
                      className={`h-full w-full object-cover transition duration-300 ${imageZoomOnHover ? "group-hover:scale-[1.04]" : ""}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-[color:var(--block-muted,var(--bp-muted))]">
                      Нет фото
                    </div>
                  )}
                </a>
              )}
              <div
                className={showImage && !isListCard && !isFilledCard ? "mt-5" : ""}
                style={{
                  padding: isFilledCard ? `${cardPaddingY}px ${cardPaddingX}px` : undefined,
                }}
              >
                <a
                  href={profileHref}
                  className="text-lg font-semibold leading-tight text-[color:var(--block-text,var(--bp-ink))] no-underline"
                >
                  {specialist.name}
                </a>
                {showLevel && specialist.level && (
                  <div className="mt-3 text-sm text-[color:var(--block-muted,var(--bp-muted))]">
                    {specialist.level}
                  </div>
                )}
                {(showDetailsButton || showButton) && publicSlug && (
                  <div className="mt-6 flex flex-wrap items-center gap-4" style={{ justifyContent: buttonJustifyContent }}>
                    {showDetailsButton && (
                      <a
                        href={profileHref}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center justify-center text-sm no-underline"
                      >
                        {detailsButtonText}
                      </a>
                    )}
                    {showButton && (
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

    </section>
  );
}
