import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteDraft, SitePageKey } from "@/lib/site-builder";
import type {
  SiteLocationItem,
  SitePromoItem,
  SiteServiceItem,
  SiteSpecialistItem,
} from "@/features/site-builder/shared/site-data";
import { PAGE_KEYS, PAGE_LABELS, type CurrentEntity } from "./site-client-core";

type UsePagesMenuArgs = {
  pages: SiteDraft["pages"] | undefined;
  activePageKey: SitePageKey;
  currentEntity: CurrentEntity;
  locations: SiteLocationItem[];
  services: SiteServiceItem[];
  specialists: SiteSpecialistItem[];
  promos: SitePromoItem[];
};

export function usePagesMenu({
  pages,
  activePageKey,
  currentEntity,
  locations,
  services,
  specialists,
  promos,
}: UsePagesMenuArgs) {
  const [pagesMenuOpen, setPagesMenuOpen] = useState(false);
  const [pagesSearch, setPagesSearch] = useState("");
  const pagesMenuRef = useRef<HTMLDivElement | null>(null);

  const hasPageBlocks = (key: SitePageKey) => (pages?.[key]?.length ?? 0) > 0;

  const availablePageKeys = useMemo<SitePageKey[]>(() => {
    return PAGE_KEYS.filter((key) => {
      if (key === "home") return true;
      if (key === "locations") return locations.length > 0 || hasPageBlocks(key);
      if (key === "services") return services.length > 0 || hasPageBlocks(key);
      if (key === "specialists") return specialists.length > 0 || hasPageBlocks(key);
      if (key === "promos") return promos.length > 0 || hasPageBlocks(key);
      return hasPageBlocks(key);
    });
  }, [pages, locations.length, services.length, specialists.length, promos.length]);

  const currentEntityLabel = useMemo(() => {
    if (!currentEntity) return null;
    if (currentEntity.type === "location") {
      return locations.find((item) => item.id === currentEntity.id)?.name ?? null;
    }
    if (currentEntity.type === "service") {
      return services.find((item) => item.id === currentEntity.id)?.name ?? null;
    }
    if (currentEntity.type === "specialist") {
      return specialists.find((item) => item.id === currentEntity.id)?.name ?? null;
    }
    if (currentEntity.type === "promo") {
      return promos.find((item) => item.id === currentEntity.id)?.name ?? null;
    }
    return null;
  }, [currentEntity, locations, services, specialists, promos]);

  const currentPageTitle = currentEntityLabel
    ? currentEntityLabel
    : availablePageKeys.includes(activePageKey)
      ? PAGE_LABELS[activePageKey]
      : PAGE_LABELS[availablePageKeys[0] ?? "home"];

  const pagesSearchValue = pagesSearch.trim().toLowerCase();
  const matchSearch = (value: string) =>
    pagesSearchValue.length === 0 || value.toLowerCase().includes(pagesSearchValue);

  const filteredPageKeys = useMemo(
    () => availablePageKeys.filter((key) => matchSearch(PAGE_LABELS[key])),
    [availablePageKeys, pagesSearchValue]
  );
  const filteredLocationItems = useMemo(
    () => locations.filter((item) => matchSearch(item.name)),
    [locations, pagesSearchValue]
  );
  const filteredServiceItems = useMemo(
    () => services.filter((item) => matchSearch(item.name)),
    [services, pagesSearchValue]
  );
  const filteredSpecialistItems = useMemo(
    () => specialists.filter((item) => matchSearch(item.name)),
    [specialists, pagesSearchValue]
  );
  const filteredPromoItems = useMemo(
    () => promos.filter((item) => matchSearch(item.name)),
    [promos, pagesSearchValue]
  );

  const hasFilteredPagesMenuItems =
    filteredPageKeys.length > 0 ||
    filteredLocationItems.length > 0 ||
    filteredServiceItems.length > 0 ||
    filteredSpecialistItems.length > 0 ||
    filteredPromoItems.length > 0;

  useEffect(() => {
    if (!pagesMenuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (!pagesMenuRef.current) return;
      if (!pagesMenuRef.current.contains(event.target as Node)) {
        setPagesMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPagesMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [pagesMenuOpen]);

  return {
    pagesMenuOpen,
    setPagesMenuOpen,
    pagesSearch,
    setPagesSearch,
    pagesMenuRef,
    availablePageKeys,
    currentPageTitle,
    filteredPageKeys,
    filteredLocationItems,
    filteredServiceItems,
    filteredSpecialistItems,
    filteredPromoItems,
    hasFilteredPagesMenuItems,
  };
}

