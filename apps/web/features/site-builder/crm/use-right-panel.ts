import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SiteBlock } from "@/lib/site-builder";

type UpdateBlock = (
  id: string,
  updater: (block: SiteBlock) => SiteBlock,
  options?: { recordHistory?: boolean }
) => void;

type UseRightPanelArgs = {
  rightPanel: "content" | "settings" | null;
  setRightPanel: Dispatch<SetStateAction<"content" | "settings" | null>>;
  panelTargetKey: string | null;
  currentPanelSignature: string | null;
  selectedBlock: SiteBlock | null;
  savePublic: (publish: boolean) => Promise<boolean>;
  updateBlock: UpdateBlock;
  setActivePanelSectionId: Dispatch<SetStateAction<string | null>>;
  setCoverDrawerKey: Dispatch<
    SetStateAction<"slider" | "colors" | "typography" | "button" | "animation" | null>
  >;
  setCoverWidthModalOpen: Dispatch<SetStateAction<boolean>>;
  animationMs: number;
};

export function useRightPanel({
  rightPanel,
  setRightPanel,
  panelTargetKey,
  currentPanelSignature,
  selectedBlock,
  savePublic,
  updateBlock,
  setActivePanelSectionId,
  setCoverDrawerKey,
  setCoverWidthModalOpen,
  animationMs,
}: UseRightPanelArgs) {
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);
  const [showPanelExitConfirm, setShowPanelExitConfirm] = useState(false);
  const [panelBaselineKey, setPanelBaselineKey] = useState<string | null>(null);
  const [panelBaselineSignature, setPanelBaselineSignature] = useState<string | null>(null);
  const [panelBaselineBlock, setPanelBaselineBlock] = useState<SiteBlock | null>(null);
  const rightPanelCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panelHasUnsavedChanges = Boolean(
    rightPanel &&
      currentPanelSignature &&
      panelBaselineSignature !== null &&
      currentPanelSignature !== panelBaselineSignature
  );

  useEffect(() => {
    let raf: number | null = null;
    const syncPanelBaseline = (sync: () => void) => {
      raf = window.requestAnimationFrame(sync);
    };
    if (!rightPanel) {
      syncPanelBaseline(() => {
        setPanelBaselineKey(null);
        setPanelBaselineSignature(null);
        setPanelBaselineBlock(null);
        setShowPanelExitConfirm(false);
      });
      return () => {
        if (raf !== null) window.cancelAnimationFrame(raf);
      };
    }
    if (!panelTargetKey || !currentPanelSignature) {
      return () => {
        if (raf !== null) window.cancelAnimationFrame(raf);
      };
    }
    if (panelBaselineKey !== panelTargetKey) {
      syncPanelBaseline(() => {
        setPanelBaselineKey(panelTargetKey);
        setPanelBaselineSignature(currentPanelSignature);
        setPanelBaselineBlock(
          selectedBlock
            ? (JSON.parse(JSON.stringify(selectedBlock)) as SiteBlock)
            : null
        );
        setActivePanelSectionId(null);
        setCoverDrawerKey(null);
        setCoverWidthModalOpen(false);
        setShowPanelExitConfirm(false);
      });
    }
    return () => {
      if (raf !== null) window.cancelAnimationFrame(raf);
    };
  }, [
    rightPanel,
    panelTargetKey,
    currentPanelSignature,
    panelBaselineKey,
    selectedBlock,
    setActivePanelSectionId,
    setCoverDrawerKey,
    setCoverWidthModalOpen,
  ]);

  useEffect(() => {
    if (!rightPanel) return;
    if (rightPanelCloseTimerRef.current) {
      clearTimeout(rightPanelCloseTimerRef.current);
      rightPanelCloseTimerRef.current = null;
    }
    const raf = window.requestAnimationFrame(() => {
      setIsRightPanelVisible(false);
      window.requestAnimationFrame(() => setIsRightPanelVisible(true));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [rightPanel]);

  useEffect(() => {
    return () => {
      if (rightPanelCloseTimerRef.current) {
        clearTimeout(rightPanelCloseTimerRef.current);
      }
    };
  }, []);

  const closeRightPanel = useCallback(() => {
    if (!rightPanel) return;
    setIsRightPanelVisible(false);
    if (rightPanelCloseTimerRef.current) {
      clearTimeout(rightPanelCloseTimerRef.current);
    }
    rightPanelCloseTimerRef.current = setTimeout(() => {
      setRightPanel(null);
      rightPanelCloseTimerRef.current = null;
    }, animationMs);
  }, [rightPanel, setRightPanel, animationMs]);

  const savePanelDraft = async (closeAfterSave: boolean) => {
    const ok = await savePublic(false);
    if (closeAfterSave && ok) {
      closeRightPanel();
      setShowPanelExitConfirm(false);
      return;
    }
    if (ok && currentPanelSignature) {
      setPanelBaselineSignature(currentPanelSignature);
    }
  };

  const requestClosePanel = () => {
    if (!rightPanel) return;
    if (!panelHasUnsavedChanges) {
      closeRightPanel();
      return;
    }
    setShowPanelExitConfirm(true);
  };

  const closePanelWithoutSave = () => {
    if (panelBaselineBlock) {
      updateBlock(
        panelBaselineBlock.id,
        () => JSON.parse(JSON.stringify(panelBaselineBlock)) as SiteBlock,
        { recordHistory: false }
      );
    }
    setShowPanelExitConfirm(false);
    closeRightPanel();
  };

  return {
    isRightPanelVisible,
    showPanelExitConfirm,
    setShowPanelExitConfirm,
    closeRightPanel,
    savePanelDraft,
    requestClosePanel,
    closePanelWithoutSave,
  };
}

