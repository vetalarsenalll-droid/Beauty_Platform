import type { BlockVersion, CrmPanelCtx } from "../contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { BlockEditor, BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";
import { renderGenericSettingsPanel } from "./generic-settings-panel";

function updateSelected(ctx: CrmPanelCtx, next: unknown) {
  ctx.updateBlock(ctx.block.id, () => next as any);
}

export function makeGenericVersion(
  blockCode: BlockVersion["blockCode"],
  type: "loader" | "booking" | "aisha",
  variant: "v1" | "v2" | "v3"
): BlockVersion {
  return {
    blockCode,
    normalizeData: (input) => (typeof input === "object" && input ? (input as Record<string, unknown>) : {}),
    createDefault: ({ accountName }) => {
      const base = ((defaultBlockData as any)[type] ?? {}) as Record<string, unknown>;
      const baseStyle =
        typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
      return {
        id: makeBlockId(),
        type,
        variant,
        data: {
          ...base,
          title: typeof base.title === "string" ? base.title : accountName,
          style: { ...defaultBlockStyle, ...baseStyle },
        },
      } as any;
    },
    renderCRM: () => "",
    renderPublic: () => "",
    contentPanel: (ctx) => (
      <div className="px-1 pb-8 pt-1">
        <BlockEditor
          block={ctx.block}
          accountName={ctx.accountName}
          branding={ctx.branding}
          accountProfile={ctx.accountProfile}
          locations={ctx.locations}
          services={ctx.services}
          specialists={ctx.specialists}
          promos={ctx.promos}
          activeSectionId="main"
          onChange={(next) => updateSelected(ctx, next)}
        />
      </div>
    ),
    settingsPanel: (ctx) => <>{renderGenericSettingsPanel(ctx)}</>,
    drawers: (ctx) => {
      if (ctx.rightPanel !== "settings") return "";
      if (!ctx.activePanelSectionId) return "";
      return (
        <BlockStyleEditor
          block={ctx.block}
          theme={ctx.activeTheme}
          activeSectionId={ctx.activePanelSectionId}
          onChange={(next) => updateSelected(ctx, next)}
        />
      );
    },
    actions: () => {},
  };
}

