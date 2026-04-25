import type { CrmPanelCtx } from "../../runtime/contracts";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";
import { SiteServicesSettingsDrawer } from "@/features/site-builder/crm/site-services-settings-drawer";

export function SE002Drawers(ctx: CrmPanelCtx) {
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

  if (ctx.activePanelSectionId === "button" || ctx.activePanelSectionId === "servicePage") {
    return (
      <SiteServicesSettingsDrawer
        block={ctx.block}
        _activeTheme={ctx.activeTheme}
        activeSectionId={ctx.activePanelSectionId}
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
