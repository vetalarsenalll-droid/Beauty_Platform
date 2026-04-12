import type { CrmPanelCtx } from "../../runtime/contracts";
import { SiteMenuSettingsPrimary } from "@/features/site-builder/crm/site-menu-settings-primary";

export function MenuSettingsPanel(ctx: CrmPanelCtx) {
  return (
    <SiteMenuSettingsPrimary
      selectedBlock={ctx.block}
      activeTheme={ctx.activeTheme}
      panelTheme={ctx.panelTheme}
      currentPanelSections={ctx.currentPanelSections}
      activePanelSectionId={ctx.activePanelSectionId}
      setActivePanelSectionId={ctx.setActivePanelSectionId}
      updateBlock={ctx.updateBlock}
    />
  );
}

