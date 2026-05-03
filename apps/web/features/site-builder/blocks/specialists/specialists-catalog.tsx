"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
  showLocationFilter?: boolean;
  showLevel?: boolean;
  showButton?: boolean;
  buttonText?: string;
  showDetailsButton?: boolean;
  detailsButtonText?: string;
  showImage?: boolean;
  imageAspectRatio?: string;
  imageRadius?: number;
  imageZoomOnHover?: boolean;
  cardStyle?: "plain" | "filled" | "boxed";
  cardGapX?: number;
  cardGapY?: number;
  cardPaddingX?: number;
  cardPaddingY?: number;
  maxVisibleItems?: number;
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
  showLocationFilter = true,
  showLevel = true,
  showButton = true,
  buttonText = "Записаться",
  showDetailsButton = true,
  detailsButtonText = "Подробнее",
  showImage = true,
  imageAspectRatio = "1 / 1",
  imageRadius = 10,
  imageZoomOnHover = true,
  cardStyle = "plain",
  cardGapX = 20,
  cardGapY = 40,
  cardPaddingX = 30,
  cardPaddingY = 30,
  maxVisibleItems = 8,
  headingStyle,
  subheadingStyle,
  buttonStyle,
  textAlign = "left",
}: SpecialistsCatalogProps) {
  const [query, setQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    currentLocationId ?? locationId ?? null
  );
  const [selectedLevel, setSelectedLevel] = useState("");
  const [sort, setSort] = useState(defaultSort || "default");

  const columns = clampInt(cardsPerRow, 4, 1, 4);
  const mobileColumns = clampInt(mobileCardsPerRow, 2, 1, 2);
  const visibleLimit = clampInt(maxVisibleItems, 8, 1, 100);
  const activeLocationId = currentLocationId ?? selectedLocationId;
  const normalizedQuery = normalizeSearch(query);
  const normalizedCardStyle = cardStyle === "filled" || cardStyle === "boxed" ? "filled" : "plain";
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

    return next.slice(0, visibleLimit);
  }, [activeLocationId, items, normalizedQuery, selectedLevel, sort, visibleLimit]);

  const gridTemplateColumns = listView === "list" ? "1fr" : `repeat(${columns}, minmax(0, 1fr))`;
  const mobileGridTemplateColumns =
    listView === "list" ? "1fr" : `repeat(${mobileColumns}, minmax(0, 1fr))`;

  return (
    <section
      className="bp-specialists-catalog"
      style={{
        textAlign,
        ["--specialists-grid" as string]: gridTemplateColumns,
        ["--specialists-grid-mobile" as string]: mobileGridTemplateColumns,
        ["--specialists-gap-x" as string]: `${Math.max(0, cardGapX)}px`,
        ["--specialists-gap-y" as string]: `${Math.max(0, cardGapY)}px`,
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

      {(showSearch || showSort || (showLocationFilter && locations.length > 1 && !currentLocationId)) && (
        <div className={`mt-7 flex flex-col gap-3 sm:flex-row sm:items-center ${alignClassName(searchSortAlignment)}`}>
          {showSearch && (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 min-w-[260px] rounded-[10px] border border-[color:var(--block-border,var(--bp-stroke))] bg-transparent px-4 text-sm outline-none"
            />
          )}
          {showSort && (
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-11 min-w-[220px] rounded-[10px] border border-[color:var(--block-border,var(--bp-stroke))] bg-transparent px-4 text-sm outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {showLocationFilter && locations.length > 1 && !currentLocationId && (
            <select
              value={selectedLocationId ?? ""}
              onChange={(event) =>
                setSelectedLocationId(event.target.value ? Number(event.target.value) : null)
              }
              className="h-11 min-w-[220px] rounded-[10px] border border-[color:var(--block-border,var(--bp-stroke))] bg-transparent px-4 text-sm outline-none"
            >
              <option value="">Все локации</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {showCategoryTabs && levels.length > 0 && (
        <div className={`mt-6 flex flex-wrap gap-4 ${alignClassName(filtersAlignment)}`}>
          <button
            type="button"
            onClick={() => setSelectedLevel("")}
            className={`rounded-[10px] px-4 py-2 text-sm ${selectedLevel === "" ? "bg-[color:var(--block-button,var(--site-button,var(--bp-ink)))] text-[color:var(--block-button-text,var(--site-button-text,#fff))]" : "text-[color:var(--block-text,var(--bp-ink))]"}`}
          >
            {categoryAllLabel}
          </button>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedLevel(level)}
              className={`rounded-[10px] px-4 py-2 text-sm ${selectedLevel === level ? "bg-[color:var(--block-button,var(--site-button,var(--bp-ink)))] text-[color:var(--block-button-text,var(--site-button-text,#fff))]" : "text-[color:var(--block-text,var(--bp-ink))]"}`}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid bp-specialists-grid">
        {filteredItems.map((specialist) => {
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

          return (
            <article
              key={specialist.id}
              className={`group ${listView === "list" ? "grid gap-5 sm:grid-cols-[260px_1fr] sm:items-center" : ""}`}
              style={{
                padding: normalizedCardStyle === "filled" ? `${cardPaddingY}px ${cardPaddingX}px` : 0,
                backgroundColor:
                  normalizedCardStyle === "filled" ? "var(--block-sub-bg,var(--bp-paper))" : "transparent",
              }}
            >
              {showImage && (
                <a
                  href={profileHref}
                  className="block overflow-hidden bg-[color:var(--block-sub-bg,var(--bp-paper))]"
                  style={{ aspectRatio: imageAspectRatio === "original" ? undefined : imageAspectRatio, borderRadius: imageRadius }}
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
              <div className={showImage && listView !== "list" ? "mt-5" : ""}>
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
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    {showDetailsButton && (
                      <a href={profileHref} className="inline-flex items-center justify-center text-sm no-underline">
                        {detailsButtonText}
                      </a>
                    )}
                    {showButton && (
                      <a
                        href={bookingHref}
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

        {filteredItems.length === 0 && (
          <div className="border border-dashed border-[color:var(--block-border,var(--bp-stroke))] p-6 text-sm text-[color:var(--block-muted,var(--bp-muted))]">
            Нет специалистов для отображения.
          </div>
        )}
      </div>

      <style jsx>{`
        .bp-specialists-grid {
          grid-template-columns: var(--specialists-grid);
          column-gap: var(--specialists-gap-x);
          row-gap: var(--specialists-gap-y);
        }
        @media (max-width: 767px) {
          .bp-specialists-grid {
            grid-template-columns: var(--specialists-grid-mobile);
          }
        }
      `}</style>
    </section>
  );
}
