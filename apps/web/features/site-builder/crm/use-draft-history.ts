import { useRef, useState } from "react";
import type { SiteDraft } from "@/lib/site-builder";

type HistoryState = {
  past: SiteDraft[];
  future: SiteDraft[];
};

type HistoryMeta = {
  lastGroupKey: string | null;
  lastRecordedAt: number;
};

const cloneDraftSnapshot = (value: SiteDraft): SiteDraft =>
  JSON.parse(JSON.stringify(value)) as SiteDraft;

export function useDraftHistory(initialDraft: SiteDraft, onTravel?: () => void) {
  const [draft, setDraft] = useState<SiteDraft>(initialDraft);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const draftRef = useRef<SiteDraft>(draft);
  const historyRef = useRef<HistoryState>({ past: [], future: [] });
  const historyMetaRef = useRef<HistoryMeta>({
    lastGroupKey: null,
    lastRecordedAt: 0,
  });

  const setDraftTracked = (
    updater: (prev: SiteDraft) => SiteDraft,
    options?: { recordHistory?: boolean; groupKey?: string }
  ) => {
    const recordHistory = options?.recordHistory !== false;
    const groupKey = options?.groupKey ?? null;
    setDraft((prev) => {
      const next = updater(prev);
      if (!recordHistory || Object.is(next, prev)) {
        draftRef.current = next;
        return next;
      }
      const now = Date.now();
      const shouldCoalesce =
        Boolean(groupKey) &&
        historyMetaRef.current.lastGroupKey === groupKey &&
        now - historyMetaRef.current.lastRecordedAt < 700;
      if (!shouldCoalesce) {
        historyRef.current.past.push(cloneDraftSnapshot(prev));
      }
      if (historyRef.current.past.length > 100) {
        historyRef.current.past.shift();
      }
      historyRef.current.future = [];
      setCanUndo(historyRef.current.past.length > 0);
      setCanRedo(false);
      historyMetaRef.current = { lastGroupKey: groupKey, lastRecordedAt: now };
      draftRef.current = next;
      return next;
    });
  };

  const undoDraft = () => {
    const prevSnapshot = historyRef.current.past.pop();
    if (!prevSnapshot) return;
    setDraft((current) => {
      historyRef.current.future.push(cloneDraftSnapshot(current));
      const next = cloneDraftSnapshot(prevSnapshot);
      draftRef.current = next;
      return next;
    });
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(historyRef.current.future.length > 0);
    historyMetaRef.current = { lastGroupKey: null, lastRecordedAt: 0 };
    onTravel?.();
  };

  const redoDraft = () => {
    const nextSnapshot = historyRef.current.future.pop();
    if (!nextSnapshot) return;
    setDraft((current) => {
      historyRef.current.past.push(cloneDraftSnapshot(current));
      const next = cloneDraftSnapshot(nextSnapshot);
      draftRef.current = next;
      return next;
    });
    setCanUndo(historyRef.current.past.length > 0);
    setCanRedo(historyRef.current.future.length > 0);
    historyMetaRef.current = { lastGroupKey: null, lastRecordedAt: 0 };
    onTravel?.();
  };

  return {
    draft,
    setDraft,
    draftRef,
    setDraftTracked,
    undoDraft,
    redoDraft,
    canUndo,
    canRedo,
  };
}
