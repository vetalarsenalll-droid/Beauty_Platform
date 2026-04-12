import type { BlockVersion, CrmPanelCtx } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";
import { resolveCoverSettings } from "@/features/site-builder/crm/cover-settings";
import { SiteCoverSettingsPrimary } from "@/features/site-builder/crm/site-cover-settings-primary";
import { SiteCoverDrawerSections } from "@/features/site-builder/crm/site-cover-drawer-sections";
import { renderGenericSettingsPanel } from "../../runtime/ui/generic-settings-panel";
import { CoverV2ContentPanel } from "./content-panel";

function updateSelected(ctx: CrmPanelCtx, next: unknown) {
  ctx.updateBlock(ctx.block.id, () => next as any);
}

export const HE002: BlockVersion = {
  blockCode: "HE002",
  normalizeData: (input) =>
    typeof input === "object" && input ? (input as Record<string, unknown>) : {},
  createDefault: ({ accountName }) => {
    const base = (defaultBlockData.cover ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "cover",
      variant: "v2",
      data: {
        ...base,
        title: accountName,
        align: "center",
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
          textAlign: "center",
          textAlignHeading: "center",
          textAlignSubheading: "center",
        },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => (
    <div className="px-1 pb-8 pt-1">
      <CoverV2ContentPanel {...ctx} />
    </div>
  ),
  settingsPanel: (ctx) => {
    const cover = resolveCoverSettings({
      rightPanel: ctx.rightPanel,
      selectedBlock: ctx.block,
      activeTheme: ctx.activeTheme,
      updateBlock: ctx.updateBlock,
    });
    if (!cover.isCoverSettingsPanel) return renderGenericSettingsPanel(ctx);
    return (
      <SiteCoverSettingsPrimary
        panelTheme={ctx.panelTheme}
        coverWidthButtonRef={ctx.coverWidthButtonRef}
        coverWidthPopoverRef={ctx.coverWidthPopoverRef}
        coverWidthModalOpen={ctx.coverWidthModalOpen}
        setCoverWidthModalOpen={ctx.setCoverWidthModalOpen}
        coverGridSpan={cover.coverGridSpan}
        coverGridStart={cover.coverGridStart}
        coverGridEnd={cover.coverGridEnd}
        applySelectedCoverGridRange={cover.applySelectedCoverGridRange}
        coverStyle={cover.coverStyle}
        updateSelectedCoverStyle={cover.updateSelectedCoverStyle}
        coverScrollEffect={cover.coverScrollEffect as "none" | "fixed" | "parallax"}
        updateSelectedCoverData={cover.updateSelectedCoverData}
        coverScrollHeightPx={cover.coverScrollHeightPx}
        coverFilterStartColor={cover.coverFilterStartColor}
        coverFilterStartOpacity={cover.coverFilterStartOpacity}
        coverFilterEndColor={cover.coverFilterEndColor}
        coverFilterEndOpacity={cover.coverFilterEndOpacity}
        coverArrow={cover.coverArrow as "none" | "down"}
        coverArrowColor={cover.coverArrowColor}
        coverArrowAnimated={cover.coverArrowAnimated}
        isCoverVariantV2={true}
        coverDrawerKey={ctx.coverDrawerKey}
        setCoverDrawerKey={ctx.setCoverDrawerKey}
        coverBackgroundPosition={cover.coverBackgroundPosition}
        coverMarginTopLines={cover.coverMarginTopLines}
        coverMarginBottomLines={cover.coverMarginBottomLines}
        coverBackgroundMode={cover.coverBackgroundMode}
        coverBackgroundTo={cover.coverBackgroundTo}
        coverBackgroundAngle={cover.coverBackgroundAngle}
        coverBackgroundStopA={cover.coverBackgroundStopA}
        coverBackgroundStopB={cover.coverBackgroundStopB}
      />
    );
  },
  drawers: (ctx) => {
    const cover = resolveCoverSettings({
      rightPanel: ctx.rightPanel,
      selectedBlock: ctx.block,
      activeTheme: ctx.activeTheme,
      updateBlock: ctx.updateBlock,
    });
    if (ctx.rightPanel !== "settings" || !cover.isCoverSettingsPanel) return "";
    if (!ctx.coverDrawerKey) return "";
    if (ctx.coverDrawerKey === "typography") {
      return (
        <BlockStyleEditor
          block={ctx.block}
          theme={ctx.activeTheme}
          activeSectionId="typography"
          onChange={(next) => updateSelected(ctx, next)}
        />
      );
    }
    return (
      <SiteCoverDrawerSections
        coverDrawerKey={ctx.coverDrawerKey}
        selectedBlock={ctx.block}
        activeTheme={ctx.activeTheme}
        coverStyle={cover.coverStyle}
        coverShowSecondaryButton={cover.coverShowSecondaryButton}
        coverPrimaryButtonBorderColor={cover.coverPrimaryButtonBorderColor}
        coverSecondaryButtonColor={cover.coverSecondaryButtonColor}
        coverSecondaryButtonTextColor={cover.coverSecondaryButtonTextColor}
        coverSecondaryButtonBorderColor={cover.coverSecondaryButtonBorderColor}
        coverSecondaryButtonRadius={cover.coverSecondaryButtonRadius}
        updateSelectedCoverStyle={cover.updateSelectedCoverStyle}
        updateSelectedCoverData={cover.updateSelectedCoverData}
      />
    );
  },
  actions: () => {},
};
