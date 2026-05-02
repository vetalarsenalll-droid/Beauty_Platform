import type { CrmPanelCtx } from "../../runtime/contracts";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";
import { SiteServicesSettingsDrawer } from "@/features/site-builder/crm/site-services-settings-drawer";

export function SE001Drawers(ctx: CrmPanelCtx) {
  if (ctx.rightPanel !== "settings") return null;
  if (!ctx.activePanelSectionId) return null;

  if (ctx.activePanelSectionId === "typography") {
    return (
      <BlockStyleEditor
        block={ctx.block}
        theme={ctx.activeTheme}
        activeSectionId="typography"
        onChange={(next) => ctx.updateBlock(ctx.block.id, () => next)}
      />
    );
  }

  if (
    ctx.activePanelSectionId === "button" ||
    ctx.activePanelSectionId === "filters" ||
    ctx.activePanelSectionId === "servicePage" ||
    ctx.activePanelSectionId === "servicesList"
  ) {
    return (
      <SiteServicesSettingsDrawer
        block={ctx.block}
        activeTheme={ctx.activeTheme}
        activeSectionId={ctx.activePanelSectionId}
        locations={ctx.locations}
        updateBlock={ctx.updateBlock}
      />
    );
  }

  return (
    <BlockStyleEditor
      block={ctx.block}
      theme={ctx.activeTheme}
      activeSectionId={ctx.activePanelSectionId}
      onChange={(next) => ctx.updateBlock(ctx.block.id, () => next)}
    />
  );
}
