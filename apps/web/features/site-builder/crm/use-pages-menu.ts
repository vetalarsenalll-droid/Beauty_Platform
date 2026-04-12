import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteDraft, SitePageKey } from "@/lib/site-builder";
import { PAGE_KEYS, PAGE_LABELS } from "./site-client-core";

type UsePagesMenuArgs = {
  pages: SiteDraft["pages"] | undefined;
  activePageKey: SitePageKey;
};

export function usePagesMenu({ pages, activePageKey }: UsePagesMenuArgs) {
  const [pagesMenuOpen, setPagesMenuOpen] = useState(false);
  const [pagesSearch, setPagesSearch] = useState("");
  const pagesMenuRef = useRef<HTMLDivElement | null>(null);

  const hasPageBlocks = (key: SitePageKey) => (pages?.[key]?.length ?? 0) > 0;

  const availablePageKeys = useMemo<SitePageKey[]>(() => {
    return PAGE_KEYS.filter((key) => {
      if (key === "home") return true;
      return hasPageBlocks(key);
    });
  }, [pages]);

  const currentPageTitle = availablePageKeys.includes(activePageKey)
    ? PAGE_LABELS[activePageKey]
    : PAGE_LABELS[availablePageKeys[0] ?? "home"];

  const pagesSearchValue = pagesSearch.trim().toLowerCase();
  const matchSearch = (value: string) =>
    pagesSearchValue.length === 0 || value.toLowerCase().includes(pagesSearchValue);

  const filteredPageKeys = useMemo(
    () => availablePageKeys.filter((key) => matchSearch(PAGE_LABELS[key])),
    [availablePageKeys, pagesSearchValue]
  );

  const hasFilteredPagesMenuItems = filteredPageKeys.length > 0;

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
    hasFilteredPagesMenuItems,
  };
}