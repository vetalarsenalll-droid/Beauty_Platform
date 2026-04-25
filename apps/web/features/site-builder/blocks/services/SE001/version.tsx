import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { SiteServicesSettingsPrimary } from "@/features/site-builder/crm/site-services-settings-primary";
import { SE001ContentPanel } from "./content-panel";
import { SE001Drawers } from "./drawers";

export const SE001: BlockVersion = {
  blockCode: "SE001",
  normalizeData: (input) => {
    if (typeof input !== "object" || !input) return {};
    const data = input as Record<string, unknown>;
    const style =
      typeof data.style === "object" && data.style ? (data.style as Record<string, unknown>) : {};
    return {
      ...data,
      style: {
        ...style,
        sectionBgLight: style.sectionBgLight ?? "transparent",
        sectionBgDark: style.sectionBgDark ?? "transparent",
        sectionBg: style.sectionBg ?? "transparent",
        subBlockBgLight: style.subBlockBgLight ?? "transparent",
        subBlockBgDark: style.subBlockBgDark ?? "transparent",
        subBlockBg: style.subBlockBg ?? "transparent",
        borderColorLight: style.borderColorLight ?? "transparent",
        borderColorDark: style.borderColorDark ?? "transparent",
        borderColor: style.borderColor ?? "transparent",
      },
    };
  },
  createDefault: () => {
    const base = (defaultBlockData.services ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    return {
      id: makeBlockId(),
      type: "services",
      variant: "v1",
      data: {
        ...base,
        title: "Список услуг",
        subtitle: "Подберите процедуру по категории, стоимости и формату записи.",
        cardsPerRow: 3,
        categoryAllLabel: "Все услуги",
        searchPlaceholder: "Найти услугу",
        style: { ...defaultBlockStyle, ...baseStyle },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <SE001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => (
    <SiteServicesSettingsPrimary
      block={ctx.block}
      activeTheme={ctx.activeTheme}
      panelTheme={ctx.panelTheme}
      activePanelSectionId={ctx.activePanelSectionId}
      coverWidthButtonRef={ctx.coverWidthButtonRef}
      coverWidthPopoverRef={ctx.coverWidthPopoverRef}
      coverWidthModalOpen={ctx.coverWidthModalOpen}
      setCoverWidthModalOpen={ctx.setCoverWidthModalOpen}
      setActivePanelSectionId={ctx.setActivePanelSectionId}
      updateBlock={ctx.updateBlock}
    />
  ),
  drawers: (ctx) => <SE001Drawers {...ctx} />,
  actions: () => {},
};
