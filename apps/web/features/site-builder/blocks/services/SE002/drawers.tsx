import type { CrmPanelCtx } from "../../runtime/contracts";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";

export function SE002Drawers(ctx: CrmPanelCtx) {
  if (ctx.rightPanel !== "settings") return null;
  if (!ctx.activePanelSectionId) return null;

  return (
    <BlockStyleEditor
      block={ctx.block}
      theme={ctx.activeTheme}
      activeSectionId={ctx.activePanelSectionId}
      onChange={(next) => ctx.updateBlock(ctx.block.id, () => next)}
    />
  );
}
