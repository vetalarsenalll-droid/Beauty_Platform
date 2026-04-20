import type { CrmPanelCtx } from "../../runtime/contracts";
import { SiteMenuButtonDrawer } from "@/features/site-builder/crm/site-menu-button-drawer";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";

export function MenuV2Drawers(ctx: CrmPanelCtx) {
  if (ctx.rightPanel !== "settings") return null;
  if (!ctx.activePanelSectionId) return null;

  if (ctx.activePanelSectionId === "button") {
    return (
      <SiteMenuButtonDrawer
        selectedBlock={ctx.block}
        activeTheme={ctx.activeTheme}
        accountProfile={ctx.accountProfile}
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


