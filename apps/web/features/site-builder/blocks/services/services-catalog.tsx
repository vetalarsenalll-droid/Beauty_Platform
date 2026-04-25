"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { buildBookingLink } from "@/lib/booking-links";
import type { SiteServiceItem as ServiceItem } from "@/features/site-builder/shared/site-data";

type ServiceCatalogProps = {
  variant: "v1" | "v2";
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
  servicePageButtonMode: "entityPage" | "booking";
  headingStyle: CSSProperties;
  subheadingStyle: CSSProperties;
  buttonStyle: CSSProperties;
  textAlign?: "left" | "center" | "right";
};

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

function resolveGridClassName(cardsPerRow: number) {
  if (cardsPerRow <= 1) return "grid-cols-1";
  if (cardsPerRow === 2) return "grid-cols-1 md:grid-cols-2";
  if (cardsPerRow === 4) return "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
  return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
}

export function ServicesCatalog({
  variant,
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
  servicePageButtonMode,
  headingStyle,
  subheadingStyle,
  buttonStyle,
  textAlign = "left",
}: ServiceCatalogProps) {
  const isEditorial = variant === "v1";
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

  useEffect(() => {
    setSortMode(defaultSort);
  }, [defaultSort]);

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

  return (
    <div>
      <div
        className={`flex flex-col gap-6 ${variant === "v2" ? "xl:flex-row xl:items-end xl:justify-between" : ""}`}
      >
        <div className="max-w-3xl">
          <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-[color:var(--block-muted,var(--bp-muted))]">
            Beauty Platform
          </div>
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
              <label className="flex min-w-0 flex-1 items-center gap-3 border-b border-[color:var(--block-border,transparent)] bg-transparent px-0 py-2 text-sm">
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
              <label className="flex min-w-0 items-center border-b border-[color:var(--block-border,transparent)] bg-transparent px-0 py-2 text-sm text-[color:var(--block-text,var(--bp-ink))] sm:w-[260px]">
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

      <div className={`mt-8 grid ${isEditorial ? "gap-6" : "gap-5"} ${resolveGridClassName(cardsPerRow)}`}>
        {filteredItems.map((service) => {
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
          const hasImage = Boolean(service.coverUrl);

          return (
            <article
              key={service.id}
              className="overflow-hidden border border-[color:var(--block-border,transparent)] bg-[color:var(--block-sub-block-bg,transparent)] rounded-[18px]"
              style={{ textAlign }}
            >
              {hasImage ? (
                <a href={serviceHref} className="block">
                  <div className={`overflow-hidden ${variant === "v2" ? "aspect-[4/3]" : "aspect-[5/6]"}`}>
                    <img
                      src={service.coverUrl ?? ""}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                    />
                  </div>
                </a>
              ) : null}

              <div className="flex flex-1 flex-col px-0 pb-0 pt-5">
                {service.categoryName ? (
                  <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--block-muted,var(--bp-muted))]">
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

                {showDescription && service.description ? (
                  <p
                    className={`mt-3 text-[color:var(--block-muted,var(--bp-muted))] ${
                      isEditorial ? "text-[15px] leading-7" : "text-sm leading-6"
                    }`}
                  >
                    {service.description}
                  </p>
                ) : null}

                {(showDuration || showPrice) && (
                  <div className="mt-5 flex flex-wrap gap-2 text-sm text-[color:var(--block-muted,var(--bp-muted))]">
                    {showDuration ? (
                      <span className="rounded-[10px] border border-[color:var(--block-border,transparent)] px-3 py-1">
                        {service.baseDurationMin} мин
                      </span>
                    ) : null}
                    {showPrice ? (
                      <span className="rounded-[10px] border border-[color:var(--block-border,transparent)] px-3 py-1">
                        {formatPrice(service.basePrice)}
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="mt-auto pt-5">
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={detailsHref}
                      className="inline-flex items-center justify-center rounded-[12px] border border-[color:var(--block-border,transparent)] px-4 py-2 text-sm text-[color:var(--block-text,var(--bp-ink))]"
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

        {filteredItems.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[color:var(--block-border,transparent)] p-6 text-sm text-[color:var(--block-muted,var(--bp-muted))]">
            Услуги по выбранным параметрам не найдены.
          </div>
        ) : null}
      </div>
    </div>
  );
}
