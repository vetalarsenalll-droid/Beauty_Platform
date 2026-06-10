import type { BlockVersion, CrmPanelCtx } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";
import { resolveCoverSettings } from "@/features/site-builder/crm/cover-settings";
import { SiteCoverSettingsPrimary } from "@/features/site-builder/crm/site-cover-settings-primary";
import { SiteCoverDrawerSections } from "@/features/site-builder/crm/site-cover-drawer-sections";
import { renderGenericSettingsPanel } from "../../runtime/ui/generic-settings-panel";
import { CoverV1ContentPanel } from "./content-panel";

function updateSelected(ctx: CrmPanelCtx, next: unknown) {
  ctx.updateBlock(ctx.block.id, () => next as typeof ctx.block);
}

const HE001_DEFAULT_IMAGE_URL = "/api/v1/site-builder/block-preview/HE001";
const HE001_DEFAULT_TITLE = "СЕРВИС, КОТОРОМУ ДОВЕРЯЮТ";
const HE001_DEFAULT_SUBTITLE = "ВАШ КОМФОРТ В НАДЁЖНЫХ РУКАХ";
const HE001_DEFAULT_DESCRIPTION =
  "Современные решения и забота о деталях, чтобы вы чувствовали себя лучше каждый день";
const HE001_DEFAULT_BUTTON_TEXT = "Записаться онлайн";

export const HE001: BlockVersion = {
  blockCode: "HE001",
  normalizeData: (input) => {
    if (!input || typeof input !== "object") return {};
    const data = input as Record<string, unknown>;
    const raw = typeof data.secondaryButtonSource === "string" ? data.secondaryButtonSource : "";
    if (raw === "auto") {
      return { ...data, secondaryButtonSource: "" };
    }
    return data;
  },
  createDefault: () => {
    const base = (defaultBlockData.cover ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "cover",
      variant: "v1",
      data: {
        ...base,
        title: HE001_DEFAULT_TITLE,
        subtitle: HE001_DEFAULT_SUBTITLE,
        description: HE001_DEFAULT_DESCRIPTION,
        buttonText: HE001_DEFAULT_BUTTON_TEXT,
        imageSource: { type: "custom", url: HE001_DEFAULT_IMAGE_URL },
        secondaryButtonSource: "",
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
          headingSize: 26,
          subheadingSize: 100,
          textSize: 20,
        },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => (
    <div className="px-1 pb-8 pt-1">
      <CoverV1ContentPanel {...ctx} />
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
        coverWidthButtonRef={ctx.getCoverWidthButtonRef()}
        coverWidthPopoverRef={ctx.getCoverWidthPopoverRef()}
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
        coverFilterStartColorDark={cover.coverFilterStartColorDark}
        coverFilterStartOpacityDark={cover.coverFilterStartOpacityDark}
        coverFilterEndColorDark={cover.coverFilterEndColorDark}
        coverFilterEndOpacityDark={cover.coverFilterEndOpacityDark}
        coverArrow={cover.coverArrow as "none" | "down"}
        coverArrowDark={cover.coverArrowDark as "none" | "down"}
        coverArrowColor={cover.coverArrowColor}
        coverArrowColorDark={cover.coverArrowColorDark}
        coverArrowAnimated={cover.coverArrowAnimated}
        isCoverVariantV2={false}
        coverDrawerKey={ctx.coverDrawerKey}
        setCoverDrawerKey={ctx.setCoverDrawerKey}
        coverBackgroundPosition={cover.coverBackgroundPosition}
        coverBackgroundFrom={cover.coverBackgroundFrom}
        coverBackgroundFromDark={cover.coverBackgroundFromDark}
        coverMarginTopLines={cover.coverMarginTopLines}
        coverMarginBottomLines={cover.coverMarginBottomLines}
        coverBackgroundMode={cover.coverBackgroundMode}
        coverBackgroundModeDark={cover.coverBackgroundModeDark}
        coverBackgroundTo={cover.coverBackgroundTo}
        coverBackgroundToDark={cover.coverBackgroundToDark}
        coverBackgroundAngle={cover.coverBackgroundAngle}
        coverBackgroundAngleDark={cover.coverBackgroundAngleDark}
        coverBackgroundStopA={cover.coverBackgroundStopA}
        coverBackgroundStopADark={cover.coverBackgroundStopADark}
        coverBackgroundStopB={cover.coverBackgroundStopB}
        coverBackgroundStopBDark={cover.coverBackgroundStopBDark}
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
        coverPrimaryButtonBorderColorDark={cover.coverPrimaryButtonBorderColorDark}
        coverPrimaryButtonHoverBgColor={cover.coverPrimaryButtonHoverBgColor}
        coverPrimaryButtonHoverBgColorDark={cover.coverPrimaryButtonHoverBgColorDark}
        coverSecondaryButtonColor={cover.coverSecondaryButtonColor}
        coverSecondaryButtonColorDark={cover.coverSecondaryButtonColorDark}
        coverSecondaryButtonTextColor={cover.coverSecondaryButtonTextColor}
        coverSecondaryButtonTextColorDark={cover.coverSecondaryButtonTextColorDark}
        coverSecondaryButtonBorderColor={cover.coverSecondaryButtonBorderColor}
        coverSecondaryButtonBorderColorDark={cover.coverSecondaryButtonBorderColorDark}
        coverSecondaryButtonHoverBgColor={cover.coverSecondaryButtonHoverBgColor}
        coverSecondaryButtonHoverBgColorDark={cover.coverSecondaryButtonHoverBgColorDark}
        coverSecondaryButtonRadius={cover.coverSecondaryButtonRadius}
        updateSelectedCoverStyle={cover.updateSelectedCoverStyle}
        updateSelectedCoverData={cover.updateSelectedCoverData}
      />
    );
  },
  actions: () => {},
};
