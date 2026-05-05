import type { CrmPanelCtx } from "../../runtime/contracts";
import { BO001SettingsDrawer } from "./settings-drawer";

export function BO001Drawers(ctx: CrmPanelCtx) {
  if (ctx.rightPanel !== "settings") return null;
  if (!ctx.activePanelSectionId) return null;

  if (
    ctx.activePanelSectionId === "typography" ||
    ctx.activePanelSectionId === "panels" ||
    ctx.activePanelSectionId === "button"
  ) {
    return (
      <BO001SettingsDrawer
        block={ctx.block}
        activeTheme={ctx.activeTheme}
        activeSectionId={ctx.activePanelSectionId}
        updateBlock={ctx.updateBlock}
      />
    );
  }

  return null;
}
