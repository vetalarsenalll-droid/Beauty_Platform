import type { ReactNode } from "react";
import type { EditorSection } from "@/features/site-builder/crm/site-client-core";
import type { CrmPanelCtx } from "../contracts";

export function renderGenericSettingsPanel(ctx: CrmPanelCtx): ReactNode {
  const { currentPanelSections, activePanelSectionId, setActivePanelSectionId, panelTheme } = ctx;
  return currentPanelSections.map((section: EditorSection) => (
    <button
      key={section.id}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setActivePanelSectionId((prev) => (prev === section.id ? null : section.id));
      }}
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
      style={{
        borderColor: activePanelSectionId === section.id ? panelTheme.accent : panelTheme.border,
        backgroundColor: panelTheme.panel,
        color: activePanelSectionId === section.id ? panelTheme.text : panelTheme.muted,
      }}
    >
      <span>{section.label}</span>
      <span className="text-xs">›</span>
    </button>
  ));
}

