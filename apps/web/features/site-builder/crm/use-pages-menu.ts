import { useEffect, useRef, useState } from "react";
import type { SiteDraft, SitePageKey } from "@/lib/site-builder";
import { PAGE_KEYS, PAGE_LABELS } from "./site-client-core";
import type { CurrentEntity } from "./site-client-core";

const PAGE_MENU_ORDER: SitePageKey[] = [
  "home",
  "booking",
  "locations",
  "services",
  "specialists",
  "promos",
  "client",
];

type UsePagesMenuArgs = {
  pages: SiteDraft["pages"] | undefined;
  activePageKey: SitePageKey;
  activeEntity: CurrentEntity;
  locationsCount: number;
  servicesCount: number;
  specialistsCount: number;
  locationProfiles: Array<{ id: number; name: string }>;
  serviceProfiles: Array<{ id: number; name: string }>;
  specialistProfiles: Array<{ id: number; name: string }>;
};

export type PagesMenuItem =
  | { kind: "page"; key: SitePageKey; label: string }
  | {
      kind: "entity-profile";
      key: SitePageKey;
      entityType: "location" | "service" | "specialist";
      entityId: number;
      label: string;
    };

export function usePagesMenu({
  pages,
  activePageKey,
  activeEntity,
  locationsCount,
  servicesCount,
  specialistsCount,
  locationProfiles,
  serviceProfiles,
  specialistProfiles,
}: UsePagesMenuArgs) {
  const [pagesMenuOpen, setPagesMenuOpen] = useState(false);
  const [pagesSearch, setPagesSearch] = useState("");
  const pagesMenuRef = useRef<HTMLDivElement | null>(null);

  const hasPageBlocks = (key: SitePageKey) => (pages?.[key]?.length ?? 0) > 0;

  const orderedPageKeys = PAGE_MENU_ORDER.filter((key) => PAGE_KEYS.includes(key));
  const availablePageKeys: SitePageKey[] = orderedPageKeys.filter((key) => {
    if (key === "home") return true;
    if (key === "booking") return true;
    if (key === "promos") return true;
    if (key === "client") return false;
    if (key === "locations") return locationsCount > 0 || hasPageBlocks(key);
    if (key === "services") return servicesCount > 0 || hasPageBlocks(key);
    if (key === "specialists") return specialistsCount > 0 || hasPageBlocks(key);
    return hasPageBlocks(key);
  });

  const pagesSearchValue = pagesSearch.trim().toLowerCase();
  const matchSearch = (value: string) =>
    pagesSearchValue.length === 0 || value.toLowerCase().includes(pagesSearchValue);

  const pageItems: PagesMenuItem[] = availablePageKeys.map((key) => ({
    kind: "page",
    key,
    label: PAGE_LABELS[key],
  }));
  const locationProfileItems: PagesMenuItem[] = locationProfiles.map((item) => ({
    kind: "entity-profile",
    key: "locations",
    entityType: "location",
    entityId: item.id,
    label: item.name,
  }));
  const serviceProfileItems: PagesMenuItem[] = serviceProfiles.map((item) => ({
    kind: "entity-profile",
    key: "services",
    entityType: "service",
    entityId: item.id,
    label: item.name,
  }));
  const specialistProfileItems: PagesMenuItem[] = specialistProfiles.map((item) => ({
    kind: "entity-profile",
    key: "specialists",
    entityType: "specialist",
    entityId: item.id,
    label: item.name,
  }));
  const allMenuItems: PagesMenuItem[] = [
    ...pageItems,
    ...locationProfileItems,
    ...specialistProfileItems,
    ...serviceProfileItems,
  ];
  const filteredMenuItems = allMenuItems.filter((item) => matchSearch(item.label));

  const hasFilteredPagesMenuItems = filteredMenuItems.length > 0;

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

  const currentPageTitle =
    activeEntity &&
    ((activeEntity.type === "location" && activePageKey === "locations") ||
      (activeEntity.type === "service" && activePageKey === "services") ||
      (activeEntity.type === "specialist" && activePageKey === "specialists"))
      ? allMenuItems.find(
          (item) =>
            item.kind === "entity-profile" &&
            item.entityType === activeEntity.type &&
            item.entityId === activeEntity.id
        )?.label ??
        PAGE_LABELS[activePageKey]
      : PAGE_LABELS[activePageKey];

  return {
    pagesMenuOpen,
    setPagesMenuOpen,
    pagesSearch,
    setPagesSearch,
    pagesMenuRef,
    availablePageKeys,
    currentPageTitle,
    filteredMenuItems,
    hasFilteredPagesMenuItems,
  };
}
