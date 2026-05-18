import { useEffect, useRef, useState } from "react";
import type { SiteDraft, SitePageKey } from "@/lib/site-builder";
import { PAGE_KEYS, PAGE_LABELS } from "./site-client-core";
import type { CurrentEntity } from "./site-client-core";

const PAGE_MENU_ORDER: SitePageKey[] = [
  "home",
  "booking",
  "client",
  "clientLogin",
  "clientCabinet",
  "legal",
  "locations",
  "services",
  "specialists",
  "promos",
];

type UsePagesMenuArgs = {
  pages: SiteDraft["pages"] | undefined;
  activePageKey: SitePageKey;
  activeEntity: CurrentEntity;
  locationsCount: number;
  servicesCount: number;
  specialistsCount: number;
  legalDocuments: Array<{ versionId: number; title: string }>;
  locationProfiles: Array<{ id: number; name: string }>;
  serviceProfiles: Array<{ id: number; name: string }>;
  specialistProfiles: Array<{ id: number; name: string }>;
};

export type PagesMenuItem =
  | { kind: "page"; key: SitePageKey; label: string }
  | { kind: "client-subpage"; key: "clientLogin" | "clientCabinet"; label: string }
  | { kind: "legal-document"; key: "legal"; versionId: number; label: string }
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
  legalDocuments,
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
    if (key === "client") return true;
    if (key === "clientLogin") return true;
    if (key === "clientCabinet") return true;
    if (key === "legal") return true;
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
  const clientSubpageItems: PagesMenuItem[] = [
    { kind: "client-subpage", key: "clientLogin", label: "\u0412\u0445\u043e\u0434" },
    { kind: "client-subpage", key: "clientCabinet", label: "\u041a\u0430\u0431\u0438\u043d\u0435\u0442" },
  ];
  const legalDocumentItems: PagesMenuItem[] = legalDocuments.map((item) => ({
    kind: "legal-document",
    key: "legal",
    versionId: item.versionId,
    label: item.title || `\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442 ${item.versionId}`,
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
  const allMenuItems: PagesMenuItem[] = [];
  pageItems.forEach((item) => {
    if (item.key === "clientLogin" || item.key === "clientCabinet") return;
    if (item.key === "client") {
      allMenuItems.push(...clientSubpageItems);
      return;
    }
    if (item.key === "legal") {
      allMenuItems.push(...legalDocumentItems);
      return;
    }
    allMenuItems.push(item);
  });
  allMenuItems.push(...locationProfileItems, ...specialistProfileItems, ...serviceProfileItems);
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
    activeEntity?.type === "legalDocument" && activePageKey === "legal"
        ? allMenuItems.find((item) => item.kind === "legal-document" && item.versionId === activeEntity.id)?.label ??
          PAGE_LABELS[activePageKey]
        : activeEntity &&
            ((activeEntity.type === "location" && activePageKey === "locations") ||
              (activeEntity.type === "service" && activePageKey === "services") ||
              (activeEntity.type === "specialist" && activePageKey === "specialists"))
          ? allMenuItems.find(
              (item) =>
                item.kind === "entity-profile" &&
                item.entityType === activeEntity.type &&
                item.entityId === activeEntity.id
            )?.label ?? PAGE_LABELS[activePageKey]
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
