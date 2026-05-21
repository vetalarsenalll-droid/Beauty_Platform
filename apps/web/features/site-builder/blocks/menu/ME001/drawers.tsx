import type { CrmPanelCtx } from "../../runtime/contracts";
import { SiteMenuButtonDrawer } from "@/features/site-builder/crm/site-menu-button-drawer";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";

export function MenuDrawers(ctx: CrmPanelCtx) {
  if (ctx.rightPanel !== "settings") return null;
  const activeDrawerKey =
    ctx.coverDrawerKey === "colors" ||
    ctx.coverDrawerKey === "typography" ||
    ctx.coverDrawerKey === "button"
      ? ctx.coverDrawerKey
      : null;
  if (!activeDrawerKey) return null;

  if (activeDrawerKey === "button") {
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
      activeSectionId={activeDrawerKey}
      onChange={(next) => ctx.updateBlock(ctx.block.id, () => next)}
    />
  );
}
