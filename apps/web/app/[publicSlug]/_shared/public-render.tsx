import { buildBookingLink } from "@/lib/booking-links";
import type { SiteBlock } from "@/lib/site-builder";
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
  current: CurrentEntity
) {
  switch (block.type) {
    case "cover":
      return renderCover(block, accountName, publicSlug, branding, locations, services, specialists);
    case "about":
      return renderAbout(block, accountName, profile);
    case "locations":
      return renderLocations(block, publicSlug, locations, current);
    case "services":
      return renderServices(block, publicSlug, services, current);
    case "specialists":
      return renderSpecialists(block, publicSlug, specialists, current);
    case "promos":
      return renderPromos(block, publicSlug, promos, current);
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
  specialists: SpecialistItem[]
) {
  const data = block.data as Record<string, unknown>;
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
          <a
            href={buildBookingLink({ publicSlug })}
            className="mt-5 inline-flex rounded-full bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
          >
            {buttonText}
          </a>
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

function renderAbout(block: SiteBlock, accountName: string, profile: AccountProfile) {
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
  current: CurrentEntity
) {
  const data = block.data as Record<string, unknown>;
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
            <a
              href={`/${publicSlug}/locations/${location.id}`}
              className="text-base font-semibold"
            >
              {location.name}
            </a>
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{location.address}</div>
            {location.phone && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                Телефон: {location.phone}
              </div>
            )}
            {showButton && publicSlug && (
              <a
                href={buildBookingLink({
                  publicSlug,
                  locationId: location.id,
                  scenario: "serviceFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
              >
                {buttonText}
              </a>
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
  current: CurrentEntity
) {
  const data = block.data as Record<string, unknown>;
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
            <a
              href={`/${publicSlug}/services/${service.id}`}
              className="text-base font-semibold"
            >
              {service.name}
            </a>
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
              <a
                href={buildBookingLink({
                  publicSlug,
                  locationId,
                  specialistId,
                  serviceId: service.id,
                  scenario: specialistId ? "specialistFirst" : "serviceFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
              >
                {buttonText}
              </a>
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
  current: CurrentEntity
) {
  const data = block.data as Record<string, unknown>;
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
        {items.map((specialist) => (
          <div key={specialist.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            {specialist.coverUrl && (
              <img
                src={specialist.coverUrl}
                alt=""
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}
            <a
              href={`/${publicSlug}/specialists/${specialist.id}`}
              className="text-base font-semibold"
            >
              {specialist.name}
            </a>
            {specialist.level && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{specialist.level}</div>
            )}
            {showButton && publicSlug && (
              <a
                href={buildBookingLink({
                  publicSlug,
                  locationId:
                    locationId ??
                    (specialist.locationIds.length === 1 ? specialist.locationIds[0] : null),
                  specialistId: specialist.id,
                  scenario: "specialistFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
              >
                {buttonText}
              </a>
            )}
          </div>
        ))}
        {items.length === 0 && (
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
  current: CurrentEntity
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
            <a
              href={`/${publicSlug}/promos/${promo.id}`}
              className="text-base font-semibold"
            >
              {promo.name}
            </a>
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
