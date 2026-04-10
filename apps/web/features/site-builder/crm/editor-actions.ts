import type { Dispatch, SetStateAction } from "react";
import type {
  BlockType,
  SiteBlock,
  SiteDraft,
  SitePageKey,
  SiteTheme,
} from "@/lib/site-builder";
import { isSystemBlockType, createBlock, defaultBlockStyle } from "./site-client-core";
import { ensureEntityPages, ensurePages, resolveEntityPageKey } from "./editor-draft-helpers";
import { normalizeBlockStyle, updateBlockStyle } from "./site-renderer";
import type { CurrentEntity } from "./site-client-core";

type SetDraftTracked = (
  updater: (prev: SiteDraft) => SiteDraft,
  options?: { recordHistory?: boolean; groupKey?: string }
) => void;

type BuildEditorActionsArgs = {
  accountName: string;
  activePage: SitePageKey;
  currentEntity: CurrentEntity;
  homeBlocks: SiteBlock[];
  pageBlocks: SiteBlock[];
  displayBlocks: SiteBlock[];
  sharedMenuBlock: SiteBlock | null;
  entityPageKey: ReturnType<typeof resolveEntityPageKey>;
  activeTheme: SiteTheme;
  activeBlockId: string | null;
  selectedId: string | null;
  pendingDeleteBlockId: string | null;
  draftRef: { current: SiteDraft };
  setDraftTracked: SetDraftTracked;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setInsertIndex: Dispatch<SetStateAction<number | null>>;
  setPendingDeleteBlockId: Dispatch<SetStateAction<string | null>>;
  setSaving: Dispatch<SetStateAction<string | null>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setPublicPage: Dispatch<
    SetStateAction<{
      id: number;
      status: string;
      draftJson: SiteDraft;
      publishedVersionId: number | null;
    }>
  >;
};

export function buildEditorActions(args: BuildEditorActionsArgs) {
  const updateBlock = (
    id: string,
    updater: (block: SiteBlock) => SiteBlock,
    options?: { recordHistory?: boolean }
  ) => {
    args.setDraftTracked((prev) => {
      const pages = { ...ensurePages(prev) };
      const entityPages = { ...ensureEntityPages(prev) };
      const entityPageKey = resolveEntityPageKey(args.currentEntity);
      const pageKey: SitePageKey = entityPageKey ?? args.activePage;
      const entityId = args.currentEntity ? String(args.currentEntity.id) : null;
      const prevHome = pages.home ?? prev.blocks;
      const prevPage =
        entityId && entityPageKey && entityPages[entityPageKey]?.[entityId]
          ? entityPages[entityPageKey][entityId]
          : pages[pageKey] ?? prev.blocks;

      const updateList = (blocks: SiteBlock[]) =>
        blocks.map((block) => (block.id === id ? updater(block) : block));

      const nextHome = prevHome.some((block) => block.id === id)
        ? updateList(prevHome)
        : prevHome;
      const nextPage = prevPage.some((block) => block.id === id)
        ? updateList(prevPage)
        : prevPage;

      pages.home = nextHome;
      if (entityId && entityPageKey) {
        const nextEntityForKey = { ...(entityPages[entityPageKey] ?? {}) };
        nextEntityForKey[entityId] = nextPage;
        entityPages[entityPageKey] = nextEntityForKey;
      } else {
        pages[pageKey] = pageKey === "home" ? nextHome : nextPage;
      }

      return { ...prev, pages, entityPages, blocks: pages.home ?? prev.blocks };
    }, { ...options, groupKey: `block:${id}` });
  };

  const applyThemePatch = (prevTheme: SiteTheme, patch: Partial<SiteTheme>): SiteTheme => {
    const nextMode = patch.mode ?? prevTheme.mode ?? "light";
    const lightPalette = { ...prevTheme.lightPalette };
    const darkPalette = { ...prevTheme.darkPalette };
    if (patch.lightPalette) Object.assign(lightPalette, patch.lightPalette);
    if (patch.darkPalette) Object.assign(darkPalette, patch.darkPalette);

    const palettePatch: Partial<SiteTheme> = { ...patch };
    delete (palettePatch as { mode?: string }).mode;
    delete (palettePatch as { lightPalette?: SiteTheme }).lightPalette;
    delete (palettePatch as { darkPalette?: SiteTheme }).darkPalette;

    const targetPalette = nextMode === "dark" ? darkPalette : lightPalette;
    Object.assign(targetPalette, palettePatch);

    darkPalette.radius = lightPalette.radius;
    darkPalette.buttonRadius = lightPalette.buttonRadius;
    darkPalette.blockSpacing = lightPalette.blockSpacing;

    const activePalette = nextMode === "dark" ? darkPalette : lightPalette;
    return {
      ...prevTheme,
      ...activePalette,
      mode: nextMode,
      lightPalette,
      darkPalette,
    };
  };

  const setThemeMode = (mode: "light" | "dark") => {
    args.setDraftTracked((prev) => ({
      ...prev,
      theme: applyThemePatch(prev.theme, { mode }),
    }), { groupKey: "theme-mode" });
  };

  const updateBlocks = (nextBlocks: SiteBlock[], options?: { recordHistory?: boolean }) => {
    const entityId = args.currentEntity ? String(args.currentEntity.id) : null;
    const groupKey = `blocks:${args.entityPageKey ?? args.activePage}:${entityId ?? "root"}`;
    args.setDraftTracked((prev) => {
      const pages = { ...ensurePages(prev) };
      const entityPages = { ...ensureEntityPages(prev) };
      const entityPageKey = resolveEntityPageKey(args.currentEntity);
      const pageKey: SitePageKey = entityPageKey ?? args.activePage;
      const entityId = args.currentEntity ? String(args.currentEntity.id) : null;

      if (entityId && entityPageKey) {
        const nextEntityForKey = { ...(entityPages[entityPageKey] ?? {}) };
        nextEntityForKey[entityId] = nextBlocks;
        entityPages[entityPageKey] = nextEntityForKey;
      } else {
        pages[pageKey] = nextBlocks;
      }

      if (pageKey === "home") pages.home = nextBlocks;
      const home = pages.home ?? prev.blocks;
      return { ...prev, pages, entityPages, blocks: home };
    }, { ...options, groupKey });
  };

  const insertBlock = (
    type: BlockType,
    index?: number,
    variant?: "v1" | "v2" | "v3" | "v4" | "v5"
  ) => {
    const block = createBlock(type);
    const targetVariant = variant ?? block.variant;
    if (type === "menu") {
      const currentStyle =
        typeof (block.data as Record<string, unknown>).style === "object" &&
        (block.data as Record<string, unknown>).style
          ? { ...((block.data as Record<string, unknown>).style as Record<string, unknown>) }
          : { ...defaultBlockStyle };
      block.data = {
        ...block.data,
        accountTitle: args.accountName,
        showCompanyName: true,
        menuHeight: targetVariant === "v1" ? 64 : 56,
        socialIconSize: 40,
        style:
          targetVariant === "v1" || targetVariant === "v2"
            ? { ...currentStyle, radius: 0 }
            : currentStyle,
      };
    }
    if (type === "cover" && targetVariant === "v2") {
      const currentStyle =
        typeof (block.data as Record<string, unknown>).style === "object" &&
        (block.data as Record<string, unknown>).style
          ? { ...((block.data as Record<string, unknown>).style as Record<string, unknown>) }
          : { ...defaultBlockStyle };
      block.data = {
        ...block.data,
        align: "center",
        style: {
          ...currentStyle,
          textAlign: "center",
          textAlignHeading: "center",
          textAlignSubheading: "center",
        },
      };
    }
    if (variant) block.variant = variant;

    if (type === "menu" && args.activePage !== "home") {
      const existingMenu = args.homeBlocks.find((item) => item.type === "menu");
      if (!existingMenu) {
        const nextHome = [block, ...args.homeBlocks];
        args.setDraftTracked((prev) => ({
          ...prev,
          pages: { ...ensurePages(prev), home: nextHome },
          blocks: nextHome,
        }));
        args.setSelectedId(block.id);
      } else {
        args.setSelectedId(existingMenu.id);
      }
      args.setInsertIndex(null);
      return;
    }

    const next = [...args.pageBlocks];
    const offset = args.sharedMenuBlock ? 1 : 0;
    const rawIndex = typeof index === "number" && index >= 0 ? index : next.length + offset;
    const targetIndex = Math.max(0, Math.min(rawIndex - offset, next.length));
    next.splice(targetIndex, 0, block);
    updateBlocks(next);
    args.setSelectedId(block.id);
    args.setInsertIndex(null);
  };

  const removeBlock = (id: string) => {
    if (args.sharedMenuBlock && args.sharedMenuBlock.id === id && args.activePage !== "home") return;
    if (
      !args.entityPageKey &&
      (args.activePage === "client" || args.activePage === "booking") &&
      args.pageBlocks.some((block) => block.id === id && isSystemBlockType(block.type))
    ) {
      return;
    }
    updateBlocks(args.pageBlocks.filter((block) => block.id !== id));
    if (args.selectedId === id) {
      const next = args.displayBlocks.find((block) => block.id !== id);
      args.setSelectedId(next?.id ?? null);
    }
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    if (args.sharedMenuBlock && args.sharedMenuBlock.id === id && args.activePage !== "home") return;
    if (
      !args.entityPageKey &&
      (args.activePage === "client" || args.activePage === "booking") &&
      args.pageBlocks.some((block) => block.id === id && isSystemBlockType(block.type))
    ) {
      return;
    }
    const idx = args.pageBlocks.findIndex((block) => block.id === id);
    if (idx < 0) return;
    const next = [...args.pageBlocks];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    updateBlocks(next);
  };

  const confirmRemoveBlock = () => {
    if (!args.pendingDeleteBlockId) return;
    removeBlock(args.pendingDeleteBlockId);
    args.setPendingDeleteBlockId(null);
  };

  const clampBlockOffset = (value: number) => Math.max(0, Math.min(240, Math.round(value)));

  const adjustSpacingAt = (
    slotIndex: number,
    deltaY: number,
    target: "prev" | "next" | null = null
  ) => {
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    const prevBlock = args.displayBlocks[slotIndex - 1] ?? null;
    const nextBlock = args.displayBlocks[slotIndex] ?? null;
    if (slotIndex === 0 && nextBlock) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(normalizeBlockStyle(block, args.activeTheme).marginTop + deltaY),
        })
      );
      return;
    }
    if (target === "next" && nextBlock) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(normalizeBlockStyle(block, args.activeTheme).marginTop + deltaY),
        })
      );
      return;
    }
    if (target === "prev" && prevBlock) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(normalizeBlockStyle(block, args.activeTheme).marginBottom + deltaY),
        })
      );
      return;
    }
    if (nextBlock && args.activeBlockId && nextBlock.id === args.activeBlockId) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(normalizeBlockStyle(block, args.activeTheme).marginTop + deltaY),
        })
      );
      return;
    }
    if (prevBlock && args.activeBlockId && prevBlock.id === args.activeBlockId) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(normalizeBlockStyle(block, args.activeTheme).marginBottom + deltaY),
        })
      );
      return;
    }
    if (prevBlock) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(normalizeBlockStyle(block, args.activeTheme).marginBottom + deltaY),
        })
      );
      return;
    }
    if (nextBlock) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(normalizeBlockStyle(block, args.activeTheme).marginTop + deltaY),
        })
      );
    }
  };

  const savePublic = async (publish: boolean): Promise<boolean> => {
    args.setSaving("public");
    args.setMessage(null);
    const currentDraft = args.draftRef.current;
    const payloadDraft = { ...currentDraft, blocks: currentDraft.pages?.home ?? currentDraft.blocks };
    try {
      const response = await fetch("/api/v1/crm/settings/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftJson: payloadDraft, publish }),
      });
      if (response.ok) {
        const data = await response.json();
        args.setPublicPage(data.data);
        args.setMessage(publish ? "Страница опубликована." : "Черновик сохранен.");
        return true;
      }
      args.setMessage("Не удалось сохранить страницу.");
      return false;
    } catch {
      args.setMessage("Не удалось сохранить страницу.");
      return false;
    } finally {
      args.setSaving(null);
    }
  };

  const saveDraftSilently = async () => {
    const currentDraft = args.draftRef.current;
    const payloadDraft = { ...currentDraft, blocks: currentDraft.pages?.home ?? currentDraft.blocks };
    try {
      const response = await fetch("/api/v1/crm/settings/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftJson: payloadDraft, publish: false }),
      });
      if (!response.ok) return;
      const data = await response.json();
      args.setPublicPage(data.data);
    } catch {
      // silent background save
    }
  };

  return {
    updateBlock,
    setThemeMode,
    updateBlocks,
    insertBlock,
    removeBlock,
    moveBlock,
    confirmRemoveBlock,
    adjustSpacingAt,
    savePublic,
    saveDraftSilently,
  };
}
