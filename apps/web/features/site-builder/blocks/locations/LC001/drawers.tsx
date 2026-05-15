import type { CrmPanelCtx } from "../../runtime/contracts";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";
import { LC001SettingsDrawer } from "./settings-drawer";
import { RatingSettingsPanel } from "@/features/site-builder/blocks/rating-settings-panel";

export function LC001Drawers(ctx: CrmPanelCtx) {
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
    ctx.activePanelSectionId === "servicesList" ||
    ctx.activePanelSectionId === "reviews"
  ) {
    if (ctx.activePanelSectionId === "reviews") {
      return <RatingSettingsPanel block={ctx.block} activeTheme={ctx.activeTheme} updateBlock={ctx.updateBlock} />;
    }
    return (
      <LC001SettingsDrawer
        block={ctx.block}
        activeTheme={ctx.activeTheme}
        activeSectionId={ctx.activePanelSectionId}
        locationsCount={ctx.locations.length}
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
