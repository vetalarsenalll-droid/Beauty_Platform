import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import { defaultBlockData, defaultBlockStyle } from "@/features/site-builder/crm/site-client-core";
import { SiteServicesSettingsPrimary } from "@/features/site-builder/crm/site-services-settings-primary";
import { SE001ContentPanel } from "./content-panel";
import { SE001Drawers } from "./drawers";

function normalizeStyleColor(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isTransparentColor(value: unknown) {
  const normalized = normalizeStyleColor(value);
  return normalized === "" || normalized === "transparent" || normalized === "#e5e7eb";
}

function isLegacyWhiteServiceSurface(style: Record<string, unknown>) {
  const blockLight = normalizeStyleColor(style.blockBgLight ?? style.blockBg);
  const sectionLight = normalizeStyleColor(style.sectionBgLight ?? style.sectionBg);
  const subBlockLight = normalizeStyleColor(style.subBlockBgLight ?? style.subBlockBg);
  const blockDark = normalizeStyleColor(style.blockBgDark);
  const sectionDark = normalizeStyleColor(style.sectionBgDark);
  const subBlockDark = normalizeStyleColor(style.subBlockBgDark);

  return (
    (blockLight === "" || blockLight === "transparent" || blockLight === "#ffffff" || blockLight === "#fff") &&
    (sectionLight === "#ffffff" || sectionLight === "#fff") &&
    (subBlockLight === "#ffffff" || subBlockLight === "#fff") &&
    isTransparentColor(style.borderColorLight) &&
    isTransparentColor(style.borderColor) &&
    (blockDark === "" || blockDark === "transparent") &&
    (sectionDark === "" || sectionDark === "transparent") &&
    (subBlockDark === "" || subBlockDark === "transparent")
  );
}

export const SE001: BlockVersion = {
  blockCode: "SE001",
  normalizeData: (input) => {
    if (typeof input !== "object" || !input) return {};
    const data = input as Record<string, unknown>;
    const style =
      typeof data.style === "object" && data.style ? (data.style as Record<string, unknown>) : {};
    const shouldResetLegacySurface = isLegacyWhiteServiceSurface(style);
    return {
      ...data,
      style: {
        ...style,
        blockBgLight: shouldResetLegacySurface ? "transparent" : (style.blockBgLight ?? "transparent"),
        blockBgDark: style.blockBgDark ?? "transparent",
        blockBg: shouldResetLegacySurface ? "transparent" : (style.blockBg ?? "transparent"),
        sectionBgLight: shouldResetLegacySurface ? "transparent" : (style.sectionBgLight ?? "transparent"),
        sectionBgDark: style.sectionBgDark ?? "transparent",
        sectionBg: shouldResetLegacySurface ? "transparent" : (style.sectionBg ?? "transparent"),
        subBlockBgLight: shouldResetLegacySurface ? "transparent" : (style.subBlockBgLight ?? "transparent"),
        subBlockBgDark: style.subBlockBgDark ?? "transparent",
        subBlockBg: shouldResetLegacySurface ? "transparent" : (style.subBlockBg ?? "transparent"),
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
