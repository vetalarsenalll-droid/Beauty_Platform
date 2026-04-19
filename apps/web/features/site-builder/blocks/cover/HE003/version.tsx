import type { BlockVersion, CrmPanelCtx } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { BlockStyleEditor } from "@/features/site-builder/crm/site-editor-panels";
import { resolveCoverSettings } from "@/features/site-builder/crm/cover-settings";
import { SiteCoverSettingsPrimary } from "@/features/site-builder/crm/site-cover-settings-primary";
import { SiteCoverDrawerSections } from "@/features/site-builder/crm/site-cover-drawer-sections";
import { renderGenericSettingsPanel } from "../../runtime/ui/generic-settings-panel";
import { CoverV3ContentPanel } from "./content-panel";

function updateSelected(ctx: CrmPanelCtx, next: unknown) {
  ctx.updateBlock(ctx.block.id, () => next as typeof ctx.block);
}

export const HE003: BlockVersion = {
  blockCode: "HE003",
  normalizeData: (input) => {
    if (!input || typeof input !== "object") return {};
    const data = input as Record<string, unknown>;
    const raw = typeof data.secondaryButtonSource === "string" ? data.secondaryButtonSource : "";
    const next = { ...data };
    if (typeof next.coverImageInsetPx !== "number" && typeof next.coverImageInset20 === "boolean") {
      next.coverImageInsetPx = next.coverImageInset20 ? 20 : 0;
    }
    if (typeof next.coverImageRadiusPx !== "number") {
      next.coverImageRadiusPx = 0;
    }
    delete next.coverImageInset20;
    if (raw === "auto") {
      return { ...next, secondaryButtonSource: "" };
    }
    return next;
  },
  createDefault: () => {
    const base = (defaultBlockData.cover ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "cover",
      variant: "v3",
      data: {
        ...base,
        title: "Северная Орхидея — пространство красоты и ухода",
        subtitle: "Быстрая онлайн-запись к мастерам, которым доверяют",
        description: "Выберите услугу, специалиста и удобное время за пару кликов.",
        showButton: true,
        buttonText: "Записаться",
        secondaryButtonSource: "",
        coverSubtitleColor: "#000000",
        coverDescriptionColor: "#000000",
        coverImageInsetPx: 0,
        coverImageRadiusPx: 0,
        coverFlipHorizontal: false,
        coverContentVerticalAlign: "center",
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
          textAlign: "left",
          textAlignHeading: "left",
          textAlignSubheading: "left",
          headingSize: 48,
          subheadingSize: 35,
          textSize: 28,
          textColor: "#000000",
          textColorLight: "#000000",
          textColorDark: "#000000",
          mutedColor: "#000000",
          mutedColorLight: "#000000",
          mutedColorDark: "#000000",
          sectionBg: "#ffffff",
          sectionBgLight: "#ffffff",
          sectionBgDark: "#ffffff",
          blockBg: "#ffffff",
          blockBgLight: "#ffffff",
          blockBgDark: "#ffffff",
        },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => (
    <div className="px-1 pb-8 pt-1">
      <CoverV3ContentPanel {...ctx} />
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
        isCoverVariantV3={true}
        coverImageInsetPx={cover.coverImageInsetPx}
        coverImageRadiusPx={cover.coverImageRadiusPx}
        coverFlipHorizontal={cover.coverFlipHorizontal}
        coverTextVerticalAlign={cover.coverTextVerticalAlign}
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

